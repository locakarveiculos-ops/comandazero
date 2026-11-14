-- Onboarding em 5 passos: a loja nasce com modos de venda, horário, cor e cardápio (modelo ou vazio).
-- Mantém a assinatura antiga (5 argumentos) chamando a nova. Idempotente. Rollback no fim.

create or replace function create_my_tenant_v2(
  p_name text, p_slug text, p_category text, p_whatsapp text, p_city text, p_uf text,
  p_modes text[], p_open text, p_close text, p_days int[], p_primary text, p_accent text, p_template boolean
) returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; tpl uuid; v_slug text := lower(p_slug); v_modes order_mode[];
begin
  if auth.uid() is null then raise exception 'SEM_LOGIN' using errcode = '42501'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' or v_slug in ('nova-loja', 'cafe-e-flor', 'burger-station', 'admin', 'api', 'www', 'app', 'onboarding') then
    raise exception 'SLUG_INVALIDO' using errcode = 'P0001';
  end if;
  if exists (select 1 from tenants where slug = v_slug or subdomain = replace(v_slug, '-', '')) then
    raise exception 'SLUG_EM_USO' using errcode = 'P0001';
  end if;
  if (select count(*) from tenant_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'LIMITE_LOJAS' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NOME_INVALIDO' using errcode = 'P0001'; end if;
  if p_open !~ '^\d{2}:\d{2}$' or p_close !~ '^\d{2}:\d{2}$' then raise exception 'HORARIO_INVALIDO' using errcode = 'P0001'; end if;
  if coalesce(p_primary, '#0B1F40') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(p_accent, '#D4AF6B') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'COR_INVALIDA' using errcode = 'P0001'; end if;
  select coalesce(array_agg(m::order_mode), '{retirada}') into v_modes
    from unnest(coalesce(p_modes, '{retirada}')) m where m in ('delivery', 'retirada', 'mesa', 'encomenda');

  select id into tpl from tenants where slug = 'cafe-e-flor';
  insert into tenants (slug, subdomain, name, tagline, description, category, theme, whatsapp, address, hours, prep_minutes, modes, plan, is_demo)
  select v_slug, left(replace(v_slug, '-', ''), 30), left(trim(p_name), 80), left(p_category, 60) || ' · peça pelo app', 'Cardápio digital de ' || left(trim(p_name), 80),
         left(p_category, 60),
         theme || jsonb_build_object('primary', coalesce(p_primary, '#0B1F40'), 'accent', coalesce(p_accent, '#D4AF6B'), 'ink', coalesce(p_primary, '#0B1F40')),
         case when regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g') ~ '^\d{10,11}$' then '55' || regexp_replace(p_whatsapp, '\D', '', 'g') end,
         jsonb_build_object('street', '', 'district', '', 'city', left(coalesce(p_city, ''), 80), 'uf', upper(left(coalesce(nullif(p_uf, ''), 'SP'), 2)), 'cep', ''),
         (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'open', p_open, 'close', p_close) order by d), '[]'::jsonb)
            from unnest(coalesce(p_days, '{0,1,2,3,4,5,6}')) d where d between 0 and 6),
         15, v_modes, 'pro', false
  from tenants where id = tpl
  returning id into v_id;

  insert into tenant_members (tenant_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into integration_settings (tenant_id) values (v_id);
  insert into dining_tables (tenant_id, number) select v_id, lpad(g::text, 2, '0') from generate_series(1, 10) g;
  if coalesce(p_template, true) then
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
  else
    insert into categories (tenant_id, name, icon, sort) values (v_id, 'Destaques', 'Star', 0);
  end if;
  return v_slug;
end $$;
revoke all on function create_my_tenant_v2(text, text, text, text, text, text, text[], text, text, int[], text, text, boolean) from public, anon;
grant execute on function create_my_tenant_v2(text, text, text, text, text, text, text[], text, text, int[], text, text, boolean) to authenticated;

-- Compatibilidade: chamada antiga vira a nova com padrões.
create or replace function create_my_tenant(p_name text, p_slug text, p_category text, p_whatsapp text, p_city text)
returns text language sql security definer set search_path = public as $$
  select create_my_tenant_v2(p_name, p_slug, p_category, p_whatsapp, p_city, 'SP', '{retirada,mesa}', '08:00', '18:00', '{1,2,3,4,5,6}', null, null, true);
$$;
revoke all on function create_my_tenant(text, text, text, text, text) from public, anon;
grant execute on function create_my_tenant(text, text, text, text, text) to authenticated;

-- Rollback: drop function if exists create_my_tenant_v2(text, text, text, text, text, text, text[], text, text, int[], text, text, boolean);
-- (e reaplicar create_my_tenant de 20261114000100_p0_producao.sql)
