"use client";

import { ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { changeOrderStatus } from "@/lib/repositories/engine";
import { markStep, updateProgress, useProgress } from "@/lib/training/progress";
import type { Order, Tenant } from "@/lib/types";
import { useTestOrder } from "./activation-checklist";

/** "Fazer pedido de teste" para o estado vazio da Tela da Cozinha. */
export function TestOrderButton({ tenant, className = "" }: { tenant: Tenant; className?: string }) {
  const test = useTestOrder(tenant);
  return (
    <button
      type="button"
      onClick={test.run}
      disabled={test.busy}
      className={`inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-[#d4af6b] px-4 text-base font-bold text-[#0b1f40] transition hover:brightness-105 disabled:opacity-60 ${className}`}
    >
      <FlaskConical className="size-5" aria-hidden /> Fazer pedido de teste
    </button>
  );
}

/**
 * Guia do pedido de teste na Tela da Cozinha: diz o próximo toque (Começar -> Pronto) e, no fim,
 * tira o pedido do faturamento (cancelado) e leva ao treino de cobrança na Frente de Caixa.
 */
export function TestGuide({ tenant, orders }: { tenant: Tenant; orders: Order[] }) {
  const progress = useProgress(tenant.slug);
  const t = progress.testOrder;
  if (!t) return null;
  const order = orders.find((o) => o.id === t.id);
  const status = order?.status;
  const finish = async () => {
    try {
      // Cancelado = fora do faturamento e do Dashboard (é só treino).
      if (order && status !== "cancelado") await changeOrderStatus(tenant, order.id, "cancelado");
    } catch (e) {
      toast.error((e as Error).message);
    }
    markStep(tenant.slug, "pedido-teste");
    updateProgress(tenant.slug, (p) => ({ ...p, testOrder: undefined }));
  };
  const done = status === "pronto" || status === "saiu" || status === "entregue" || status === "cancelado" || (!order && orders.length > 0);
  const text = !order
    ? "Aguardando o pedido de teste chegar…"
    : status === "recebido"
      ? `Passo 1 de 3: o pedido de teste #${t.number} chegou na Fila. Toque em “Começar”.`
      : status === "preparo"
        ? "Passo 2 de 3: agora ele está sendo preparado. Toque em “Pronto”."
        : "Passo 3 de 3: pronto! A cozinha está treinada. Falta cobrar na Frente de Caixa.";
  return (
    <div role="status" aria-live="polite" className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border-2 border-[#d4af6b] bg-[#132747] p-3 text-[#faf8f5]">
      {done ? <CheckCircle2 className="size-6 text-[#4ade80]" aria-hidden /> : <FlaskConical className="size-6 text-[#d4af6b]" aria-hidden />}
      <p className="min-w-48 flex-1 text-base font-semibold">{text}</p>
      {done ? (
        <Link
          href={`/painel/${tenant.slug}/pdv?treino=1`}
          onClick={() => void finish()}
          className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-[#d4af6b] px-4 font-bold text-[#0b1f40] hover:brightness-105"
        >
          Treinar cobrança na Frente de Caixa <ArrowRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <button type="button" onClick={() => void finish()} className="inline-flex min-h-12 items-center rounded-[10px] border border-white/30 px-4 text-sm font-semibold hover:bg-white/10">
          Encerrar teste
        </button>
      )}
    </div>
  );
}
