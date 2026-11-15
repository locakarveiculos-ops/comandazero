import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { requireTenant } from "@/lib/server/auth";
import { settleInvoice } from "@/lib/server/subscription-billing";

export const metadata = { title: "Pagamento da assinatura" };

/**
 * Volta do checkout da InfinitePay (redirect_url). Traz order_nsu, transaction_nsu e slug na URL:
 * confirma pelo /payment_check na hora, sem depender do webhook chegar primeiro.
 */
export default async function Page({ params, searchParams }: PageProps<"/painel/[slug]/assinatura/retorno">) {
  const { slug } = await params;
  await requireTenant(slug, "billing.manage");
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const result = await settleInvoice({ invoiceId: one(q.order_nsu), transactionNsu: one(q.transaction_nsu), slug: one(q.slug), receiptUrl: one(q.receipt_url) || null }).catch(() => ({ ok: false as const, reason: "erro" }));
  const ok = result.ok;

  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
      {ok ? <CheckCircle2 className="size-14 text-cz-success" aria-hidden /> : <Clock className="size-14 text-cz-gold-text" aria-hidden />}
      <h1 className="cz-heading text-2xl font-bold">{ok ? "Pagamento confirmado" : "Pagamento em confirmação"}</h1>
      <p className="text-cz-muted">
        {ok
          ? "Sua assinatura está ativa. Obrigado por escolher a ComandaZero!"
          : "Ainda não recebemos a confirmação da InfinitePay. Se você já pagou, ela chega em instantes e a assinatura ativa sozinha."}
      </p>
      <Link href={`/painel/${slug}/assinatura`} className="inline-flex min-h-11 items-center rounded-[10px] bg-brand px-5 font-semibold text-brand-ink">
        Ver assinatura
      </Link>
    </div>
  );
}
