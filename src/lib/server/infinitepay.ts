import "server-only";
import { HttpError } from "@/lib/server/http";

/**
 * Recebimento da assinatura da ComandaZero (lojista → plataforma) pela InfinitePay, Checkout Integrado.
 * Docs: https://www.infinitepay.io/checkout-documentacao
 *  - POST /links devolve { url } do checkout (Pix ou cartão até 12x). Valores em centavos, mínimo R$ 1,00.
 *  - O webhook NÃO tem assinatura: todo aviso é confirmado em POST /payment_check antes de liberar o plano.
 *  - Não há sandbox: links criados são reais.
 * INFINITEPAY_HANDLE = InfiniteTag sem "$" (padrão: conta do dono da plataforma).
 * INFINITEPAY_API_KEY (opcional, "inchk_...") liga as opções por link (validade, link de uso único).
 */
const BASE = "https://api.checkout.infinitepay.io";
export const PLATFORM_HANDLE = (process.env.INFINITEPAY_HANDLE || "marco-boggian").replace(/^\$/, "").trim();

type LinkInput = {
  orderNsu: string;
  description: string;
  amountCents: number;
  redirectUrl: string;
  webhookUrl: string;
  customer?: { name?: string; email?: string; phone?: string };
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFINITEPAY_API_KEY;
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "X-Api-Key": key } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await r.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!r.ok) {
    console.error("[infinitepay]", path, r.status, JSON.stringify(data).slice(0, 300));
    // Conta da plataforma sem "Habilitar checkout integrado" ligado no app/conta web da InfinitePay.
    if (data.error === "external_checkout_not_enabled") throw new HttpError(503, "O pagamento online da assinatura está sendo ativado. Fale com o suporte para assinar agora.");
    throw new HttpError(502, "O checkout da InfinitePay não respondeu. Tente de novo em instantes.");
  }
  return data;
}

/** Cria o link de checkout da fatura. Com API Key: link de uso único que vence em 7 dias. */
export async function createCheckoutLink(i: LinkInput) {
  if (i.amountCents < 100) throw new HttpError(422, "Valor mínimo da InfinitePay é R$ 1,00.");
  const phone = i.customer?.phone?.replace(/\D/g, "");
  const body = {
    handle: PLATFORM_HANDLE,
    order_nsu: i.orderNsu,
    redirect_url: i.redirectUrl,
    webhook_url: i.webhookUrl,
    items: [{ quantity: 1, price: i.amountCents, description: i.description.slice(0, 120) }],
    customer: i.customer
      ? { name: i.customer.name || undefined, email: i.customer.email || undefined, phone_number: phone ? `+${phone.startsWith("55") ? phone : `55${phone}`}` : undefined }
      : undefined,
    ...(process.env.INFINITEPAY_API_KEY ? { options: { single_payment: true, valid_until: new Date(Date.now() + 7 * 86_400_000).toISOString() } } : {}),
  };
  const r = await post<{ url?: string; link?: string }>("/links", body);
  const url = r.url ?? r.link;
  if (!url) throw new HttpError(502, "A InfinitePay não devolveu o link de pagamento.");
  return url;
}

export type PaymentCheck = { success: boolean; paid: boolean; amount?: number; paid_amount?: number; installments?: number; capture_method?: string };

/**
 * Confirmação oficial do pagamento. paid=true só quando order_nsu, transação e fatura batem.
 * Transação desconhecida responde 404 {"success":false,"message":"Not found"} (verificado em 15/11/2026):
 * é "não pago", não falha do provedor — o aviso não deve ser reenviado para sempre.
 */
export async function checkPayment(p: { orderNsu: string; transactionNsu: string; slug: string }): Promise<PaymentCheck> {
  const r = await fetch(`${BASE}/payment_check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: PLATFORM_HANDLE, order_nsu: p.orderNsu, transaction_nsu: p.transactionNsu, slug: p.slug }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await r.json().catch(() => ({}))) as Partial<PaymentCheck>;
  if (r.status === 404) return { success: false, paid: false };
  if (!r.ok) throw new HttpError(502, `Consulta de pagamento falhou (HTTP ${r.status}).`);
  const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : undefined);
  return {
    success: d.success === true,
    paid: d.paid === true,
    amount: int(d.amount),
    paid_amount: int(d.paid_amount),
    installments: int(d.installments),
    capture_method: typeof d.capture_method === "string" ? d.capture_method : undefined,
  };
}
