import "server-only";
import webpush from "web-push";
import { STATUS_LABEL } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Notificação push (Web Push com VAPID). A chave privada fica só no servidor (VAPID_PRIVATE_KEY);
 * a pública vai ao navegador para criar a inscrição (NEXT_PUBLIC_VAPID_PUBLIC_KEY).
 * Inscrição expirada (404/410 do serviço de push) é apagada na hora do envio.
 */
export const pushReady = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured || !pushReady()) return pushReady();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@comandazero.com.br", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendAll(subs: Sub[], payload: PushPayload) {
  if (!subs.length || !setup()) return 0;
  const sb = supabaseService();
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error("[push]", code, (e as Error).message);
      }
    }),
  );
  if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
  if (sent) await sb.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", subs.filter((s) => !dead.includes(s.id)).map((s) => s.id));
  return sent;
}

/** Equipe da loja: "Novo pedido #123". Nunca derruba a criação do pedido. */
export async function pushNewOrder(o: { tenantId: string; slug: string; number: number; total: number; mode: string }) {
  try {
    const { data } = await supabaseService().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("kind", "staff").eq("tenant_id", o.tenantId);
    const total = o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return await sendAll((data ?? []) as Sub[], { title: `Novo pedido #${o.number}`, body: `${o.mode} · ${total}`, url: `/painel/${o.slug}/pedidos`, tag: `pedido-${o.number}` });
  } catch (e) {
    console.error("[push] pedido novo", (e as Error).message);
    return 0;
  }
}

const CUSTOMER_TEXT: Partial<Record<OrderStatus, string>> = {
  preparo: "Seu pedido entrou na cozinha.",
  pronto: "Seu pedido está pronto!",
  saiu: "Seu pedido saiu para entrega.",
  entregue: "Pedido entregue. Bom apetite!",
  cancelado: "Seu pedido foi cancelado. Fale com a loja se tiver dúvida.",
};

/** Cliente: cada etapa do próprio pedido. */
export async function pushOrderStatus(orderId: string, status: OrderStatus) {
  const text = CUSTOMER_TEXT[status];
  if (!text) return 0;
  try {
    const sb = supabaseService();
    const { data: o } = await sb.from("orders").select("number, track_token, tenants(slug, name)").eq("id", orderId).maybeSingle();
    if (!o) return 0;
    const t = o.tenants as unknown as { slug: string; name: string } | null;
    const { data } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("kind", "customer").eq("order_id", orderId);
    return await sendAll((data ?? []) as Sub[], {
      title: `${t?.name ?? "Seu pedido"} · ${STATUS_LABEL[status]}`,
      body: text,
      url: `/loja/${t?.slug}/pedido/${orderId}?t=${o.track_token}`,
      tag: `pedido-${orderId}`,
    });
  } catch (e) {
    console.error("[push] status", (e as Error).message);
    return 0;
  }
}
