-- Painel só leitura (teste vencido, assinatura cancelada ou atraso > 7 dias).
-- Bloqueia edição de cardápio, mesas, cupons, zonas, marca e integrações feita pelo lojista (papel authenticated).
-- Pedidos NÃO são bloqueados: o cliente final continua sendo atendido. service_role (servidor/webhooks) passa sempre.
-- Idempotente. Rollback no fim.

create or replace function public.guard_read_only() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return coalesce(new, old); end if;
  t := case when tg_table_name = 'tenants' then coalesce(new.id, old.id) else coalesce(new.tenant_id, old.tenant_id) end;
  if tenant_read_only(t) then
    raise exception 'SOMENTE_LEITURA' using errcode = 'P0001', hint = 'Regularize a assinatura para voltar a editar.';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array['products', 'categories', 'option_groups', 'option_choices', 'dining_tables', 'coupons', 'delivery_zones', 'integration_settings', 'tenants'] loop
    execute format('drop trigger if exists %I on public.%I', tbl || '_read_only', tbl);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_read_only()', tbl || '_read_only', tbl);
  end loop;
end $$;

-- Rollback:
-- do $$ declare tbl text; begin foreach tbl in array array['products','categories','option_groups','option_choices','dining_tables','coupons','delivery_zones','integration_settings','tenants'] loop
--   execute format('drop trigger if exists %I on public.%I', tbl || '_read_only', tbl); end loop; end $$;
-- drop function if exists public.guard_read_only();
