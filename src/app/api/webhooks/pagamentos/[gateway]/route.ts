import { GATEWAYS } from "@/lib/integrations/payments/factory";
import type { GatewayId } from "@/lib/types";

/**
 * POST /api/webhooks/pagamentos/<gateway> — confirmação de pagamento dos gateways.
 * Fase 1: valida e normaliza o evento (os pedidos vivem no navegador; a confirmação é simulada no modal Pix).
 * Fase 2: confere a assinatura de cada gateway, atualiza orders.payment_status no Supabase e o Realtime avisa o painel.
 */
export async function POST(req: Request, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params;
  const g = GATEWAYS[gateway as GatewayId];
  if (!g) return Response.json({ error: "gateway desconhecido" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 200_000) return Response.json({ error: "payload" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "payload" }, { status: 400 });
  }
  const event = g.parseWebhook(body);
  if (!event) return Response.json({ ignored: true });
  return Response.json({ ok: true, chargeId: event.chargeId, status: event.status });
}
