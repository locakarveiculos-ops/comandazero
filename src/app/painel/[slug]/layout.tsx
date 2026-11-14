import { headers } from "next/headers";
import { PAGE_PERMISSION, can, requireTenant } from "@/lib/server/auth";
import { getSubscription } from "@/lib/server/subscription";
import { RemoteTenantProvider } from "@/components/loja/use-store-tenant";
import { BillingBanner } from "@/components/painel/billing-banner";
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
  const sub = access.isDemo ? null : await getSubscription(access.id);
  return (
    <RemoteTenantProvider tenant={real}>
      <PanelShell
        slug={slug}
        access={{ tenantId: access.id, isDemo: access.isDemo, role: access.role, platformAdmin: access.platformAdmin, readOnly: !!sub?.readOnly }}
        banner={page === "assinatura" ? null : <BillingBanner slug={slug} sub={sub} canPay={can(access.role, "billing.manage")} />}
      >
        {children}
      </PanelShell>
    </RemoteTenantProvider>
  );
}
