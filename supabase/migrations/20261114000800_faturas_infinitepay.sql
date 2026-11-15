-- Assinatura cobrada pela InfinitePay (Checkout Integrado). A API não tem recorrência:
-- cada ciclo (mensal ou anual) vira uma fatura com link próprio. O pagamento só vale depois de
-- confirmado no /payment_check da InfinitePay (o webhook dela não tem assinatura).
-- Idempotente. Rollback no fim.

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan plan_tier not null,
  cycle text not null check (cycle in ('monthly', 'yearly')),
  -- Valor cobrado no ciclo, em centavos (vem de src/lib/plans.ts no servidor).
  amount_cents integer not null check (amount_cents >= 100),
  monthly_value numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled')),
  link_url text,
  transaction_nsu text,
  invoice_slug text,
  capture_method text,
  paid_cents integer,
  receipt_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists subscription_invoices_tenant_idx on public.subscription_invoices (tenant_id, created_at desc);
alter table public.subscription_invoices enable row level security;
drop policy if exists subscription_invoices_read on public.subscription_invoices;
create policy subscription_invoices_read on public.subscription_invoices for select using (is_member(tenant_id, '{owner}'));
-- Escrita só pelo servidor (service_role).

alter table public.subscriptions add column if not exists provider text not null default 'infinitepay';

-- Atraso passa a ser calculado pela data: assinatura ativa com o período vencido há mais de 7 dias fica só leitura.
create or replace function public.tenant_read_only(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (s.status = 'overdue' and s.overdue_since < now() - interval '7 days')
        or (s.status = 'active' and s.current_period_end < now() - interval '7 days')
        or (s.status = 'trial' and s.trial_ends_at < now())
        or s.status = 'canceled'
    from subscriptions s join tenants tn on tn.id = s.tenant_id
    where s.tenant_id = t and not tn.is_demo
  ), false);
$$;

-- Confirma a fatura e estende o período. Chamado só pelo servidor depois do /payment_check.
-- Idempotente: fatura já paga não estende de novo.
create or replace function public.confirm_subscription_invoice(p_invoice uuid, p_transaction text, p_slug text, p_method text, p_paid_cents integer, p_receipt text)
returns boolean language plpgsql security definer set search_path = public as $$
declare inv record; base timestamptz; months int;
begin
  select * into inv from subscription_invoices where id = p_invoice for update;
  if not found or inv.status <> 'pending' then return false; end if;
  update subscription_invoices
     set status = 'paid', transaction_nsu = p_transaction, invoice_slug = p_slug, capture_method = p_method,
         paid_cents = p_paid_cents, receipt_url = p_receipt, paid_at = now()
   where id = p_invoice;
  months := case when inv.cycle = 'yearly' then 12 else 1 end;
  -- Renovação antecipada soma ao fim do período atual; atrasada recomeça de hoje.
  select greatest(coalesce(current_period_end, now()), now()) into base from subscriptions where tenant_id = inv.tenant_id;
  insert into subscriptions (tenant_id, plan, cycle, status, monthly_value, current_period_end, provider)
  values (inv.tenant_id, inv.plan, inv.cycle, 'active', inv.monthly_value, coalesce(base, now()) + make_interval(months => months), 'infinitepay')
  on conflict (tenant_id) do update
     set plan = excluded.plan, cycle = excluded.cycle, status = 'active', monthly_value = excluded.monthly_value,
         current_period_end = excluded.current_period_end, overdue_since = null, provider = 'infinitepay', updated_at = now();
  update tenants set plan = inv.plan where id = inv.tenant_id;
  insert into audit_log (action, tenant_id, details)
  values ('assinatura.pagamento', inv.tenant_id, jsonb_build_object('fatura', inv.id, 'plano', inv.plan, 'ciclo', inv.cycle, 'centavos', p_paid_cents, 'meio', p_method));
  return true;
end $$;
revoke all on function public.confirm_subscription_invoice(uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_subscription_invoice(uuid, text, text, text, integer, text) to service_role;

-- Rollback:
-- drop function if exists public.confirm_subscription_invoice(uuid, text, text, text, integer, text);
-- drop table if exists public.subscription_invoices;
-- alter table public.subscriptions drop column if exists provider;
-- (e reaplicar tenant_read_only de 20261114000300_assinaturas_auditoria.sql)
