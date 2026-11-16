-- Notificação push (Web Push com VAPID).
--  - Equipe: inscrição por aparelho e por loja (avisa "Novo pedido" com o painel fechado).
--  - Cliente: inscrição ligada a um pedido (avisa cada etapa); criada só com o token do pedido.
-- Escrita e leitura só pelo servidor (service_role). Idempotente. Rollback no fim.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  kind text not null check (kind in ('staff', 'customer')),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  check ((kind = 'staff' and user_id is not null) or (kind = 'customer' and order_id is not null))
);
create index if not exists push_subscriptions_staff_idx on public.push_subscriptions (tenant_id) where kind = 'staff';
create index if not exists push_subscriptions_order_idx on public.push_subscriptions (order_id) where kind = 'customer';
alter table public.push_subscriptions enable row level security;
-- Sem policy: só o service_role (servidor) acessa.

-- Rollback:
-- drop table if exists public.push_subscriptions;
