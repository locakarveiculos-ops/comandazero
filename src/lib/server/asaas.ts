import "server-only";
import { HttpError } from "@/lib/server/http";

/**
 * Cobrança da assinatura da ComandaZero (lojista → plataforma) pelo Asaas.
 * ASAAS_API_KEY decide o ambiente: chave "$aact_hmlg_..." = sandbox; "$aact_prod_..." = produção.
 * ASAAS_ENV=production força a URL de produção. Sem chave, a assinatura fica indisponível (503), nunca simulada.
 */
const base = () => (process.env.ASAAS_ENV === "production" || process.env.ASAAS_API_KEY?.startsWith("$aact_prod") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

export const asaasConfigured = () => !!process.env.ASAAS_API_KEY;

async function call<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new HttpError(503, "Pagamento da assinatura ainda não configurado. Fale com o suporte.");
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { access_token: key, "content-type": "application/json", "user-agent": "ComandaZero" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await r.json().catch(() => ({}))) as { errors?: { description: string }[] } & T;
  if (!r.ok) {
    console.error("[asaas]", r.status, data?.errors?.map((e) => e.description).join("; "));
    throw new HttpError(502, data?.errors?.[0]?.description ?? "O meio de pagamento não respondeu. Tente de novo.");
  }
  return data;
}

export type AsaasBilling = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export async function ensureCustomer(c: { name: string; email: string; cpfCnpj: string; phone?: string; externalReference: string }, existing?: string | null) {
  if (existing) return existing;
  const r = await call<{ id: string }>("/customers", { ...c, notificationDisabled: false });
  return r.id;
}

/** Assinatura recorrente. O lojista escolhe Pix, boleto ou cartão na fatura do Asaas (UNDEFINED). */
export async function createSubscription(p: { customer: string; value: number; cycle: "MONTHLY" | "YEARLY"; description: string; externalReference: string }) {
  const nextDueDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return call<{ id: string; status: string }>("/subscriptions", { billingType: "UNDEFINED", nextDueDate, ...p });
}

/** Primeira cobrança da assinatura (link da fatura para pagar agora). */
export async function firstPaymentUrl(subscriptionId: string) {
  const r = await call<{ data: { id: string; invoiceUrl: string; status: string }[] }>(`/subscriptions/${subscriptionId}/payments?limit=1`);
  return r.data?.[0]?.invoiceUrl ?? null;
}

export async function cancelSubscription(subscriptionId: string) {
  return call<{ deleted: boolean }>(`/subscriptions/${subscriptionId}`, undefined, "DELETE");
}
