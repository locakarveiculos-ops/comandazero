-- Onboarding: checa endereço e limite de lojas logo no passo 1 (QA-04, QA-05), sem esperar o "Criar loja".
-- Só leitura, mesmas regras de create_my_tenant_v2. Idempotente. Rollback no fim.

create or replace function onboarding_check(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_slug text := lower(coalesce(p_slug, ''));
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'SEM_LOGIN'); end if;
  if (select count(*) from tenant_members where user_id = auth.uid() and role = 'owner') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'LIMITE_LOJAS');
  end if;
  if v_slug = '' then return jsonb_build_object('ok', true); end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' or v_slug in ('nova-loja', 'cafe-e-flor', 'burger-station', 'admin', 'api', 'www', 'app', 'onboarding') then
    return jsonb_build_object('ok', false, 'code', 'SLUG_INVALIDO');
  end if;
  -- O subdomínio é o endereço sem hífens: "burger-station" e "burgerstation" disputam o mesmo.
  if exists (select 1 from tenants where slug = v_slug or subdomain = replace(v_slug, '-', '')) then
    return jsonb_build_object('ok', false, 'code', 'SLUG_EM_USO');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function onboarding_check(text) from public, anon;
grant execute on function onboarding_check(text) to authenticated;

-- Rollback: drop function if exists onboarding_check(text);
