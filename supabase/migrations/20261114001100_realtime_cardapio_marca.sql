-- Cardápio ao vivo e marca da loja no banco.
--  1. products, categories e tenants entram na publicação Realtime (painel e vitrine atualizam sem recarregar).
--  2. Bucket "brand-images" para logo e capa (público, até 2 MB, webp/jpeg/png; pasta <tenant_id>/).
--  3. save_category: cria/renomeia categoria da loja real (dono/gerente).
-- Idempotente. Rollback no fim.

do $$
declare t text;
begin
  foreach t in array array['products', 'categories', 'tenants'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
alter table public.products replica identity full;
alter table public.categories replica identity full;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-images', 'brand-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brand_images_write on storage.objects;
create policy brand_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-images' and is_member(((storage.foldername(name))[1])::uuid, '{owner,manager}'));
drop policy if exists brand_images_delete on storage.objects;
create policy brand_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-images' and is_member(((storage.foldername(name))[1])::uuid, '{owner,manager}'));

create or replace function public.save_category(p_tenant uuid, p_id uuid, p_name text, p_icon text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_member(p_tenant, '{owner,manager}') then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NOME_INVALIDO' using errcode = 'P0001'; end if;
  if p_id is null then
    insert into categories (tenant_id, name, icon, sort)
    values (p_tenant, left(trim(p_name), 60), coalesce(p_icon, 'Utensils'), coalesce((select max(sort) + 1 from categories where tenant_id = p_tenant), 0))
    returning id into v_id;
  else
    update categories set name = left(trim(p_name), 60), icon = coalesce(p_icon, icon) where id = p_id and tenant_id = p_tenant returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.save_category(uuid, uuid, text, text) from public, anon;
grant execute on function public.save_category(uuid, uuid, text, text) to authenticated;

-- Rollback:
-- alter publication supabase_realtime drop table public.products, public.categories, public.tenants;
-- drop policy if exists brand_images_write on storage.objects; drop policy if exists brand_images_delete on storage.objects;
-- delete from storage.buckets where id = 'brand-images';
-- drop function if exists public.save_category(uuid, uuid, text, text);
