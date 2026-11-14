-- ComandaZero · P0 produção
-- Idempotente (pode rodar de novo). Rollback no fim do arquivo (comentado).
--  1. Loja demo x produção (is_demo) e slug reservado das lojas de demonstração
--  2. Pedido criado só pelo servidor (função create_order recalcula preço do banco)
--  3. Acompanhamento público com token (get_order_tracking já existia; agora com itens)
--  4. Storage de fotos por loja com limite de tipo/tamanho
--  5. Funções auxiliares de papel para o app

alter table tenants add column if not exists is_demo boolean not null default false;
update tenants set is_demo = true where slug in ('cafe-e-flor', 'burger-station');

-- Papel do usuário logado na loja (null = não é membro). Usado pelo servidor do app.
create or replace function my_tenant_role(p_tenant uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from tenant_members where tenant_id = p_tenant and user_id = auth.uid();
$$;
revoke all on function my_tenant_role(uuid) from public;
grant execute on function my_tenant_role(uuid) to authenticated;

-- Lojas do usuário logado (para /painel redirecionar para a dele).
create or replace function my_tenants()
returns table (tenant_id uuid, slug text, name text, role member_role)
language sql stable security definer set search_path = public as $$
  select t.id, t.slug, t.name, m.role
  from tenant_members m join tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and t.active
  order by t.name;
$$;
revoke all on function my_tenants() from public;
grant execute on function my_tenants() to authenticated;


-- Correção: o histórico era gravado em BEFORE INSERT, antes do pedido existir (violava a FK de order_events).
create or replace function touch_order() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create or replace function log_order_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_events (tenant_id, order_id, status) values (new.tenant_id, new.id, new.status);
  end if;
  return null;
end $$;
drop trigger if exists orders_status_log on orders;
drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders for each row execute function touch_order();
create trigger orders_status_log after insert or update on orders for each row execute function log_order_status();

-- ---------------------------------------------------------------- pedido pelo servidor
alter table orders add column if not exists idempotency_key text;
alter table orders add column if not exists payment_method text;
create unique index if not exists orders_idempotency_idx on orders (tenant_id, idempotency_key) where idempotency_key is not null;

-- Recebe só ids e quantidades. Preço, adicionais, taxa de entrega e cupom vêm do banco.
-- Executada pela rota /api/pedidos com service_role (não exposta ao anon).
create or replace function create_order(
  p_slug text,
  p_mode order_mode,
  p_items jsonb,          -- [{product_id, qty, choice_ids:[uuid], notes, cake:{kg,massa,recheio,cobertura,frase,pickupAt}}]
  p_customer jsonb,       -- {name, phone}
  p_payment text,         -- pix | cartao_credito | dinheiro | vale_refeicao | ...
  p_zone_id uuid default null,
  p_address jsonb default null,
  p_table text default null,
  p_coupon text default null,
  p_change_for numeric default null,
  p_scheduled_for timestamptz default null,
  p_idempotency_key text default null
) returns table (order_id uuid, number int, track_token text, total numeric, deposit numeric)
language plpgsql security definer set search_path = public as $$
declare
  t tenants%rowtype;
  it jsonb;
  p products%rowtype;
  v_qty int;
  v_unit numeric;
  v_subtotal numeric := 0;
  v_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric;
  v_deposit numeric := null;
  v_has_cake boolean := false;
  v_order orders%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_opts jsonb;
  v_kg numeric;
  g record;
  v_chosen int;
  c coupons%rowtype;
begin
  select * into t from tenants where slug = p_slug and active;
  if not found then raise exception 'LOJA_INEXISTENTE' using errcode = 'P0001'; end if;
  if not (p_mode = any (t.modes)) and p_mode not in ('balcao', 'encomenda') then
    raise exception 'MODO_INDISPONIVEL' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'CARRINHO_INVALIDO' using errcode = 'P0001';
  end if;

  -- Reenvio do mesmo pedido (duplo clique, rede instável): devolve o pedido já criado.
  if p_idempotency_key is not null then
    select * into v_order from orders o where o.tenant_id = t.id and o.idempotency_key = p_idempotency_key;
    if found then
      return query select v_order.id, v_order.number, v_order.track_token, v_order.total, v_order.deposit;
      return;
    end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid and tenant_id = t.id;
    if not found then raise exception 'PRODUTO_INEXISTENTE' using errcode = 'P0001'; end if;
    if not p.available then raise exception 'PRODUTO_ESGOTADO:%', p.name using errcode = 'P0001'; end if;
    v_qty := coalesce((it->>'qty')::int, 0);
    if v_qty < 1 or v_qty > 99 then raise exception 'QUANTIDADE_INVALIDA' using errcode = 'P0001'; end if;

    -- Opções: cada escolha precisa pertencer a um grupo deste produto e respeitar mínimo/máximo.
    select coalesce(jsonb_agg(jsonb_build_object('groupId', og.id, 'groupName', og.name, 'choiceId', oc.id, 'name', oc.name, 'price', oc.price) order by og.sort, oc.sort), '[]'::jsonb)
      into v_opts
      from option_choices oc join option_groups og on og.id = oc.group_id
      where og.product_id = p.id
        and oc.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(it->'choice_ids', '[]'::jsonb)) x);
    if jsonb_array_length(v_opts) <> jsonb_array_length(coalesce(it->'choice_ids', '[]'::jsonb)) then
      raise exception 'OPCAO_INVALIDA' using errcode = 'P0001';
    end if;
    for g in select og.id, og.name, og.min_select, og.max_select from option_groups og where og.product_id = p.id loop
      select count(*) into v_chosen from jsonb_array_elements(v_opts) o where (o->>'groupId')::uuid = g.id;
      if v_chosen < g.min_select or v_chosen > g.max_select then
        raise exception 'OPCAO_FORA_DO_LIMITE:%', g.name using errcode = 'P0001';
      end if;
    end loop;

    if p.cake is not null then
      v_has_cake := true;
      v_kg := (it->'cake'->>'kg')::numeric;
      if v_kg is null or v_kg < (p.cake->>'minKg')::numeric or v_kg > (p.cake->>'maxKg')::numeric then
        raise exception 'PESO_INVALIDO' using errcode = 'P0001';
      end if;
      if (it->'cake'->>'pickupAt')::timestamptz < now() + make_interval(hours => (p.cake->>'leadHours')::int) - interval '1 minute' then
        raise exception 'ANTECEDENCIA_INSUFICIENTE' using errcode = 'P0001';
      end if;
      v_unit := round(v_kg * (p.cake->>'pricePerKg')::numeric, 2);
    else
      if p.preorder is not null then v_has_cake := true; end if;
      v_unit := p.price;
    end if;
    v_unit := v_unit + coalesce((select sum((o->>'price')::numeric) from jsonb_array_elements(v_opts) o), 0);
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_items := v_items || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'unit_price', v_unit, 'qty', v_qty, 'options', v_opts,
      'notes', left(coalesce(it->>'notes', ''), 200), 'cake', it->'cake');
  end loop;

  if p_mode = 'delivery' then
    select fee into v_fee from delivery_zones where id = p_zone_id and tenant_id = t.id;
    if not found then raise exception 'BAIRRO_INVALIDO' using errcode = 'P0001'; end if;
    if v_subtotal < t.min_order then raise exception 'PEDIDO_MINIMO' using errcode = 'P0001'; end if;
  end if;

  if p_coupon is not null and length(p_coupon) > 0 then
    select * into c from coupons where tenant_id = t.id and code = upper(p_coupon) and active;
    if found and v_subtotal >= c.min_order then
      v_discount := case c.kind when 'percent' then round(v_subtotal * c.value / 100, 2) when 'fixed' then least(c.value, v_subtotal) else v_fee end;
      update coupons set uses = uses + 1 where id = c.id;
    end if;
  end if;

  v_total := greatest(0, round(v_subtotal + v_fee - v_discount, 2));
  if v_has_cake then
    if p_payment <> 'pix' then raise exception 'ENCOMENDA_EXIGE_PIX' using errcode = 'P0001'; end if;
    v_deposit := round(v_total / 2, 2);
  end if;
  if p_payment = 'dinheiro' and p_change_for is not null and p_change_for < v_total then
    raise exception 'TROCO_INVALIDO' using errcode = 'P0001';
  end if;

  insert into orders (tenant_id, number, channel, mode, status, payment_status, gateway, customer_name, customer_phone,
                      address, table_number, scheduled_for, subtotal, delivery_fee, discount, total, deposit, change_for,
                      coupon_code, idempotency_key, payment_method)
  values (t.id, 0,
          case when p_mode = 'mesa' then 'mesa'::order_channel when p_mode = 'balcao' then 'balcao'::order_channel else 'loja'::order_channel end,
          case when v_has_cake then 'encomenda'::order_mode else p_mode end,
          'recebido', 'pendente', case when p_payment = 'pix' then 'pix' else 'presencial' end,
          left(trim(p_customer->>'name'), 80), nullif(regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g'), ''),
          p_address, p_table, coalesce(p_scheduled_for, (select max((x->'cake'->>'pickupAt')::timestamptz) from jsonb_array_elements(v_items) x)),
          round(v_subtotal, 2), v_fee, v_discount, v_total, v_deposit, p_change_for,
          nullif(upper(p_coupon), ''), p_idempotency_key, p_payment)
  returning * into v_order;

  insert into order_items (tenant_id, order_id, product_id, name, unit_price, qty, options, notes, cake)
  select t.id, v_order.id, (x->>'product_id')::uuid, x->>'name', (x->>'unit_price')::numeric, (x->>'qty')::int, x->'options', x->>'notes', x->'cake'
  from jsonb_array_elements(v_items) x;

  return query select v_order.id, v_order.number, v_order.track_token, v_order.total, v_order.deposit;
end $$;
revoke all on function create_order(text, order_mode, jsonb, jsonb, text, uuid, jsonb, text, text, numeric, timestamptz, text) from public, anon, authenticated;


-- Acompanhamento público: agora com itens e dados da loja; continua exigindo o token do pedido.
drop function if exists get_order_tracking(uuid, text);
create or replace function get_order_tracking(p_order uuid, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'mode', o.mode, 'payment_status', o.payment_status,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'discount', o.discount, 'total', o.total, 'deposit', o.deposit,
    'scheduled_for', o.scheduled_for, 'table_number', o.table_number, 'created_at', o.created_at,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'tenant_slug', t.slug,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'options', i.options) order by i.id) from order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.id) from order_events e where e.order_id = o.id), '[]'::jsonb))
  from orders o join tenants t on t.id = o.tenant_id
  where o.id = p_order and o.track_token = p_token and length(p_token) >= 32;
