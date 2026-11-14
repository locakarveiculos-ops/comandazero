-- Equipe: lista de membros com e-mail para o dono, e busca de conta por e-mail (só servidor).
-- Idempotente. Rollback no fim.

-- Membros da loja com e-mail. Só o dono (ou admin da plataforma) consegue listar.
create or replace function public.team_members(p_tenant uuid) returns table (user_id uuid, email text, name text, role member_role, created_at timestamptz, last_sign_in_at timestamptz, invited boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_member(p_tenant, '{owner}') then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  return query
  select m.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'name', ''), m.role, m.created_at, u.last_sign_in_at,
         (u.invited_at is not null and u.last_sign_in_at is null)
  from tenant_members m join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant
  order by (m.role = 'owner') desc, m.created_at;
end $$;
revoke all on function public.team_members(uuid) from public, anon;
grant execute on function public.team_members(uuid) to authenticated;

-- Só o servidor (service_role) resolve e-mail → id, para não permitir descobrir contas.
create or replace function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- Rollback:
-- drop function if exists public.team_members(uuid);
-- drop function if exists public.user_id_by_email(text);
