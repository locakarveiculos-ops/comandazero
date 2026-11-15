import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/server/auth";
import { getSubscription } from "@/lib/server/subscription";
import { supabaseServer } from "@/lib/supabase/server";
import { BillingClient, type Invoice } from "./billing-client";

export const metadata = { title: "Assinatura" };

/** Plano e cobrança da loja (InfinitePay). Só o dono; loja de demonstração não tem assinatura. */
export default async function Page({ params }: PageProps<"/painel/[slug]/assinatura">) {
  const { slug } = await params;
  const access = await requireTenant(slug, "billing.manage");
  if (access.isDemo) notFound();
  const sub = await getSubscription(access.id);
  const { data } = await (await supabaseServer())
    .from("subscription_invoices")
    .select("id, plan, cycle, amount_cents, status, capture_method, receipt_url, created_at, paid_at")
    .eq("tenant_id", access.id)
    .order("created_at", { ascending: false })
    .limit(12);
  return <BillingClient slug={slug} sub={sub} invoices={(data ?? []) as Invoice[]} renewSoon={!!sub?.renewSoon} />;
}
