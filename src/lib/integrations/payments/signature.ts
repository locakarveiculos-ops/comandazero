import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayId } from "@/lib/types";

/**
 * Verificação de autenticidade do webhook de cada gateway. Sem o segredo configurado, o webhook é RECUSADO.
 *  - Mercado Pago: header x-signature "ts=...,v1=<hmac>" sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (MERCADOPAGO_WEBHOOK_SECRET)
 *  - Asaas: header asaas-access-token igual ao token cadastrado no painel do Asaas (ASAAS_WEBHOOK_TOKEN)
 *  - Pagar.me (Stone/Ton): header x-hub-signature "sha256=<hmac do corpo>" (PAGARME_WEBHOOK_SECRET)
 *  - InfinitePay e PagBank: HMAC-SHA256 do corpo em x-cz-signature, por proxy/assinatura própria
 *    (INFINITEPAY_WEBHOOK_SECRET / PAGBANK_WEBHOOK_SECRET). Conferir a documentação vigente antes de ativar.
 */
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

export const SECRET_ENV: Record<Exclude<GatewayId, "presencial">, string> = {
  mercadopago: "MERCADOPAGO_WEBHOOK_SECRET",
  asaas: "ASAAS_WEBHOOK_TOKEN",
  stone: "PAGARME_WEBHOOK_SECRET",
  infinitepay: "INFINITEPAY_WEBHOOK_SECRET",
  pagbank: "PAGBANK_WEBHOOK_SECRET",
};

export type VerifyResult = { ok: true } | { ok: false; status: 401 | 503; reason: string };

export function verifyWebhook(gateway: GatewayId, raw: string, h: Headers, url: URL, env: Record<string, string | undefined> = process.env): VerifyResult {
  if (gateway === "presencial") return { ok: false, status: 401, reason: "presencial não recebe webhook" };
  const secret = env[SECRET_ENV[gateway]];
  if (!secret) return { ok: false, status: 503, reason: `${SECRET_ENV[gateway]} não configurado` };

  if (gateway === "asaas") return safeEq(h.get("asaas-access-token") ?? "", secret) ? { ok: true } : { ok: false, status: 401, reason: "token inválido" };

  if (gateway === "mercadopago") {
    const parts = Object.fromEntries((h.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
    const dataId = url.searchParams.get("data.id") ?? (JSON.parse(raw || "{}")?.data?.id as string | undefined) ?? "";
    if (!parts.ts || !parts.v1) return { ok: false, status: 401, reason: "assinatura ausente" };
    if (Math.abs(Date.now() - Number(parts.ts) * (parts.ts.length <= 10 ? 1000 : 1)) > 300_000) return { ok: false, status: 401, reason: "assinatura expirada" };
    const manifest = `id:${String(dataId).toLowerCase()};request-id:${h.get("x-request-id") ?? ""};ts:${parts.ts};`;
    return safeEq(hmac(secret, manifest), parts.v1) ? { ok: true } : { ok: false, status: 401, reason: "assinatura inválida" };
  }

  if (gateway === "stone") {
    const sig = (h.get("x-hub-signature") ?? "").replace(/^sha256=/, "");
    return sig && safeEq(hmac(secret, raw), sig) ? { ok: true } : { ok: false, status: 401, reason: "assinatura inválida" };
  }

  const sig = h.get("x-cz-signature") ?? "";
  return sig && safeEq(hmac(secret, raw), sig) ? { ok: true } : { ok: false, status: 401, reason: "assinatura inválida" };
}
