-- ComandaZero · Fase 2 (Supabase)
-- Multi-tenant com RLS por tenant_id. Rodar em um projeto novo (SQL Editor ou `supabase db push`).
-- Papéis: super admin da plataforma (platform_admins), membros da loja (tenant_members), cliente anônimo (cardápio público).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
do $$ begin create type plan_tier as enum ('starter', 'pro', 'enterprise'); exception when duplicate_object then null; end $$;
do $$ begin create type member_role as enum ('owner', 'manager', 'cashier', 'kitchen', 'waiter'); exception when duplicate_object then null; end $$;
do $$ begin create type order_mode as enum ('delivery', 'retirada', 'mesa', 'encomenda', 'balcao'); exception when duplicate_object then null; end $$;
do $$ begin create type order_status as enum ('recebido', 'preparo', 'pronto', 'saiu', 'entregue', 'cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_status as enum ('pendente', 'pago', 'parcial', 'estornado'); exception when duplicate_object then null; end $$;
do $$ begin create type order_channel as enum ('loja', 'mesa', 'balcao', 'delivery', 'whatsapp'); exception when duplicate_object then null; end $$;
do $$ begin create type table_state as enum ('livre', 'ocupada', 'conta'); exception when duplicate_object then null; end $$;
do $$ begin create type coupon_kind as enum ('percent', 'fixed', 'frete'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- plataforma
create table if not exists platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  subdomain text not null unique check (subdomain ~ '^[a-z0-9-]{3,30}$'),
  custom_domain text unique,
  name text not null check (char_length(name) between 2 and 80),
  tagline text not null default '',
  description text not null default '',
  category text not null default '',
  logo_url text,
  cover_url text,
  theme jsonb not null default '{}'::jsonb,
  whatsapp text check (whatsapp ~ '^55\d{10,11}$'),
  instagram text,
  address jsonb not null default '{}'::jsonb,
  hours jsonb not null default '[]'::jsonb,           -- [{day, open, close}]
  prep_minutes int not null default 15 check (prep_minutes between 1 and 240),
  modes order_mode[] not null default '{retirada}',
  delivery_per_km numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  plan plan_tier not null default 'starter',
  active boolean not null default true,
  loyalty jsonb not null default '{"enabled":false,"goal":10,"reward":"","categoryIds":[],"cashbackPct":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_members (
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'cashier',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members (user_id);

create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  bairro text not null,
  fee numeric(10,2) not null check (fee >= 0),
  minutes int not null default 30
);
create index if not exists delivery_zones_tenant_idx on delivery_zones (tenant_id);

-- ---------------------------------------------------------------- cardápio
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  icon text not null default 'Utensils',
  sort int not null default 0
);
create index if not exists categories_tenant_idx on categories (tenant_id, sort);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  code text not null,
  name text not null,
  description text not null default '',
  badge text,
  price numeric(10,2) not null check (price >= 0),
  price_label text,
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  quick_notes text[] not null default '{}',
  cake jsonb,                                         -- {minKg,maxKg,pricePerKg,massas[],recheios[],coberturas[],leadHours,depositPct}
  preorder jsonb,                                     -- {leadHours,depositPct}
  stock int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists products_tenant_idx on products (tenant_id, category_id);

create table if not exists option_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  sort int not null default 0,
  check (min_select <= max_select)
);
create index if not exists option_groups_product_idx on option_groups (product_id);

create table if not exists option_choices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  group_id uuid not null references option_groups (id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  sort int not null default 0
);
create index if not exists option_choices_group_idx on option_choices (group_id);

-- ---------------------------------------------------------------- pedidos
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  phone text not null check (phone ~ '^55\d{10,11}$'),
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  number int not null,
  channel order_channel not null,
  mode order_mode not null,
  status order_status not null default 'recebido',
  payment_status payment_status not null default 'pendente',
  gateway text not null default 'presencial',
  customer_id uuid references customers (id) on delete set null,
  customer_name text not null default '',
  customer_phone text,
  address jsonb,
  table_number text,
  scheduled_for timestamptz,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),
  deposit numeric(10,2),
  change_for numeric(10,2),
  coupon_code text,
  -- Token para o cliente acompanhar o pedido sem login (vai na URL /loja/<slug>/pedido/<id>?t=...).
  track_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index if not exists orders_tenant_created_idx on orders (tenant_id, created_at desc);
create index if not exists orders_tenant_status_idx on orders (tenant_id, status) where status not in ('entregue', 'cancelado');

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0),
  options jsonb not null default '[]'::jsonb,
  notes text not null default '',
  cake jsonb
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists order_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  method text not null,
  gateway text not null,
  amount numeric(10,2) not null check (amount > 0),
  external_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create unique index if not exists order_payments_external_idx on order_payments (gateway, external_id) where external_id is not null;

