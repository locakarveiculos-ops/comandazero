import { requirePlatformAdmin } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { SuperAdminClient, type AuditRow, type OverviewRow } from "./super-admin-client";

export const metadata = { title: "Super Admin", robots: { index: false, follow: false } };

/** Só administradores da plataforma (tabela platform_admins). Anônimo vai para /entrar; lojista recebe 403. */
export default async function Page() {
  await requirePlatformAdmin();
  const sb = await supabaseServer();
  const [{ data: rows }, { data: audit }] = await Promise.all([
    sb.rpc("platform_overview"),
    sb.from("audit_log").select("id, actor_email, action, details, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  return <SuperAdminClient rows={(rows ?? []) as OverviewRow[]} audit={(audit ?? []) as AuditRow[]} />;
}
