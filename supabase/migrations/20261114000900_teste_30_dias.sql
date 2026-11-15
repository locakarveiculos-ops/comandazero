-- Teste grátis de 30 dias para novas lojas; amplia testes existentes sem reduzir prazos.
-- Idempotente: reaplicar não acrescenta outros 16 dias. Não altera assinaturas pagas.
begin;

create or replace function public.start_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_demo then
    insert into subscriptions (tenant_id, plan, status, trial_ends_at)
    values (new.id, new.plan, 'trial', now() + interval '30 days')
    on conflict (tenant_id) do nothing;
  end if;
  return new;
end $$;

update public.subscriptions s
set trial_ends_at = greatest(s.trial_ends_at, t.created_at + interval '30 days'),
    updated_at = now()
from public.tenants t
where t.id = s.tenant_id
  and not t.is_demo
  and s.status = 'trial'
  and (s.trial_ends_at is null or s.trial_ends_at < t.created_at + interval '30 days');

commit;
