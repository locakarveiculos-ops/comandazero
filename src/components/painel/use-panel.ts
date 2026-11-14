"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDb, useIntegrations } from "@/lib/repositories";
import { subscribe } from "@/lib/repositories/events";
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
        if (!local) {
          if (snd && o.sound !== false) chime("order");
          toast.success(`Novo pedido #${e.number}`, { description: describe(order()) });
        }
        // Só a aba que criou o pedido OU o painel (quando o pedido veio do cliente) envia, evitando mensagem duplicada.
        if (o.notify && !local) void send("recebido", order(), t, s);
      }
      if (e.type === "order:status" && local && o.notify) {
        const trig = triggerForStatus(e.status as Order["status"]);
        if (trig && trig !== "recebido") void send(trig, order(), t, s);
      }
    });
  }, []);
}

const describe = (o?: Order) => (o ? `${o.customer.name || "Balcão"} · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}`.slice(0, 120) : undefined);

async function send(trigger: Parameters<typeof notifyOrder>[0], order: Order | undefined, tenant: Tenant, settings: ReturnType<typeof useIntegrations>) {
  if (!order) return;
  const r = await notifyOrder(trigger, order, tenant, settings);
  if (r.sent) toast.message(`WhatsApp enviado para ${order.customer.name.split(" ")[0]}`, { description: `Gatilho: ${trigger}` });
}