$$;
revoke all on function get_order_tracking(uuid, text) from public;
grant execute on function get_order_tracking(uuid, text) to anon, authenticated;

-- Mudança de status pelo painel: só membros com papel adequado; trigger registra o histórico.
create or replace function set_order_status(p_order uuid, p_status order_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_role member_role;
begin
  select tenant_id into v_tenant from orders where id = p_order;
  if v_tenant is null then raise exception 'PEDIDO_INEXISTENTE' using errcode = 'P0001'; end if;
  select role into v_role from tenant_members where tenant_id = v_tenant and user_id = auth.uid();
  if v_role is null and not is_platform_admin() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if p_status = 'cancelado' and v_role not in ('owner', 'manager', 'cashier') and not is_platform_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  update orders set status = p_status where id = p_order;
end $$;
revoke all on function set_order_status(uuid, order_status) from public, anon;
grant execute on function set_order_status(uuid, order_status) to authenticated;

-- ---------------------------------------------------------------- pagamentos (idempotência)
-- Um registro por (gateway, external_id): webhook repetido não confirma duas vezes.
create table if not exists payment_events (
  id bigserial primary key,
  gateway text not null,
  external_id text not null,
  status text not null,
  order_id uuid references orders (id) on delete set null,
  raw jsonb,
  received_at timestamptz not null default now(),
  unique (gateway, external_id, status)
);
alter table payment_events enable row level security; -- sem policy: só service_role

-- ---------------------------------------------------------------- Storage de fotos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Caminho obrigatório: <tenant_id>/<arquivo>. Só dono/gerente da loja escreve; leitura pública (cardápio).
drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists product_images_write on storage.objects;
create policy product_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and is_member(((storage.foldername(name))[1])::uuid, '{owner,manager}'));
drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and is_member(((storage.foldername(name))[1])::uuid, '{owner,manager}'));
drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and is_member(((storage.foldername(name))[1])::uuid, '{owner,manager}'));

