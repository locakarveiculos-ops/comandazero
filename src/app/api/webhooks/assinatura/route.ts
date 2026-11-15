import { settleInvoice } from "@/lib/server/subscription-billing";

/**
 * POST /api/webhooks/assinatura — aviso da InfinitePay sobre a fatura da assinatura.
 * O aviso não é assinado; por isso ele só dispara a confirmação oficial (/payment_check) em settleInvoice.
 * Responde 200 quando processado (inclusive aviso repetido ou não confirmado) e 400 em erro, para a InfinitePay reenviar.
 */
type Notice = { order_nsu?: string; transaction_nsu?: string; invoice_slug?: string; slug?: string; receipt_url?: string };

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 50_000) return Response.json({ error: "payload" }, { status: 413 });
  let n: Notice;
  try {
    n = JSON.parse(raw);
  } catch {
    return Response.json({ error: "payload" }, { status: 400 });
  }
  if (!n.order_nsu || !n.transaction_nsu || !(n.invoice_slug ?? n.slug)) return Response.json({ ignored: true });
  try {
    const r = await settleInvoice({ invoiceId: n.order_nsu, transactionNsu: n.transaction_nsu, slug: (n.invoice_slug ?? n.slug)!, receiptUrl: n.receipt_url });
    return Response.json(r);
  } catch (e) {
    console.error("[assinatura] webhook", (e as Error).message);
    return Response.json({ error: "falha ao confirmar" }, { status: 400 });
  }
}
