import { headers } from "next/headers";
import { PAGE_PERMISSION, can, requireTenant } from "@/lib/server/auth";
import { getSubscription } from "@/lib/server/subscription";
import { RemoteTenantProvider } from "@/components/loja/use-store-tenant";
import { BillingBanner } from "@/components/painel/billing-banner";
import { getRealTenant } from "@/lib/server/tenant";
import { supabaseServer } from "@/lib/supabase/server";
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
  // Loja real: o seletor lista só as lojas da conta (nunca as demonstrações guardadas no navegador).
  const myStores = access.isDemo ? null : (((await (await supabaseServer()).rpc("my_tenants")).data ?? []) as { slug: string; name: string }[]).map(({ slug, name }) => ({ slug, name }));
  return (
    <RemoteTenantProvider tenant={real}>
      <PanelShell
        slug={slug}
        stores={myStores}
        access={{ tenantId: access.id, isDemo: access.isDemo, role: access.role, platformAdmin: access.platformAdmin, readOnly: !!sub?.readOnly, plan: sub?.effectivePlan ?? "enterprise", trial: !sub || sub.status === "trial" }}
        banner={page === "assinatura" ? null : <BillingBanner slug={slug} sub={sub} cta={can(access.role, "billing.manage") ? "link" : "ask-owner"} />}
      >
        {children}
      </PanelShell>
    </RemoteTenantProvider>
  );
}
