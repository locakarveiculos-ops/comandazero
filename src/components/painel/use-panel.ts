"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDb, useIntegrations } from "@/lib/repositories";
import { subscribe } from "@/lib/repositories/events";
import { reloadFromStorageAsync } from "@/lib/repositories/store";
import { notifyOrder, triggerForStatus } from "@/lib/integrations/whatsapp/notify";
import { chime } from "@/lib/sound";
import type { Order, Tenant } from "@/lib/types";

/**
 * Escuta pedidos novos vindos de qualquer aba (cardápio do cliente, PDV) e de mudanças de status:
 * toca o alerta, mostra toast e dispara os gatilhos de WhatsApp da loja (uma vez por evento).
 */
export function useOrderAlerts(tenant: Tenant | undefined, opts: { sound?: boolean; notify?: boolean } = {}) {
  const settings = useIntegrations(tenant?.id);
  const soundOn = useDb((s) => s.soundOn);
  const ref = useRef({ tenant, settings, soundOn, opts });
  useEffect(() => {
    ref.current = { tenant, settings, soundOn, opts };
  });

  useEffect(() => {
    return subscribe((e, local) => {
      const { tenant: t, settings: s, soundOn: snd, opts: o } = ref.current;
      if (!t || !("tenantId" in e) || e.tenantId !== t.id) return;
      if (e.type === "table:call" && !local) {
        if (snd && o.sound !== false) chime("call");
        toast.warning(`Mesa ${e.table} pediu a conta`);
        return;
      }
      if (e.type === "table:call") return;
      const order = () => useDb.getState().orders.find((x) => x.id === e.orderId);
      if (e.type === "order:new") {
        if (local) return;
        if (snd && o.sound !== false) chime("order");
        // O aviso chega antes do estado gravado ser aplicado nesta aba: espera o pedido aparecer e só então usa.
        void waitFor(order).then((found) => {
          toast.success(`Novo pedido #${e.number}`, { description: describe(found) });
          if (o.notify) void send("recebido", found, t, s);
        });
      }
      if (e.type === "order:status" && local && o.notify) {
        const trig = triggerForStatus(e.status as Order["status"]);
        if (trig && trig !== "recebido") void send(trig, order(), t, s);
      }
    });
  }, []);
}

/** Recarrega o estado salvo até o item existir (recargas concorrentes de outras abas podem chegar fora de ordem). */
async function waitFor<T>(get: () => T | undefined, tries = 12): Promise<T | undefined> {
  for (let i = 0; i < tries; i++) {
    const v = get();
    if (v) return v;
    await reloadFromStorageAsync();
    if (!get()) await new Promise((r) => setTimeout(r, 120));
  }
  return get();
}

const describe = (o?: Order) => (o ? `${o.customer.name || "Balcão"} · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}`.slice(0, 120) : undefined);

async function send(trigger: Parameters<typeof notifyOrder>[0], order: Order | undefined, tenant: Tenant, settings: ReturnType<typeof useIntegrations>) {
  if (!order) return;
  const r = await notifyOrder(trigger, order, tenant, settings);
  if (r.sent) toast.message(`WhatsApp enviado para ${order.customer.name.split(" ")[0]}`, { description: `Gatilho: ${trigger}` });
}
