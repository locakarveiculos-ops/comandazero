import { headers } from "next/headers";
import { PAGE_PERMISSION, requireTenant } from "@/lib/server/auth";
import { RemoteTenantProvider } from "@/components/loja/use-store-tenant";
import { getRealTenant } from "@/lib/server/tenant";
import { PanelShell } from "./panel-shell";

export const metadata = { title: "Painel do lojista", manifest: "/api/manifest/saas", robots: { index: false, follow: false } };

export default async function Layout({ children, params }: LayoutProps<"/painel/[slug]">) {
  const { slug } = await params;
  // Permissão da página pelo caminho real (definido pelo proxy, não pelo navegador).
  const path = (await headers()).get("x-cz-path") ?? `/painel/${slug}`;
  const page = path.replace(`/painel/${slug}`, "").split("/")[1] ?? "";
  const access = await requireTenant(slug, PAGE_PERMISSION[page] ?? "orders.view", path);
  const real = access.isDemo ? null : await getRealTenant(slug);
  return (
    <RemoteTenantProvider tenant={real}>
    <PanelShell slug={slug} access={{ tenantId: access.id, isDemo: access.isDemo, role: access.role, platformAdmin: access.platformAdmin }}>
      {children}
    </PanelShell>
    </RemoteTenantProvider>
  );
}
