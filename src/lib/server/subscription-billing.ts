import "server-only";
import { checkPayment } from "@/lib/server/infinitepay";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Confirma uma fatura de assinatura: consulta /payment_check da InfinitePay e, se pago e o valor bater,
 * libera o plano (confirm_subscription_invoice). Usado pelo webhook e pela volta do checkout (redirect).
 * Nunca confia só no aviso recebido: o webhook da InfinitePay não é assinado.
 */
export async function settleInvoice(p: { invoiceId: string; transactionNsu: string; slug: string; receiptUrl?: string | null }) {
  if (!/^[0-9a-f-]{36}$/.test(p.invoiceId) || !p.transactionNsu || !p.slug) return { ok: false as const, reason: "dados incompletos" };
  const sb = supabaseService();
  const { data: inv } = await sb.from("subscription_invoices").select("id, status, amount_cents").eq("id", p.invoiceId).maybeSingle();
  if (!inv) return { ok: false as const, reason: "fatura desconhecida" };
  if (inv.status === "paid") return { ok: true as const, already: true };

  const check = await checkPayment({ orderNsu: inv.id, transactionNsu: p.transactionNsu, slug: p.slug });
  if (!check.success || !check.paid) return { ok: false as const, reason: "pagamento não confirmado pela InfinitePay" };
  // amount = valor do link (sem juros do parcelamento pagos pelo comprador). Precisa ser o da fatura.
  if (!Number.isSafeInteger(check.amount) || check.amount !== inv.amount_cents) return { ok: false as const, reason: "valor pago menor que a fatura" };

  const { data: done, error } = await sb.rpc("confirm_subscription_invoice", {
    p_invoice: inv.id,
    p_transaction: p.transactionNsu,
    p_slug: p.slug,
    p_method: check.capture_method ?? null,
    p_paid_cents: check.paid_amount ?? check.amount ?? inv.amount_cents,
    // O comprovante recebido no webhook não é autenticado pelo payment_check.
    p_receipt: null,
  });
  if (error) throw error;
  return { ok: true as const, already: !done };
}
