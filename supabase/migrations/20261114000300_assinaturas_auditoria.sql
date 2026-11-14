-- Assinaturas (teste grátis, Asaas), log de auditoria do Super Admin e trial na criação da loja.
-- Idempotente. Rollback no fim do arquivo.

do $$ begin
  create type subscription_status as enum ('trial', 'active', 'overdue', 'canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan plan_tier not null default 'pro',
  cycle text not null default 'monthly' check (cycle in ('monthly', 'yearly')),
  status subscription_status not null default 'trial',
  -- Valor mensal contratado (preço travado; base do MRR). Nulo durante o teste.
  monthly_value numeric(10, 2),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  overdue_since timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select using (is_member(tenant_id, '{owner,manager}'));
-- Escrita só pelo servidor (service_role) após checar o papel e/ou o webhook do Asaas.

-- Painel só leitura: atraso acima de 7 dias, ou teste vencido sem assinatura.
create or replace function public.tenant_read_only(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (s.status = 'overdue' and s.overdue_since < now() - interval '7 days')
        or (s.status = 'trial' and s.trial_ends_at < now())
        or s.status = 'canceled'
    from subscriptions s join tenants tn on tn.id = s.tenant_id
    where s.tenant_id = t and not tn.is_demo
  ), false);
$$;
grant execute on function public.tenant_read_only(uuid) to anon, authenticated;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select using (is_platform_admin());

-- Toda loja real nova nasce em teste grátis de 14 dias.
create or replace function public.start_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_demo then
    insert into subscriptions (tenant_id, plan, status, trial_ends_at)
    values (new.id, new.plan, 'trial', now() + interval '14 days')
    on conflict (tenant_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists tenants_start_trial on public.tenants;
create trigger tenants_start_trial after insert on public.tenants for each row execute function public.start_trial();

-- Lojas reais que já existem entram em teste a partir de hoje.
insert into subscriptions (tenant_id, plan, status, trial_ends_at)
select id, plan, 'trial', now() + interval '14 days' from tenants where not is_demo
on conflict (tenant_id) do nothing;

-- Visão do Super Admin: uma linha por loja com assinatura, pedidos e WhatsApp. Só admin da plataforma.
create or replace function public.platform_overview() returns table (
  id uuid, slug text, name text, category text, logo_url text, is_demo boolean, active boolean, created_at timestamptz,
  plan plan_tier, sub_status subscription_status, cycle text, monthly_value numeric, trial_ends_at timestamptz, overdue_since timestamptz,
  orders bigint, gmv numeric, last_order_at timestamptz, whatsapp_connected boolean, owner_email text
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_platform_admin() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  return query
  select t.id, t.slug, t.name, t.category, t.logo_url, t.is_demo, t.active, t.created_at,
         coalesce(s.plan, t.plan), s.status, s.cycle, s.monthly_value, s.trial_ends_at, s.overdue_since,
         coalesce(o.n, 0), coalesce(o.gmv, 0), o.last_at,
         (w.connected_at is not null),
         (select u.email::text from tenant_members m join auth.users u on u.id = m.user_id
           where m.tenant_id = t.id and m.role = 'owner' order by m.created_at limit 1)
  from tenants t
  left join subscriptions s on s.tenant_id = t.id
  left join lateral (
    select count(*) n, sum(od.total) filter (where od.status <> 'cancelado') gmv, max(od.created_at) last_at from orders od where od.tenant_id = t.id
  ) o on true
  left join whatsapp_channels w on w.tenant_id = t.id
  order by t.is_demo, t.created_at desc;
end $$;
revoke all on function public.platform_overview() from public, anon;
grant execute on function public.platform_overview() to authenticated;

-- Rollback:
-- drop function if exists public.platform_overview();
-- drop trigger if exists tenants_start_trial on public.tenants;
-- drop function if exists public.start_trial();
-- drop function if exists public.tenant_read_only(uuid);
-- drop table if exists public.audit_log;
-- drop table if exists public.subscriptions;
-- drop type if exists subscription_status;
