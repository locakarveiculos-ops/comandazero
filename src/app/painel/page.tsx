import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";

/** /painel leva para a loja do usuário logado; sem login, para a loja de demonstração. */
export default async function Painel() {
  const user = await getUser();
  if (!user) redirect("/painel/cafe-e-flor");
  const sb = await supabaseServer();
  const { data } = await sb.rpc("my_tenants");
  const first = (data as { slug: string }[] | null)?.[0];
  if (first) redirect(`/painel/${first.slug}`);
  const { data: admin } = await sb.rpc("is_platform_admin");
  redirect(admin ? "/super-admin" : "/painel/nova-loja");
}
