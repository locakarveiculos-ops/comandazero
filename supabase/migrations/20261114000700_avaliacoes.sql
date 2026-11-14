-- Avaliações reais: o cliente avalia o próprio pedido (pelo link com token) depois de entregue.
-- Uma avaliação por pedido. A vitrine mostra a média só com 10 ou mais avaliações.
-- Idempotente. Rollback no fim.

create table if not exists public.order_reviews (
  order_id uuid primary key references public.orders(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists order_reviews_tenant_idx on public.order_reviews (tenant_id, created_at desc);
alter table public.order_reviews enable row level security;
drop policy if exists order_reviews_member_read on public.order_reviews;
create policy order_reviews_member_read on public.order_reviews for select using (is_member(tenant_id, '{owner,manager}'));

-- Cliente avalia com o token do pedido. Só pedido entregue, só uma vez.
create or replace function public.submit_order_review(p_order uuid, p_token text, p_stars int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if length(coalesce(p_token, '')) < 32 then raise exception 'PEDIDO_INEXISTENTE' using errcode = 'P0001'; end if;
  select id, tenant_id, status into o from orders where id = p_order and track_token = p_token;
  if not found then raise exception 'PEDIDO_INEXISTENTE' using errcode = 'P0001'; end if;
  if o.status <> 'entregue' then raise exception 'PEDIDO_NAO_ENTREGUE' using errcode = 'P0001'; end if;
  if p_stars not between 1 and 5 then raise exception 'NOTA_INVALIDA' using errcode = 'P0001'; end if;
  insert into order_reviews (order_id, tenant_id, stars, comment)
  values (o.id, o.tenant_id, p_stars, nullif(left(trim(coalesce(p_comment, '')), 500), ''));
exception when unique_violation then
  raise exception 'JA_AVALIADO' using errcode = 'P0001';
end $$;
revoke all on function public.submit_order_review(uuid, text, int, text) from public;
grant execute on function public.submit_order_review(uuid, text, int, text) to anon, authenticated;

-- Média pública: null enquanto a loja tiver menos de 10 avaliações (evita nota enganosa).
create or replace function public.tenant_rating(p_tenant uuid) returns table (rating numeric, total bigint)
language sql stable security definer set search_path = public as $$
  select case when count(*) >= 10 then round(avg(stars)::numeric, 1) end, count(*)
  from order_reviews where tenant_id = p_tenant;
$$;
grant execute on function public.tenant_rating(uuid) to anon, authenticated;

-- get_order_tracking passa a dizer se o pedido já foi avaliado (resto igual à versão do P0).
create or replace function get_order_tracking(p_order uuid, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'mode', o.mode, 'payment_status', o.payment_status,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'discount', o.discount, 'total', o.total, 'deposit', o.deposit,
    'scheduled_for', o.scheduled_for, 'table_number', o.table_number, 'created_at', o.created_at,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'tenant_slug', t.slug,
    'reviewed', exists (select 1 from order_reviews r where r.order_id = o.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'options', i.options) order by i.id) from order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.id) from order_events e where e.order_id = o.id), '[]'::jsonb))
  from orders o join tenants t on t.id = o.tenant_id
  where o.id = p_order and o.track_token = p_token and length(p_token) >= 32;
$$;
revoke all on function get_order_tracking(uuid, text) from public;
grant execute on function get_order_tracking(uuid, text) to anon, authenticated;

-- Rollback:
-- drop function if exists public.tenant_rating(uuid);
-- drop function if exists public.submit_order_review(uuid, text, int, text);
-- drop table if exists public.order_reviews;
-- (e reaplicar get_order_tracking de 20261114000100_p0_producao.sql)
