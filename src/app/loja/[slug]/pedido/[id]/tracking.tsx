"use client";

import { Bike, Check, ChefHat, ClipboardCheck, MessageCircle, PackageCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { TenantTheme, displayFont } from "@/components/tenant-theme";
import { Skeleton } from "@/components/ui";
import { useHydrated } from "@/components/providers";
import { useOrder } from "@/lib/repositories";
import type { OrderStatus } from "@/lib/types";
import { MODE_LABEL, STATUS_LABEL, cn, fmtDateTime, fmtTime, money } from "@/lib/utils";

export function Tracking({ slug, id }: { slug: string; id: string }) {
  const { tenant } = useStoreTenant(slug);
  const hydrated = useHydrated();
  const order = useOrder(id);
  const [proof, setProof] = useState<string>("");

  if (!tenant || !hydrated) return <Skeleton className="m-4 h-80" />;
  if (!order || order.tenantId !== tenant.id)
    return (
      <TenantTheme tenant={tenant} className="grid min-h-screen place-items-center p-6 text-center">
        <main id="conteudo">
          <h1 className="text-2xl font-bold">Pedido não encontrado neste aparelho</h1>
          <Link href={`/loja/${slug}`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-ink">
            Voltar ao cardápio
          </Link>
        </main>
      </TenantTheme>
    );

  const delivery = order.mode === "delivery";
  const steps: { key: OrderStatus; label: string; icon: typeof Check }[] = [
    { key: "recebido", label: "Recebido", icon: ClipboardCheck },
    { key: "preparo", label: order.mode === "encomenda" ? "Em produção" : "Na cozinha", icon: ChefHat },
    { key: delivery ? "saiu" : "pronto", label: delivery ? "Saiu para entrega" : order.mode === "mesa" ? "A caminho da mesa" : "Pronto para retirar", icon: delivery ? Bike : PackageCheck },
    { key: "entregue", label: "Entregue", icon: Check },
  ];
  // Posição do status na sequência; "pronto" num delivery ainda conta como cozinha (passo 2) até sair.
  const RANK: Record<OrderStatus, number> = { recebido: 0, preparo: 1, pronto: delivery ? 1 : 2, saiu: 2, entregue: 3, cancelado: -1 };
  const idx = RANK[order.status];
  const reached = (i: number) => {
    const at = order.history.find((h) => h.status === steps[i].key)?.at;
    return { done: i <= idx, at };
  };
  const msg = encodeURIComponent(`Olá! Sobre meu pedido #${order.number} (${order.customer.name}).`);

  const onProof = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4_000_000) return toast.error("Arquivo acima de 4 MB.");
    setProof(f.name);
    toast.success("Comprovante enviado para a loja conferir.");
  };

  return (
    <TenantTheme tenant={tenant} className="min-h-screen">
      <main id="conteudo" className="mx-auto grid max-w-xl gap-5 p-4 pb-16">
        <Link href={`/loja/${slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text">
          ← {tenant.name}
        </Link>
        <section className="rounded-3xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">
            {MODE_LABEL[order.mode]}
            {order.table ? ` · Mesa ${order.table}` : ""} · {fmtDateTime(order.createdAt)}
          </p>
          <h1 className={cn("mt-1 text-3xl font-bold text-ink", displayFont(tenant))}>Pedido #{order.number}</h1>
          <p className="mt-1 text-ink" aria-live="polite">
            {order.status === "cancelado" ? "Este pedido foi cancelado." : <>Status: <b>{STATUS_LABEL[order.status]}</b></>}
          </p>
          {order.paymentStatus === "pendente" && order.paymentMethod === "pix" && <p className="mt-3 rounded-xl bg-amber-100 p-3 text-sm font-semibold text-amber-950">Aguardando confirmação do Pix. Se já pagou, envie o comprovante abaixo.</p>}
          {order.scheduledFor && <p className="mt-3 rounded-xl bg-highlight/15 p-3 text-sm text-ink">Retirada agendada para <b>{fmtDateTime(order.scheduledFor)}</b></p>}

          <ol className="mt-6 grid gap-0" aria-label="Andamento do pedido">
            {steps.map((s, i) => {
              const r = reached(i);
              const isCurrent = i === idx;
              return (
                <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
                  {i < steps.length - 1 && <span className={cn("absolute left-[21px] top-11 h-[calc(100%-44px)] w-0.5", i < idx ? "bg-secondary" : "bg-line")} aria-hidden />}
                  <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-full border-2 transition", r.done ? "border-secondary bg-secondary text-white" : "border-line bg-surface text-muted", isCurrent && "ring-4 ring-secondary/25")}>
                    <s.icon className={cn("size-5", isCurrent && order.status !== "entregue" && "animate-pulse")} aria-hidden />
                  </span>
                  <div className="pt-2.5">
                    <p className={cn("font-semibold", r.done ? "text-ink" : "text-muted")}>{s.label}</p>
                    {r.at && <p className="text-xs text-muted">{fmtTime(r.at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5 text-ink" aria-labelledby="resumo">
          <h2 id="resumo" className="font-bold">
            Resumo
          </h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {order.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span>
                  {i.qty}× {i.name}
                  {i.options.length > 0 && <span className="block text-xs text-muted">{i.options.map((o) => o.name).join(", ")}</span>}
                </span>
                <span className="tabular-nums">{money(i.unitPrice * i.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(order.total)}</span>
          </p>
          {order.deposit ? <p className="mt-1 text-sm text-muted">Sinal: {money(order.deposit)} · restante {money(order.total - order.deposit)} na retirada</p> : null}
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`https://wa.me/${tenant.whatsapp}?text=${msg}`} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-5 font-semibold text-white">
            <MessageCircle className="size-5" aria-hidden /> Chamar no WhatsApp
          </a>
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 font-semibold text-ink focus-within:outline focus-within:outline-3 focus-within:outline-accent-text">
            <Upload className="size-5" aria-hidden /> {proof ? "Comprovante enviado" : "Enviar comprovante"}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onProof(e.target.files?.[0])} />
          </label>
        </div>
      </main>
    </TenantTheme>
  );
}
