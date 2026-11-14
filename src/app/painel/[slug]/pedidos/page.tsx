"use client";

import { Check, ChefHat, MessageCircle, PackageCheck, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { PrintButton } from "@/components/painel/receipt";
import { Badge, Button, Empty } from "@/components/ui";
import { markOrderPaid, markOrdersSeen, setOrderStatus, useOrders } from "@/lib/repositories";
import type { Order, OrderStatus } from "@/lib/types";
import { useMinute } from "@/lib/use-now";
import { MODE_LABEL, STATUS_LABEL, cn, elapsedMinutes, fmtDateTime, formatPhone, money } from "@/lib/utils";

const FILTERS: { id: string; label: string; match: (o: Order) => boolean }[] = [
  { id: "ativos", label: "Em andamento", match: (o) => !["entregue", "cancelado"].includes(o.status) },
  { id: "encomendas", label: "Encomendas", match: (o) => o.mode === "encomenda" && o.status !== "cancelado" },
  { id: "todos", label: "Todos", match: () => true },
];

export default function PedidosPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const orders = useOrders(tenant?.id);
  const [filter, setFilter] = useState("ativos");
  const list = useMemo(() => orders.filter(FILTERS.find((f) => f.id === filter)!.match).slice(0, 80), [orders, filter]);

  const now = useMinute();
  // Ao abrir a tela, os pedidos novos deixam de contar no selo do menu (mas continuam piscando por alguns segundos).
  useEffect(() => {
    if (!tenant) return;
    const t = setTimeout(() => markOrdersSeen(tenant.id), 6000);
    return () => clearTimeout(t);
  }, [tenant, orders.length]);

  if (!tenant) return null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-cz-muted">Chegam em tempo real do cardápio, das mesas e do PDV. Deixe esta aba aberta.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-cz-surface p-1 ring-1 ring-cz-border" role="tablist" aria-label="Filtrar pedidos" data-tour="pedidos-filtros">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", filter === f.id ? "bg-brand text-brand-ink" : "text-cz-muted")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<ChefHat className="size-8 text-cz-muted" aria-hidden />} title="Nenhum pedido em andamento">
          Abra o cardápio em outra aba e faça um pedido: ele aparece aqui na hora, com som.
        </Empty>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-live="polite">
          {list.map((o) => (
            <li key={o.id} className={cn("rounded-2xl border bg-cz-surface p-4", !o.seen ? "flash-new border-[#c2410c]" : "border-cz-border")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">
                    #{o.number} <span className="font-normal text-cz-muted">· {o.customer.name || "Balcão"}</span>
                  </p>
                  <p className="text-xs text-cz-muted">
                    {fmtDateTime(o.createdAt)} · há {elapsedMinutes(o.createdAt, now)} min
                    {o.customer.phone && ` · ${formatPhone(o.customer.phone)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!o.seen && <Badge tone="amber">Novo</Badge>}
                  <Badge tone="blue">
                    {MODE_LABEL[o.mode]}
                    {o.table ? ` ${o.table}` : ""}
                  </Badge>
                  <Badge tone={o.status === "cancelado" ? "red" : o.status === "entregue" ? "green" : "neutral"}>{STATUS_LABEL[o.status]}</Badge>
                  <Badge tone={o.paymentStatus === "pago" ? "green" : o.paymentStatus === "parcial" ? "amber" : "red"}>{o.paymentStatus === "pago" ? "Pago" : o.paymentStatus === "parcial" ? "Sinal pago" : "A receber"}</Badge>
                </div>
              </div>
              <ul className="mt-3 grid gap-1 text-sm">
                {o.items.map((i) => (
                  <li key={i.key}>
                    <b>{i.qty}×</b> {i.name}
                    {i.options.length > 0 && <span className="text-cz-muted"> · {i.options.map((x) => x.name).join(", ")}</span>}
                    {i.cake?.kg ? <span className="text-cz-muted"> · {i.cake.kg} kg {i.cake.massa}/{i.cake.recheio}{i.cake.frase ? ` · “${i.cake.frase}”` : ""}</span> : null}
                    {i.notes && <span className="block text-xs italic text-cz-warning">Obs: {i.notes}</span>}
                  </li>
                ))}
              </ul>
              {o.scheduledFor && <p className="mt-2 text-sm font-semibold text-cz-info">Retirada: {fmtDateTime(o.scheduledFor)}</p>}
              {o.address && <p className="mt-2 text-sm text-cz-muted">📍 {o.address.street}, {o.address.number} · {o.address.district}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cz-border pt-3" data-tour="pedido-acoes">
                <p className="font-bold tabular-nums">{money(o.total)}</p>
                <div className="flex flex-wrap gap-2">
                  {o.customer.phone && (
                    <a href={`https://wa.me/${o.customer.phone}`} target="_blank" rel="noopener" aria-label={`WhatsApp de ${o.customer.name}`} className="grid size-11 place-items-center rounded-full bg-cz-success/10 text-cz-success hover:bg-cz-success/20">
                      <MessageCircle className="size-4" aria-hidden />
                    </a>
                  )}
                  <PrintButton order={o} tenant={tenant} />
                  {o.paymentStatus !== "pago" && o.status !== "cancelado" && (
                    <Button size="sm" variant="secondary" onClick={() => markOrderPaid(o.id, [{ method: o.paymentMethod, amount: o.total }])}>
                      Receber
                    </Button>
                  )}
                  <NextAction order={o} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NextAction({ order }: { order: Order }) {
  const next: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Check }>> = {
    recebido: { to: "preparo", label: "Aceitar e preparar", icon: ChefHat },
    preparo: { to: "pronto", label: "Marcar pronto", icon: PackageCheck },
    pronto: order.mode === "delivery" ? { to: "saiu", label: "Saiu p/ entrega", icon: PackageCheck } : { to: "entregue", label: "Entregue", icon: Check },
    saiu: { to: "entregue", label: "Entregue", icon: Check },
  };
  const n = next[order.status];
  return (
    <>
      {order.status === "recebido" && (
        <Button size="sm" variant="ghost" className="text-cz-error" onClick={() => setOrderStatus(order.id, "cancelado")}>
          <X className="size-4" aria-hidden /> Recusar
        </Button>
      )}
      {n && (
        <Button size="sm" variant="brand" onClick={() => setOrderStatus(order.id, n.to)}>
          <n.icon className="size-4" aria-hidden /> {n.label}
        </Button>
      )}
    </>
  );
}
