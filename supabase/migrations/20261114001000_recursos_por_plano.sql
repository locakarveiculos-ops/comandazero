-- Recursos por plano. Teste grátis = acesso completo (como o plano Rede) até o primeiro pagamento;
-- depois valem as regras do plano pago. Espelha PLAN_FEATURES de src/lib/plans.ts.
-- Idempotente. Rollback no fim.

-- Plano usado nas regras: teste, loja sem assinatura ou demonstração = 'enterprise' (completo).
create or replace function public.tenant_effective_plan(t uuid) returns plan_tier
language sql stable security definer set search_path = public as $$
  select case
    when tn.is_demo or s.tenant_id is null or s.status = 'trial' then 'enterprise'::plan_tier
    else s.plan
  end
  from tenants tn left join subscriptions s on s.tenant_id = tn.id
  where tn.id = t;
$$;
grant execute on function public.tenant_effective_plan(uuid) to anon, authenticated;

create or replace function public.tenant_has_feature(t uuid, f text) returns boolean
language sql stable security definer set search_path = public as $$
  select case tenant_effective_plan(t)
    when 'enterprise' then f in ('whatsapp', 'pdv', 'loyalty', 'team', 'reports_export', 'multi_store', 'custom_domain')
    when 'pro' then f in ('whatsapp', 'pdv', 'loyalty', 'team', 'reports_export')
    else false
  end;
$$;
grant execute on function public.tenant_has_feature(uuid, text) to anon, authenticated;

-- Equipe: incluir pessoa (não-dono) exige o recurso 'team'. Remover sempre pode.
create or replace function public.guard_team_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role <> 'owner' and not tenant_has_feature(new.tenant_id, 'team') then
    raise exception 'RECURSO_DO_PLANO' using errcode = 'P0001', hint = 'Equipe com papéis faz parte do plano Profissional.';
  end if;
  return new;
end $$;
drop trigger if exists tenant_members_plan on public.tenant_members;
create trigger tenant_members_plan before insert or update of role on public.tenant_members
  for each row execute function public.guard_team_plan();

-- Cupons e fidelidade: criar/editar cupom exige 'loyalty' (excluir sempre pode).
create or replace function public.guard_loyalty_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not tenant_has_feature(new.tenant_id, 'loyalty') then
    raise exception 'RECURSO_DO_PLANO' using errcode = 'P0001', hint = 'Fidelidade e cupons fazem parte do plano Profissional.';
  end if;
  return new;
end $$;
drop trigger if exists coupons_plan on public.coupons;
create trigger coupons_plan before insert or update on public.coupons
  for each row execute function public.guard_loyalty_plan();

-- Mais de uma loja: a 2ª loja em diante exige que uma loja já paga do dono seja do plano Rede.
-- Lojas em teste não contam como "pagas"; o primeiro cadastro sempre passa.
create or replace function public.owner_can_add_store(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from tenant_members m join tenants t on t.id = m.tenant_id where m.user_id = u and m.role = 'owner' and not t.is_demo)
      or exists (select 1 from tenant_members m join subscriptions s on s.tenant_id = m.tenant_id
                  where m.user_id = u and m.role = 'owner' and s.status in ('trial', 'active') and tenant_effective_plan(m.tenant_id) = 'enterprise')
      or is_platform_admin();
$$;

-- Rollback:
-- drop trigger if exists coupons_plan on public.coupons; drop function if exists public.guard_loyalty_plan();
-- drop trigger if exists tenant_members_plan on public.tenant_members; drop function if exists public.guard_team_plan();
-- drop function if exists public.owner_can_add_store(uuid);
-- drop function if exists public.tenant_has_feature(uuid, text); drop function if exists public.tenant_effective_plan(uuid);
