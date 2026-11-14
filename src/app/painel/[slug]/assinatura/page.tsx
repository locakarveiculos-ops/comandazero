import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/server/auth";
import { asaasConfigured } from "@/lib/server/asaas";
import { getSubscription } from "@/lib/server/subscription";
import { BillingClient } from "./billing-client";

export const metadata = { title: "Assinatura" };

/** Plano e cobrança da loja. Só o dono; loja de demonstração não tem assinatura. */
export default async function Page({ params }: PageProps<"/painel/[slug]/assinatura">) {
  const { slug } = await params;
  const access = await requireTenant(slug, "billing.manage");
  if (access.isDemo) notFound();
  const sub = await getSubscription(access.id);
  return <BillingClient slug={slug} sub={sub} billingReady={asaasConfigured()} />;
}