create table if not exists order_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  status order_status not null,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id);

-- Número sequencial por loja, sem corrida entre caixas.
create or replace function next_order_number() returns trigger language plpgsql as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext(new.tenant_id::text));
    select coalesce(max(number), 1000) + 1 into new.number from orders where tenant_id = new.tenant_id;
  end if;
  return new;
end $$;
drop trigger if exists orders_number on orders;
create trigger orders_number before insert on orders for each row execute function next_order_number();

create or replace function log_order_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_events (tenant_id, order_id, status) values (new.tenant_id, new.id, new.status);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists orders_status_log on orders;
create trigger orders_status_log before insert or update on orders for each row execute function log_order_status();

-- ---------------------------------------------------------------- mesas, cupons, fidelidade
create table if not exists dining_tables (
  tenant_id uuid not null references tenants (id) on delete cascade,
  number text not null,
  state table_state not null default 'livre',
  opened_at timestamptz,
  people int not null default 0,
  items jsonb not null default '[]'::jsonb,
  primary key (tenant_id, number)
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{3,15}$'),
  kind coupon_kind not null,
  value numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  active boolean not null default true,
  uses int not null default 0,
  unique (tenant_id, code)
);

create table if not exists loyalty_cards (
  tenant_id uuid not null references tenants (id) on delete cascade,
  phone text not null,
  name text not null,
  stamps int not null default 0,
  redeemed int not null default 0,
  cashback numeric(10,2) not null default 0,
  primary key (tenant_id, phone)
);

-- ---------------------------------------------------------------- integrações (segredos só via service_role)
create table if not exists integration_settings (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  whatsapp jsonb not null default '{}'::jsonb,         -- provedor, gatilhos e templates (sem segredos)
  payments jsonb not null default '{}'::jsonb,         -- gateways habilitados, modo, split (sem segredos)
  email jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Canal Whaileys de cada loja (instância cpw-<slug>). Substitui o "selo" da Fase 1.
create table if not exists whatsapp_channels (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  instance text not null unique check (instance ~ '^cpw-[a-z0-9][a-z0-9-]{1,58}$'),
  token text not null,
  webhook_secret text not null,
  bot_enabled boolean not null default true,
  phone text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Dedupe de mensagens recebidas (o motor reentrega até 3×) e últimas opções numeradas por conversa.
create table if not exists wa_messages (
  provider_id text primary key,
  instance text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create table if not exists wa_sessions (
  instance text not null,
  phone text not null,
  options text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (instance, phone)
);

create table if not exists payment_credentials (
  tenant_id uuid not null references tenants (id) on delete cascade,
  gateway text not null,
  secret text not null,                               -- cifrar com pgsodium/Vault em produção
  mode text not null default 'sandbox',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, gateway)
);

-- ---------------------------------------------------------------- funções de permissão
create or replace function is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function is_member(t uuid, roles member_role[] default null) returns boolean language sql stable security definer set search_path = public as $$
  select is_platform_admin() or exists (
    select 1 from tenant_members m
    where m.tenant_id = t and m.user_id = auth.uid() and (roles is null or m.role = any (roles))
  );
$$;

-- ---------------------------------------------------------------- RLS
alter table platform_admins enable row level security;
alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table delivery_zones enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table option_groups enable row level security;
alter table option_choices enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_payments enable row level security;
alter table order_events enable row level security;
alter table dining_tables enable row level security;
alter table coupons enable row level security;
alter table loyalty_cards enable row level security;
alter table integration_settings enable row level security;
alter table whatsapp_channels enable row level security;   -- sem policy: só service_role
alter table wa_messages enable row level security;         -- sem policy: só service_role
alter table wa_sessions enable row level security;         -- sem policy: só service_role
alter table payment_credentials enable row level security; -- sem policy: só service_role

-- Plataforma
drop policy if exists admins_self on platform_admins;
create policy admins_self on platform_admins for select using (user_id = auth.uid());

-- Lojas: vitrine pública só das ativas; edição por dono/gerente; criação só pela plataforma.
drop policy if exists tenants_public_read on tenants;
create policy tenants_public_read on tenants for select using (active or is_member(id));
drop policy if exists tenants_manage on tenants;
create policy tenants_manage on tenants for update using (is_member(id, '{owner,manager}')) with check (is_member(id, '{owner,manager}'));
drop policy if exists tenants_create on tenants;
create policy tenants_create on tenants for insert with check (is_platform_admin());

drop policy if exists members_read on tenant_members;
create policy members_read on tenant_members for select using (user_id = auth.uid() or is_member(tenant_id, '{owner}'));
drop policy if exists members_manage on tenant_members;
create policy members_manage on tenant_members for all using (is_member(tenant_id, '{owner}')) with check (is_member(tenant_id, '{owner}'));

-- Cardápio: leitura pública (loja ativa); escrita por dono/gerente.
do $$
declare t text;
begin
  foreach t in array array['delivery_zones', 'categories', 'products', 'option_groups', 'option_choices'] loop
    execute format('drop policy if exists %1$s_public_read on %1$s', t);
    execute format('create policy %1$s_public_read on %1$s for select using (exists (select 1 from tenants x where x.id = tenant_id and x.active) or is_member(tenant_id))', t);
    execute format('drop policy if exists %1$s_manage on %1$s', t);
    execute format('create policy %1$s_manage on %1$s for all using (is_member(tenant_id, ''{owner,manager}'')) with check (is_member(tenant_id, ''{owner,manager}''))', t);
  end loop;
end $$;

-- Pedidos: equipe da loja lê e atualiza. O cliente cria pedido pela rota de servidor (valida preço no banco),
-- e acompanha via função get_order_tracking(id, token) abaixo — nunca com select direto.
do $$
declare t text;
begin
  foreach t in array array['customers', 'orders', 'order_items', 'order_payments', 'order_events', 'dining_tables', 'coupons', 'loyalty_cards', 'integration_settings'] loop
    execute format('drop policy if exists %1$s_staff on %1$s', t);
    execute format('create policy %1$s_staff on %1$s for all using (is_member(tenant_id)) with check (is_member(tenant_id))', t);
  end loop;
end $$;

-- Cupons e configurações sensíveis: só dono/gerente alteram.
drop policy if exists coupons_staff on coupons;
drop policy if exists coupons_read on coupons;
drop policy if exists coupons_manage on coupons;
create policy coupons_read on coupons for select using (is_member(tenant_id));
create policy coupons_manage on coupons for all using (is_member(tenant_id, '{owner,manager}')) with check (is_member(tenant_id, '{owner,manager}'));
drop policy if exists integration_settings_staff on integration_settings;
drop policy if exists integration_settings_manage on integration_settings;
create policy integration_settings_manage on integration_settings for all using (is_member(tenant_id, '{owner,manager}')) with check (is_member(tenant_id, '{owner,manager}'));

-- Acompanhamento público do pedido com token (sem expor dados de outros pedidos).
create or replace function get_order_tracking(p_order uuid, p_token text)
returns table (number int, status order_status, mode order_mode, total numeric, scheduled_for timestamptz, events jsonb)
language sql stable security definer set search_path = public as $$
  select o.number, o.status, o.mode, o.total, o.scheduled_for,
         coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.id) from order_events e where e.order_id = o.id), '[]'::jsonb)
  from orders o where o.id = p_order and o.track_token = p_token;
