import { requirePlatformAdmin } from "@/lib/server/auth";
import { SuperAdminClient } from "./super-admin-client";

export const metadata = { title: "Super Admin", robots: { index: false, follow: false } };

/** Só administradores da plataforma (tabela platform_admins). Anônimo vai para /entrar; lojista recebe 403. */
export default async function Page() {
  await requirePlatformAdmin();
  return <SuperAdminClient />;
}
