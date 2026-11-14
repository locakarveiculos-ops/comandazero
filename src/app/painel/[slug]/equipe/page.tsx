import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { TeamClient, type Member } from "./team-client";

export const metadata = { title: "Equipe" };

/** Pessoas com acesso ao painel e o papel de cada uma. Só o dono. */
export default async function Page({ params }: PageProps<"/painel/[slug]/equipe">) {
  const { slug } = await params;
  const access = await requireTenant(slug, "team.manage");
  if (access.isDemo) notFound();
  const sb = await supabaseServer();
  const { data } = await sb.rpc("team_members", { p_tenant: access.id });
  return <TeamClient slug={slug} members={(data ?? []) as Member[]} />;
}
