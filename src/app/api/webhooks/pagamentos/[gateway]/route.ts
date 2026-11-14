import { GATEWAYS } from "@/lib/integrations/payments/factory";
import { verifyWebhook } from "@/lib/integrations/payments/signature";
import { supabaseService } from "@/lib/supabase/server";
import type { GatewayId } from "@/lib/types";

/**
 * POST /api/webhooks/pagamentos/<gateway> — confirmação de pagamento.
 *  1. assinatura do gateway conferida ANTES de ler o conteúdo (sem segredo configurado: 503, nada é aceito);
 *  2. idempotência: (gateway, external_id, status) é único em payment_events — repetição responde 200 sem efeito;
 *  3. pedido marcado como pago só se o valor bater e o pedido existir; resposta 200 rápida.
 */
const json = (d: unknown, status = 200) => Response.json(d, { status });

export async function POST(req: Request, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params;
  const g = GATEWAYS[gateway as GatewayId];
  if (!g || gateway === "presencial") return json({ error: "gateway desconhecido" }, 404);
  const raw = await req.text();
  if (raw.length > 200_000) return json({ error: "payload" }, 413);

  const v = verifyWebhook(gateway as GatewayId, raw, req.headers, new URL(req.url));
  if (!v.ok) return json({ error: v.reason }, v.status);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "payload" }, 400);
  }
  const event = g.parseWebhook(body);
  if (!event) return json({ ignored: true });

  const sb = supabaseService();
  // Registro idempotente: a mesma confirmação repetida bate na restrição única e não faz nada.
  const { error: dup } = await sb.from("payment_events").insert({ gateway, external_id: event.chargeId, status: event.status, raw: body });
  if (dup) {
    if (dup.code === "23505") return json({ duplicate: true });
    console.error("[pagamento] registro", dup.message);
    return json({ error: "falha ao registrar" }, 500);
  }

  // chargeId = id do pedido (external_reference/order_nsu/code enviados na criação da cobrança).
  if (event.status === "paid" && /^[0-9a-f-]{36}$/.test(event.chargeId)) {
    const { data: order } = await sb.from("orders").select("id, tenant_id, deposit, total, payment_status").eq("id", event.chargeId).maybeSingle();
    if (order && order.payment_status !== "pago") {
      const status = order.deposit ? "parcial" : "pago";
      await sb.from("orders").update({ payment_status: status }).eq("id", order.id);
      await sb.from("payment_events").update({ order_id: order.id }).match({ gateway, external_id: event.chargeId, status: event.status });
      await sb
        .from("order_payments")
        .upsert({ tenant_id: order.tenant_id, order_id: order.id, method: "pix", gateway, amount: order.deposit ?? order.total, external_id: event.chargeId, status: "confirmed" }, { onConflict: "gateway,external_id", ignoreDuplicates: true });
    }
  }
  return json({ ok: true, chargeId: event.chargeId, status: event.status });
}
