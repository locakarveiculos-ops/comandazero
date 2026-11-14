"use client";

import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BillingBanner } from "@/components/painel/billing-banner";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { PLANS, cyclePrice, planById, type Cycle } from "@/lib/plans";
import type { SubscriptionState } from "@/lib/server/subscription";
import type { Plan } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const STATUS: Record<SubscriptionState["status"], string> = { trial: "Teste grátis", active: "Ativa", overdue: "Pagamento pendente", canceled: "Cancelada" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const maskDoc = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export function BillingClient({ slug, sub, billingReady }: { slug: string; sub: SubscriptionState | null; billingReady: boolean }) {
  const [cycle, setCycle] = useState<Cycle>(sub?.cycle ?? "monthly");
  const [plan, setPlan] = useState<Plan>(sub?.plan ?? "pro");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const active = sub?.status === "active";

  const subscribe = async () => {
    const digits = doc.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) return toast.error("Informe um CPF ou CNPJ válido para a nota.");
    setLoading(true);
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, plan, cycle, cpfCnpj: digits }) });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return toast.error(data.error ?? "Não foi possível criar a assinatura.");
    toast.success("Assinatura criada. Abrindo a fatura…");
    if (data.invoiceUrl) window.location.assign(data.invoiceUrl);
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="cz-heading text-2xl font-bold">Assinatura</h1>
        <p className="text-sm text-cz-muted">Plano da ComandaZero para esta loja. Sem comissão por pedido.</p>
      </div>
      <BillingBanner slug={slug} sub={sub} canPay={false} />

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

      {!active && (
        <>
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
            <Field label="CPF ou CNPJ para a nota fiscal" id="doc">
              <Input id="doc" inputMode="numeric" value={doc} onChange={(e) => setDoc(maskDoc(e.target.value))} placeholder="000.000.000-00" />
            </Field>
            <p className="flex gap-2 text-sm text-cz-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Pagamento por Pix, boleto ou cartão na página segura do Asaas. A ComandaZero não recebe nem guarda dados de cartão.
            </p>
            {billingReady ? (
              <Button variant="brand" size="lg" onClick={subscribe} loading={loading}>
                Assinar {planById(plan).name} <ExternalLink className="size-4" aria-hidden />
              </Button>
            ) : (
              <p role="status" className="rounded-[10px] border border-cz-border bg-cz-surface-2 p-3 text-sm">
                O pagamento online da assinatura está sendo ativado. Para assinar agora, fale com o suporte pelo WhatsApp.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