-- ---------------------------------------------------------------- Realtime
-- Painel escuta INSERT/UPDATE de orders da própria loja (RLS também vale para o Realtime).
alter table orders replica identity full;

/* ROLLBACK
drop policy if exists product_images_read on storage.objects;
drop policy if exists product_images_write on storage.objects;
drop policy if exists product_images_update on storage.objects;
drop policy if exists product_images_delete on storage.objects;
delete from storage.buckets where id = 'product-images';   -- só se o bucket estiver vazio
drop table if exists payment_events;
drop function if exists set_order_status(uuid, order_status);
drop function if exists create_order(text, order_mode, jsonb, jsonb, text, uuid, jsonb, text, text, numeric, timestamptz, text);
drop function if exists my_tenants();
drop function if exists my_tenant_role(uuid);
drop index if exists orders_idempotency_idx;
alter table orders drop column if exists idempotency_key;
alter table orders drop column if exists payment_method;
alter table tenants drop column if exists is_demo;
-- get_order_tracking: reaplicar a versão de supabase/schema.sql
*/

-- ---------------------------------------------------------------- salvar produto (transacional)
-- Produto + grupos + opções numa transação; só dono/gerente da loja (checado aqui, além da RLS).
create or replace function save_product(p_tenant uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; g jsonb; v_group uuid; i int := 0; k int;
begin
  if not is_member(p_tenant, '{owner,manager}') then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if (p->>'categoryId') is not null and not exists (select 1 from categories where id = (p->>'categoryId')::uuid and tenant_id = p_tenant) then
    raise exception 'CATEGORIA_INVALIDA' using errcode = 'P0001';
  end if;
  v_id := coalesce(nullif(p->>'id', '')::uuid, gen_random_uuid());
  insert into products (id, tenant_id, category_id, code, name, description, badge, price, image_url, available, featured, quick_notes, cake, preorder)
  values (v_id, p_tenant, (p->>'categoryId')::uuid, p->>'code', p->>'name', coalesce(p->>'description', ''), nullif(p->>'badge', ''),
          (p->>'price')::numeric, p->>'image', coalesce((p->>'available')::boolean, true), coalesce((p->>'featured')::boolean, false),
          coalesce(array(select jsonb_array_elements_text(p->'quickNotes')), '{}'), p->'cake', p->'preorder')
  on conflict (id) do update set category_id = excluded.category_id, code = excluded.code, name = excluded.name, description = excluded.description,
    badge = excluded.badge, price = excluded.price, image_url = excluded.image_url, available = excluded.available, featured = excluded.featured,
    quick_notes = excluded.quick_notes, cake = excluded.cake, preorder = excluded.preorder, updated_at = now()
  where products.tenant_id = p_tenant;
  delete from option_groups where product_id = v_id;
  for g in select * from jsonb_array_elements(coalesce(p->'optionGroups', '[]'::jsonb)) loop
    insert into option_groups (tenant_id, product_id, name, min_select, max_select, sort)
    values (p_tenant, v_id, g->>'name', (g->>'min')::int, (g->>'max')::int, i) returning id into v_group;
    insert into option_choices (tenant_id, group_id, name, price, sort)
    select p_tenant, v_group, c->>'name', coalesce((c->>'price')::numeric, 0), (row_number() over ()) - 1
    from jsonb_array_elements(g->'choices') c;
    i := i + 1;
  end loop;
  return v_id;
end $$;
revoke all on function save_product(uuid, jsonb) from public, anon;
grant execute on function save_product(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- onboarding: usuário cria a própria loja
-- Cria loja real (is_demo = false) com o usuário como dono e um cardápio modelo para começar.
create or replace function create_my_tenant(p_name text, p_slug text, p_category text, p_whatsapp text, p_city text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; tpl uuid; v_slug text := lower(p_slug);
begin
  if auth.uid() is null then raise exception 'SEM_LOGIN' using errcode = '42501'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' or v_slug in ('nova-loja', 'cafe-e-flor', 'burger-station', 'admin', 'api', 'www', 'app') then
    raise exception 'SLUG_INVALIDO' using errcode = 'P0001';
  end if;
  if exists (select 1 from tenants where slug = v_slug or subdomain = replace(v_slug, '-', '')) then
    raise exception 'SLUG_EM_USO' using errcode = 'P0001';
  end if;
  if (select count(*) from tenant_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'LIMITE_LOJAS' using errcode = 'P0001';
  end if;
  select id into tpl from tenants where slug = 'cafe-e-flor';
  insert into tenants (slug, subdomain, name, tagline, description, category, theme, whatsapp, instagram, address, hours, prep_minutes, modes, plan, is_demo, logo_url)
  select v_slug, left(replace(v_slug, '-', ''), 30), left(trim(p_name), 80), left(p_category, 60) || ' · peça pelo app', 'Cardápio digital de ' || left(trim(p_name), 80),
         left(p_category, 60), theme,
         case when regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g') ~ '^\d{10,11}$' then '55' || regexp_replace(p_whatsapp, '\D', '', 'g') end,
         null, jsonb_build_object('street', '', 'district', '', 'city', left(coalesce(p_city, ''), 80), 'uf', 'SP', 'cep', ''),
         hours, 15, '{retirada,mesa}', 'starter', false, null
  from tenants where id = tpl
  returning id into v_id;
  insert into tenant_members (tenant_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into integration_settings (tenant_id) values (v_id);
  insert into dining_tables (tenant_id, number) select v_id, lpad(g::text, 2, '0') from generate_series(1, 10) g;
  -- Cardápio modelo (o lojista edita/remove em Cardápio).
  insert into categories (tenant_id, name, icon, sort) select v_id, name, icon, sort from categories where tenant_id = tpl;
  insert into products (tenant_id, category_id, code, name, description, badge, price, price_label, image_url, available, featured, quick_notes, cake, preorder)
    select v_id, (select c2.id from categories c2 where c2.tenant_id = v_id and c2.name = c.name), p.code, p.name, p.description, p.badge, p.price, p.price_label, p.image_url, p.available, p.featured, p.quick_notes, p.cake, p.preorder
    from products p join categories c on c.id = p.category_id where p.tenant_id = tpl;
  insert into option_groups (tenant_id, product_id, name, min_select, max_select, sort)
    select v_id, (select p2.id from products p2 where p2.tenant_id = v_id and p2.code = p.code), g.name, g.min_select, g.max_select, g.sort
    from option_groups g join products p on p.id = g.product_id where g.tenant_id = tpl;
  insert into option_choices (tenant_id, group_id, name, price, sort)
    select v_id, (select g2.id from option_groups g2 join products p2 on p2.id = g2.product_id where p2.tenant_id = v_id and p2.code = p.code and g2.name = g.name), o.name, o.price, o.sort
    from option_choices o join option_groups g on g.id = o.group_id join products p on p.id = g.product_id where o.tenant_id = tpl;
  return v_slug;
end $$;
revoke all on function create_my_tenant(text, text, text, text, text) from public, anon;
grant execute on function create_my_tenant(text, text, text, text, text) to authenticated;