$$;
revoke all on function get_order_tracking(uuid, text) from public;
grant execute on function get_order_tracking(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------- Realtime (KDS / PDV / pedidos)
do $$ begin
  alter publication supabase_realtime add table orders, order_items, dining_tables;
exception when undefined_object or duplicate_object then null; end $$;

-- ---------------------------------------------------------------- semente: Café e Flor (Tenant #01)
insert into tenants (slug, subdomain, name, tagline, description, category, logo_url, theme, whatsapp, instagram, address, hours, prep_minutes, modes, delivery_per_km, min_order, plan)
values (
  'cafe-e-flor', 'cafeeflor', 'Café e Flor', 'Um cantinho para a sua pausa · Cafeteria artesanal',
  'Café passado com carinho, bolos caseiros, croissants quentinhos e aquele aconchego cheio de flores. Dentro do Covabra Centro.',
  'Cafeteria artesanal', '/tenants/cafe-e-flor/logo.webp',
  '{"paper":"#FAF6F0","surface":"#FFFFFF","ink":"#2C1A12","muted":"#6B5246","primary":"#2C1A12","primaryInk":"#FAF6F0","secondary":"#5E7153","accent":"#C86D51","accentText":"#9C4A30","highlight":"#D49B4B","line":"#EADCCD","dark":false,"fontDisplay":"serif"}',
  '5519995868521', 'cafee_flor',
  '{"street":"Av. Presidente Vargas, 375","district":"Centro","city":"Indaiatuba","uf":"SP","cep":"13339-125","complement":"Dentro do Covabra Supermercados Centro"}',
  '[{"day":0,"open":"07:30","close":"21:00"},{"day":1,"open":"07:30","close":"21:00"},{"day":2,"open":"07:30","close":"21:00"},{"day":3,"open":"07:30","close":"21:00"},{"day":4,"open":"07:30","close":"21:00"},{"day":5,"open":"07:30","close":"21:00"},{"day":6,"open":"07:30","close":"21:00"}]',
  12, '{delivery,retirada,mesa,encomenda}', 2.5, 20, 'pro'
) on conflict (slug) do nothing;
