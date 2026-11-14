import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/assinatura — eventos de cobrança do Asaas para a assinatura da plataforma.
 *  1. token do header asaas-access-token conferido (ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN) antes de ler o corpo;
 *  2. idempotente pelo id do evento (payment_events gateway='asaas-assinatura');
 *  3. PAYMENT_RECEIVED/CONFIRMED → active; PAYMENT_OVERDUE → overdue (só leitura após 7 dias); SUBSCRIPTION_DELETED → canceled.
 */
const json = (d: unknown, status = 200) => Response.json(d, { status });
const sha = (s: string) => createHash("sha256").update(s).digest();

type AsaasEvent = {
  id?: string;
  event: string;
  payment?: { id: string; subscription?: string; externalReference?: string; dueDate?: string; status?: string };
  subscription?: { id: string; externalReference?: string };
};

export async function POST(req: Request) {
  const secret = process.env.ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN;
  if (!secret) return json({ error: "ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN não configurado" }, 503);
  if (!timingSafeEqual(sha(req.headers.get("asaas-access-token") ?? ""), sha(secret))) return json({ error: "token inválido" }, 401);
  const raw = await req.text();
  if (raw.length > 100_000) return json({ error: "payload" }, 413);
  let ev: AsaasEvent;
  try {
    ev = JSON.parse(raw);
  } catch {
    return json({ error: "payload" }, 400);
  }

  const subId = ev.payment?.subscription ?? ev.subscription?.id;
  if (!subId) return json({ ignored: true });
  const sb = supabaseService();
  const eventId = ev.id ?? `${ev.event}:${ev.payment?.id ?? subId}`;
  const { error: dup } = await sb.from("payment_events").insert({ gateway: "asaas-assinatura", external_id: eventId, status: ev.event, raw: ev });
  if (dup) return dup.code === "23505" ? json({ duplicate: true }) : json({ error: "falha ao registrar" }, 500);

  const { data: sub } = await sb.from("subscriptions").select("tenant_id, cycle").eq("asaas_subscription_id", subId).maybeSingle();
  if (!sub) return json({ ignored: true, reason: "assinatura desconhecida" });

  const now = new Date();
  let patch: Record<string, unknown> | null = null;
  if (ev.event === "PAYMENT_RECEIVED" || ev.event === "PAYMENT_CONFIRMED") {
    const end = new Date(now);
    if (sub.cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    patch = { status: "active", overdue_since: null, current_period_end: end.toISOString() };
  } else if (ev.event === "PAYMENT_OVERDUE") {
    patch = { status: "overdue", overdue_since: ev.payment?.dueDate ? new Date(`${ev.payment.dueDate}T00:00:00-03:00`).toISOString() : now.toISOString() };
  } else if (ev.event === "SUBSCRIPTION_DELETED" || ev.event === "SUBSCRIPTION_INACTIVATED") {
    patch = { status: "canceled" };
  }
  if (!patch) return json({ ignored: true });

  await sb.from("subscriptions").update({ ...patch, updated_at: now.toISOString() }).eq("tenant_id", sub.tenant_id);
  await sb.from("audit_log").insert({ action: "assinatura.webhook", tenant_id: sub.tenant_id, details: { evento: ev.event, ...patch } });
  return json({ ok: true });
}
