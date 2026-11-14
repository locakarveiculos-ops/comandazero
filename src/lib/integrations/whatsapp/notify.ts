"use client";

// Gatilhos automáticos de pedido no WhatsApp da loja (lado do painel). O envio real passa por /api/whatsapp/send.
import type { IntegrationSettings, Order, Tenant, WhatsappTrigger } from "@/lib/types";
import { fillTemplate, money } from "@/lib/utils";
import type { Card } from "./card";
import { orderReceivedCard } from "./bot";

export const WA_BLOB_KEY = (slug: string) => `cp-wa-channel:${slug}`;

export function readChannelBlob(slug: string) {
  try {
    return localStorage.getItem(WA_BLOB_KEY(slug)) || "";
  } catch {
    return "";
  }
}

export function writeChannelBlob(slug: string, blob: string | null) {
  try {
    if (blob) localStorage.setItem(WA_BLOB_KEY(slug), blob);
    else localStorage.removeItem(WA_BLOB_KEY(slug));
  } catch {
    /* sem storage: canal some ao fechar a aba */
  }
}

export const triggerForStatus = (status: Order["status"]): WhatsappTrigger | null =>
  status === "recebido" ? "recebido" : status === "preparo" ? "preparo" : status === "pronto" ? "pronto" : status === "saiu" ? "saiu" : status === "entregue" ? "pos_venda" : null;

export function buildOrderCard(trigger: WhatsappTrigger, order: Order, tenant: Tenant, settings: IntegrationSettings, origin: string): Card {
  const text = fillTemplate(settings.whatsapp.triggers[trigger].template, {
    cliente: order.customer.name.split(" ")[0] || "cliente",
    numero: String(order.number),
    loja: tenant.name,
    total: money(order.total),
    link: `${origin}/loja/${tenant.slug}/pedido/${order.id}`,
  });
  if (trigger !== "recebido") return { text };
  return orderReceivedCard(text, order.id, order.mode === "delivery").card;
}

export type NotifyResult = { sent: boolean; reason?: string };

// Várias abas do painel recebem o mesmo evento: só a primeira que "pegar" o envio manda a mensagem.
function claim(orderId: string, trigger: WhatsappTrigger) {
  const k = `cp-wa-sent:${orderId}:${trigger}`;
  try {
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export async function notifyOrder(trigger: WhatsappTrigger, order: Order, tenant: Tenant, settings: IntegrationSettings | undefined): Promise<NotifyResult> {
  if (!settings?.whatsapp.enabled || !settings.whatsapp.triggers[trigger]?.enabled) return { sent: false, reason: "gatilho desligado" };
  if (!order.customer.phone) return { sent: false, reason: "pedido sem WhatsApp" };
  const blob = readChannelBlob(tenant.slug);
  if (!blob) return { sent: false, reason: "WhatsApp da loja não conectado" };
  if (!claim(order.id, trigger)) return { sent: false, reason: "já enviado" };
  const card = buildOrderCard(trigger, order, tenant, settings, window.location.origin);
  try {
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: tenant.slug, blob, to: order.customer.phone, card }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    return r.ok ? { sent: true } : { sent: false, reason: d.error || `HTTP ${r.status}` };
  } catch {
    return { sent: false, reason: "sem conexão" };
  }
}
