"use client";

import { ArrowLeft, ArrowRight, Bell, BellOff, Maximize, Minimize, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-switcher";
import { HelpButton } from "@/components/training/help-button";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { setOrderStatus, useDb, useOrders } from "@/lib/repositories";
import { mutate } from "@/lib/repositories/store";
import type { Order, OrderStatus } from "@/lib/types";
import { useTick } from "@/lib/use-now";
import { MODE_LABEL, cn, elapsedMinutes, fmtTime, waitLevel } from "@/lib/utils";

const COLS: { status: OrderStatus; title: string; next?: OrderStatus; prev?: OrderStatus; action: string }[] = [
  { status: "recebido", title: "Fila", next: "preparo", action: "Começar" },
  { status: "preparo", title: "Preparando", next: "pronto", prev: "recebido", action: "Pronto" },
  { status: "pronto", title: "Pronto para retirar / entregar", next: "entregue", prev: "preparo", action: "Entregue" },
];

const LEVEL = {
  ok: "bg-[#16845b] text-white",
  warn: "bg-[#e0a43a] text-[#2b1a05]",
  late: "bg-[#b43838] text-white",
};

export default function KdsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const orders = useOrders(tenant?.id);
  const soundOn = useDb((s) => s.soundOn);
  const now = useTick();
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!tenant) return null;
  const active = orders.filter((o) => ["recebido", "preparo", "pronto"].includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));

  return (
    <div className="flex min-h-screen flex-col bg-[#08162d] text-[#faf8f5]">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2">
        <Link href={`/painel/${slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-white/10">
          <ArrowLeft className="size-4" aria-hidden /> Painel
        </Link>
        <span className="hidden sm:block"><BrandLogo variant="symbol" height={28} /></span>
        <h1 className="cz-heading flex-1 text-xl font-bold">
          KDS · {tenant.name}
        </h1>
        <p className="hidden items-center gap-3 text-xs sm:flex" aria-label="Legenda de tempo" data-tour="kds-legenda">
          <span className="flex items-center gap-1"><i className="size-3 rounded-full bg-[#16845b]" /> &lt; 10 min</span>
          <span className="flex items-center gap-1"><i className="size-3 rounded-full bg-[#e0a43a]" /> &lt; 20 min</span>
          <span className="flex items-center gap-1"><i className="size-3 rounded-full bg-[#b43838]" /> &gt; 20 min</span>
        </p>
        <button type="button" onClick={() => mutate((s) => ({ soundOn: !s.soundOn }))} aria-pressed={soundOn} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-semibold hover:bg-white/10">
          {soundOn ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />} Som
        </button>
        <HelpButton slug={slug} className="border-white/20 bg-transparent text-white hover:bg-white/10" />
        <button type="button" onClick={toggleFs} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-semibold hover:bg-white/10">
          {full ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} Tela cheia
        </button>
      </header>

      <main id="conteudo" className="grid flex-1 gap-3 p-3 md:grid-cols-3">
        {COLS.map((col) => {
          const list = active.filter((o) => o.status === col.status);
          return (
            <section key={col.status} data-tour={`kds-${col.status}`} className="flex min-h-0 flex-col rounded-[14px] bg-[#132747]" aria-labelledby={`col-${col.status}`}>
              <h2 id={`col-${col.status}`} className="flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-wider text-[#c5cbd5]">
                {col.title} <span className="rounded-full bg-white/10 px-2.5 py-0.5 tabular-nums text-white">{list.length}</span>
              </h2>
              <ul className="grid flex-1 content-start gap-3 overflow-y-auto p-3 pt-0" aria-live="polite">
                {list.map((o) => (
                  <Ticket key={o.id} order={o} now={now} col={col} />
                ))}
                {!list.length && <li className="rounded-[10px] border border-dashed border-[#354762] p-6 text-center text-sm text-[#c5cbd5]">Nada aqui</li>}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function Ticket({ order, now, col }: { order: Order; now: number; col: (typeof COLS)[number] }) {
  const min = elapsedMinutes(order.createdAt, now);
  const level = waitLevel(min);
  return (
    <li className={cn("overflow-hidden rounded-[10px] bg-[#faf8f5] text-[#0b1f40]", !order.seen && "flash-new")}>
      <div className={cn("flex items-center justify-between px-3 py-2 font-bold", LEVEL[level])}>
        <span className="text-lg">#{order.number}</span>
        <span className="tabular-nums" aria-label={`${min} minutos de espera`}>
          {min} min
        </span>
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#526076]">
          {MODE_LABEL[order.mode]}
          {order.table ? ` · Mesa ${order.table}` : ""} · {fmtTime(order.createdAt)} · {order.customer.name || "Balcão"}
        </p>
        <ul className="mt-2 grid gap-1.5">
          {order.items.map((i) => (
            <li key={i.key} className="leading-snug">
              <span className="text-lg font-extrabold">{i.qty}×</span> <span className="font-semibold">{i.name}</span>
              {i.options.length > 0 && <span className="block pl-6 text-sm text-[#526076]">{i.options.map((x) => x.name).join(" · ")}</span>}
              {i.cake?.kg ? <span className="block pl-6 text-sm text-[#526076]">{i.cake.kg} kg · {i.cake.massa} · {i.cake.recheio} · {i.cake.cobertura}{i.cake.frase ? ` · “${i.cake.frase}”` : ""}</span> : null}
              {i.notes && <span className="mt-0.5 block rounded bg-[#f8ecdc] px-2 py-0.5 text-sm font-semibold text-[#7d4710]">⚠ {i.notes}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          {col.prev && (
            <button type="button" onClick={() => setOrderStatus(order.id, col.prev!)} aria-label={`Voltar pedido ${order.number}`} className="grid size-12 place-items-center rounded-[10px] bg-[#e8dcc8] text-[#0b1f40] hover:brightness-95">
              <Undo2 className="size-5" aria-hidden />
            </button>
          )}
          {col.next && (
            <button
              type="button"
              onClick={() => setOrderStatus(order.id, col.status === "pronto" && order.mode === "delivery" ? "saiu" : col.next!)}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#0b1f40] text-base font-bold text-white hover:bg-[#132747]"
            >
              {col.status === "pronto" && order.mode === "delivery" ? "Saiu p/ entrega" : col.action} <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
