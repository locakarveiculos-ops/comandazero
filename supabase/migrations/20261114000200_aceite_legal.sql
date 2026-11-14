-- Aceite de Termos de Uso / Política de Privacidade e opt-in de marketing (LGPD).
-- O cadastro envia as versões em raw_user_meta_data; o gatilho grava a prova com data do servidor.
-- Idempotente. Rollback no fim do arquivo.

create table if not exists public.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document text not null check (document in ('termos', 'privacidade', 'marketing_whatsapp')),
  version text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(),
  source text not null default 'cadastro'
);
create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id, document, accepted_at desc);
alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_own on public.legal_acceptances;
create policy legal_acceptances_own on public.legal_acceptances for select using (user_id = auth.uid());

create or replace function public.record_signup_acceptance() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m ? 'terms_version' then
    insert into legal_acceptances (user_id, document, version) values (new.id, 'termos', m->>'terms_version');
  end if;
  if m ? 'privacy_version' then
    insert into legal_acceptances (user_id, document, version) values (new.id, 'privacidade', m->>'privacy_version');
  end if;
  if m ? 'marketing_whatsapp_opt_in' then
    insert into legal_acceptances (user_id, document, version, accepted)
    values (new.id, 'marketing_whatsapp', coalesce(m->>'privacy_version', 'sem-versao'), (m->>'marketing_whatsapp_opt_in')::boolean);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_acceptance on auth.users;
create trigger on_auth_user_created_acceptance after insert on auth.users
  for each row execute function public.record_signup_acceptance();

-- Rollback:
-- drop trigger if exists on_auth_user_created_acceptance on auth.users;
-- drop function if exists public.record_signup_acceptance();
-- drop table if exists public.legal_acceptances;
