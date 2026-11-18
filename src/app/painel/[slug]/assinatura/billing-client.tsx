"use client";

import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BillingBanner } from "@/components/painel/billing-banner";
import { Badge, Button, Card } from "@/components/ui";
import { PLANS, cyclePrice, planById, type Cycle } from "@/lib/plans";
import type { SubscriptionState } from "@/lib/server/subscription";
import type { Plan } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const STATUS: Record<SubscriptionState["status"], string> = { trial: "Teste grátis", active: "Ativa", overdue: "Pagamento pendente", canceled: "Cancelada" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const METHOD: Record<string, string> = { pix: "Pix", credit_card: "Cartão" };

export type Invoice = { id: string; plan: Plan; cycle: Cycle; amount_cents: number; status: "pending" | "paid" | "canceled"; capture_method: string | null; receipt_url: string | null; created_at: string; paid_at: string | null };

/** renewSoon (calculado no servidor): ativa com menos de 10 dias para vencer; mostra os planos para renovar ou trocar. */
export function BillingClient({ slug, sub, invoices, renewSoon }: { slug: string; sub: SubscriptionState | null; invoices: Invoice[]; renewSoon: boolean }) {
  const [cycle, setCycle] = useState<Cycle>(sub?.cycle ?? "monthly");
  const [plan, setPlan] = useState<Plan>(sub?.plan ?? "pro");
  const [loading, setLoading] = useState(false);
  const active = sub?.status === "active";
  const paid = invoices.filter((i) => i.status === "paid");

  const subscribe = async () => {
    setLoading(true);
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, plan, cycle }) });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return toast.error(data.error ?? "Não foi possível gerar o pagamento.");
    toast.success("Abrindo o pagamento na InfinitePay…");
    window.location.assign(data.checkoutUrl);
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="cz-heading text-2xl font-bold">Assinatura</h1>
        <p className="text-sm text-cz-muted">Plano da ComandaZero para esta loja. Sem comissão por pedido.</p>
      </div>
      <BillingBanner slug={slug} sub={sub} cta="none" />

      {sub && (
        <Card className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-cz-muted">Situação</p>
            <p className="mt-1">
              <Badge tone={active ? "green" : sub.status === "trial" ? "blue" : sub.status === "overdue" ? "amber" : "red"}>{STATUS[sub.status]}</Badge>
            </p>
          </div>
          <div>
            <p className="text-sm text-cz-muted">Plano</p>
            <p className="mt-1 font-semibold">
              {planById(sub.plan).name}
              {sub.monthlyValue ? ` · ${money(sub.monthlyValue)}/mês` : ""}
            </p>
          </div>
          <div>
            <p className="text-sm text-cz-muted">{active ? "Próxima renovação" : sub.status === "trial" ? "Teste termina em" : "Vencimento"}</p>
            <p className="mt-1 font-semibold">{fmt(active ? sub.currentPeriodEnd : sub.status === "trial" ? sub.trialEndsAt : sub.overdueSince)}</p>
          </div>
        </Card>
      )}

      {(!active || renewSoon) && (
        <>
          {renewSoon && <p className="text-sm font-semibold">Seu período termina em breve. Renove agora para não ficar sem o painel.</p>}
          <div role="radiogroup" aria-label="Ciclo de cobrança" className="inline-flex w-fit rounded-full border border-cz-border bg-cz-surface p-1">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                onClick={() => setCycle(c)}
                className={cn("min-h-11 rounded-full px-5 text-sm font-semibold", cycle === c ? "bg-cz-navy text-white" : "text-cz-text")}
              >
                {c === "monthly" ? "Mensal" : "Anual · economize 2 meses"}
              </button>
            ))}
          </div>

          <div role="radiogroup" aria-label="Plano" className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={plan === p.id}
                aria-label={`${p.name}, ${money(cycle === "yearly" ? p.yearlyMonthly : p.monthly)} por mês`}
                onClick={() => setPlan(p.id)}
                className={cn("relative grid content-start gap-3 rounded-[14px] border bg-cz-surface p-5 text-left transition", plan === p.id ? "border-cz-gold ring-2 ring-cz-gold" : "border-cz-border hover:border-cz-gold/60")}
              >
                {p.popular && <span className="absolute -top-3 left-5 rounded-full bg-cz-gold px-3 py-0.5 text-xs font-bold text-cz-navy">Mais popular</span>}
                <span className="text-lg font-bold">{p.name}</span>
                <span className="text-sm text-cz-muted">{p.tagline}</span>
                <span className="text-3xl font-extrabold tabular-nums">
                  {money(cycle === "yearly" ? p.yearlyMonthly : p.monthly)}
                  <span className="text-sm font-semibold text-cz-muted">/mês</span>
                </span>
                {cycle === "yearly" && <span className="text-xs text-cz-muted">{money(cyclePrice(p, "yearly"))} cobrados por ano</span>}
                <ul className="grid gap-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-cz-success" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <Card className="grid gap-4 sm:max-w-lg">
            <p className="flex gap-2 text-sm text-cz-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Pagamento por Pix ou cartão (até 12x) na página segura da InfinitePay. A ComandaZero não recebe nem guarda dados de cartão. O plano ativa assim que o pagamento é confirmado.
            </p>
            <Button variant="brand" size="lg" onClick={subscribe} loading={loading}>
              Pagar {planById(plan).name} · {money(cyclePrice(planById(plan), cycle))} <ExternalLink className="size-4" aria-hidden />
            </Button>
            <p className="text-xs text-cz-muted">{cycle === "yearly" ? "Cobrança anual: você paga uma vez e o plano vale por 12 meses." : "Cobrança mensal: a cada mês você recebe o aviso e paga a renovação aqui."}</p>
          </Card>
        </>
      )}

      {paid.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="p-4 text-left font-bold">Pagamentos</caption>
            <thead className="border-y border-cz-border text-xs uppercase tracking-wider text-cz-muted">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Meio</th>
                <th className="p-4">
                  <span className="sr-only">Comprovante</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cz-border">
              {paid.map((i) => (
                <tr key={i.id}>
                  <td className="p-4">{fmt(i.paid_at)}</td>
                  <td className="p-4">
                    {planById(i.plan).name} · {i.cycle === "yearly" ? "anual" : "mensal"}
                  </td>
                  <td className="p-4 tabular-nums">{money(i.amount_cents / 100)}</td>
                  <td className="p-4">{METHOD[i.capture_method ?? ""] ?? "—"}</td>
                  <td className="p-4 text-right">
                    {i.receipt_url && (
                      <a href={i.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">
                        Comprovante
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
