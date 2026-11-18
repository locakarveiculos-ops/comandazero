-- Pix na chave da loja para pedidos reais (QA-01) e dados do acompanhamento (QA-02, QA-25).
-- get_order_tracking passa a devolver: forma de pagamento, troco, taxa de entrega, observação por item
-- e, só para pedido Pix ainda não pago, a chave Pix + nome do recebedor configurados em integration_settings.
-- A chave Pix é dado de recebimento (o cliente precisa dela para pagar); continua exigindo o token do pedido.
-- Idempotente (create or replace). Não altera dados. Rollback no fim.

create or replace function get_order_tracking(p_order uuid, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'mode', o.mode, 'payment_status', o.payment_status,
    'payment_method', o.payment_method, 'change_for', o.change_for,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'discount', o.discount, 'total', o.total, 'deposit', o.deposit,
    'scheduled_for', o.scheduled_for, 'table_number', o.table_number, 'created_at', o.created_at,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'tenant_slug', t.slug,
    'pix', case when o.payment_method = 'pix' and o.payment_status <> 'pago' and nullif(s.payments->>'pixKey', '') is not null
      then jsonb_build_object('key', s.payments->>'pixKey', 'name', coalesce(nullif(s.payments->>'pixName', ''), t.name), 'city', coalesce(nullif(t.address->>'city', ''), 'BRASIL'))
    end,
    'reviewed', exists (select 1 from order_reviews r where r.order_id = o.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'options', i.options, 'notes', i.notes) order by i.id) from order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.id) from order_events e where e.order_id = o.id), '[]'::jsonb))
  from orders o join tenants t on t.id = o.tenant_id left join integration_settings s on s.tenant_id = o.tenant_id
  where o.id = p_order and o.track_token = p_token and length(p_token) >= 32;
$$;
revoke all on function get_order_tracking(uuid, text) from public;
grant execute on function get_order_tracking(uuid, text) to anon, authenticated;

-- Formas de pagamento aceitas pela loja, para o carrinho do cliente (QA-07). Só booleanos e bandeiras de vale:
-- a chave Pix nunca sai daqui (ela só aparece no acompanhamento de um pedido Pix, com o token do pedido).
create or replace function tenant_payment_options(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pix', nullif(s.payments->>'pixKey', '') is not null,
    'presencial', coalesce((s.payments->'gateways'->'presencial'->>'enabled')::boolean, true),
    'vr', case when coalesce((s.payments->>'vrEnabled')::boolean, false) then coalesce(s.payments->'acceptVR', '[]'::jsonb) else '[]'::jsonb end)
  from tenants t left join integration_settings s on s.tenant_id = t.id
  where t.slug = p_slug and t.active;
$$;
revoke all on function tenant_payment_options(text) from public;
grant execute on function tenant_payment_options(text) to anon, authenticated;

-- Rollback:
-- drop function if exists tenant_payment_options(text);
-- e reaplicar get_order_tracking de 20261114000700_avaliacoes.sql.
