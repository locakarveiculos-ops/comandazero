"use client";

/* eslint-disable @next/next/no-img-element -- logos vêm do Storage */
import { Activity, Building2, ExternalLink, History, KeyRound, Rocket, ShoppingBag, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface, ThemeToggle } from "@/components/brand-switcher";
import { Badge, Button, Card, Select } from "@/components/ui";
import { ROOT_DOMAIN, saasBrand } from "@/config/saas-brand";
import { PLANS, planById } from "@/lib/plans";
import type { Plan } from "@/lib/types";
import { money, round2 } from "@/lib/utils";

export type OverviewRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  logo_url: string | null;
  is_demo: boolean;
  active: boolean;
  created_at: string;
  plan: Plan;
  sub_status: "trial" | "active" | "overdue" | "canceled" | null;
  cycle: "monthly" | "yearly" | null;
  monthly_value: number | null;
  trial_ends_at: string | null;
  overdue_since: string | null;
  orders: number;
  gmv: number;
  last_order_at: string | null;
  whatsapp_connected: boolean;
  owner_email: string | null;
};
export type AuditRow = { id: number; actor_email: string | null; action: string; details: Record<string, unknown>; created_at: string };

const STATUS: Record<NonNullable<OverviewRow["sub_status"]>, { label: string; tone: "green" | "amber" | "red" | "blue" | "neutral" }> = {
  trial: { label: "Teste grátis", tone: "blue" },
  active: { label: "Pagante", tone: "green" },
  overdue: { label: "Em atraso", tone: "red" },
  canceled: { label: "Cancelada", tone: "neutral" },
};
const ACTION: Record<string, string> = { "loja.suspender": "Suspendeu loja", "loja.reativar": "Reativou loja", "loja.plano": "Trocou plano", "assinatura.webhook": "Pagamento recebido" };
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

/** Visão da plataforma com dados reais do banco (lojas, assinaturas, pedidos). Demos ficam separadas e fora do MRR. */
export function SuperAdminClient({ rows, audit }: { rows: OverviewRow[]; audit: AuditRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const real = rows.filter((r) => !r.is_demo);
  const demos = rows.filter((r) => r.is_demo);

  const stats = useMemo(() => {
    // MRR: só assinaturas pagantes (ativas ou em atraso ainda não canceladas), pelo valor contratado.
    const paying = real.filter((r) => r.sub_status === "active" || r.sub_status === "overdue");
    return {
      mrr: round2(paying.reduce((s, r) => s + Number(r.monthly_value ?? 0), 0)),
      paying: paying.length,
      trial: real.filter((r) => r.sub_status === "trial").length,
      orders: real.reduce((s, r) => s + Number(r.orders), 0),
      gmv: round2(real.reduce((s, r) => s + Number(r.gmv), 0)),
    };
  }, [real]);

  const patch = async (row: OverviewRow, body: { active?: boolean; plan?: Plan }) => {
    if (body.active === false && !confirm(`Suspender ${row.name}? A loja sai do ar até ser reativada.`)) return;
    setBusy(row.id);
    const r = await fetch(`/api/admin/lojas/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar");
    toast.success("Alteração salva e registrada no histórico");
    router.refresh();
  };

  return (
    <SaasSurface>
      <header className="sticky top-0 z-30 bg-cz-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="ComandaZero, início">
            <BrandLogo variant="compact" height={30} onDark />
          </Link>
          <span className="rounded-full border border-cz-gold/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-cz-gold">Super Admin</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="border-white/20 bg-white/5 text-white hover:bg-white/10" />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto grid min-w-0 max-w-7xl gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="cz-heading text-3xl font-bold">Visão da plataforma</h1>
            <p className="text-sm text-cz-muted">{saasBrand.name} · lojas reais, assinaturas e uso. Demonstrações ficam fora dos números.</p>
          </div>
          <Link href="/onboarding" className="inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-brand px-6 font-semibold text-brand-ink">
            <Rocket className="size-4" aria-hidden /> Criar novo estabelecimento
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Wallet} label="MRR" value={money(stats.mrr)} hint={`${stats.paying} pagante(s)`} />
          <Kpi icon={Building2} label="Lojas reais" value={String(real.length)} hint={`${stats.trial} em teste grátis`} />
          <Kpi icon={ShoppingBag} label="Pedidos (lojas reais)" value={stats.orders.toLocaleString("pt-BR")} />
          <Kpi icon={Activity} label="Volume transacionado" value={money(stats.gmv)} />
        </div>

        <Card className="relative min-w-0 overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="p-4 text-left font-bold">Estabelecimentos</caption>
            <thead className="border-y border-cz-border text-xs uppercase tracking-wider text-cz-muted">
              <tr>
                <th className="p-4">Estabelecimento</th>
                <th className="p-4">Assinatura</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Pedidos</th>
                <th className="p-4">WhatsApp</th>
                <th className="p-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cz-border">
              {real.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-cz-muted">
                    Nenhuma loja real ainda. Quando alguém criar a conta e a loja, ela aparece aqui.
                  </td>
                </tr>
              )}
              {[...real, ...demos].map((r) => (
                <tr key={r.id} className={r.active ? undefined : "opacity-60"}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {r.logo_url ? <img src={r.logo_url} alt="" className="size-10 rounded-full border border-cz-border object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-cz-surface-2 font-bold">{r.name.slice(0, 1)}</span>}
                      <div>
                        <p className="font-semibold">
                          {r.name} {r.is_demo && <Badge tone="amber">Demonstração</Badge>} {!r.active && <Badge tone="red">Suspensa</Badge>}
                        </p>
                        <p className="text-xs text-cz-muted">
                          {r.owner_email ?? "sem dono"} · {r.slug.replace(/-/g, "")}.{ROOT_DOMAIN}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {r.is_demo || !r.sub_status ? (
                      <span className="text-cz-muted">—</span>
                    ) : (
                      <div className="grid gap-0.5">
                        <Badge tone={STATUS[r.sub_status].tone}>{STATUS[r.sub_status].label}</Badge>
                        <span className="text-xs text-cz-muted">
                          {r.sub_status === "trial" && r.trial_ends_at ? (daysLeft(r.trial_ends_at) >= 0 ? `${daysLeft(r.trial_ends_at)} dia(s) restantes` : "teste vencido") : r.monthly_value ? `${money(Number(r.monthly_value))}/mês` : ""}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {r.is_demo ? (
                      planById(r.plan).name
                    ) : (
                      <Select aria-label={`Plano de ${r.name}`} value={r.plan} disabled={busy === r.id} onChange={(e) => patch(r, { plan: e.target.value as Plan })} className="min-w-36">
                        {PLANS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td className="p-4 tabular-nums">
                    {Number(r.orders).toLocaleString("pt-BR")}
                    {r.last_order_at && <span className="block text-xs text-cz-muted">último {fmtDate(r.last_order_at)}</span>}
                  </td>
                  <td className="p-4">
                    <Badge tone={r.whatsapp_connected ? "green" : "neutral"}>{r.whatsapp_connected ? "Conectado" : "Não conectado"}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Link href={`/painel/${r.slug}`} className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold hover:bg-cz-surface-2">
                        Painel
                      </Link>
                      <Link href={`/loja/${r.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold hover:bg-cz-surface-2">
                        Loja <ExternalLink className="size-3.5" aria-hidden />
                      </Link>
                      {!r.is_demo && (
                        <Button variant="ghost" size="sm" loading={busy === r.id} onClick={() => patch(r, { active: !r.active })}>
                          {r.active ? "Suspender" : "Reativar"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="flex items-center gap-2 font-bold">
              <History className="size-4" aria-hidden /> Histórico de ações
            </h2>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-cz-muted">Nenhuma ação registrada ainda.</p>
            ) : (
              <ol className="mt-3 grid gap-2 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-cz-surface-2 p-3">
                    <span>
                      <b>{ACTION[a.action] ?? a.action}</b> {typeof a.details?.slug === "string" && <span className="text-cz-muted">· {a.details.slug}</span>}
                    </span>
                    <span className="text-xs text-cz-muted">
                      {a.actor_email ?? "sistema"} · {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <h2 className="font-bold">Planos</h2>
            <ul className="mt-3 grid gap-2">
              {PLANS.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-cz-surface-2 p-3 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-cz-muted">{real.filter((r) => r.plan === p.id).length} loja(s)</span>
                  <span className="font-bold tabular-nums">{money(p.monthly)}/mês</span>
                </li>
              ))}
            </ul>
            <h2 className="mt-5 flex items-center gap-2 font-bold">
              <KeyRound className="size-4" aria-hidden /> Chaves globais (só no servidor)
            </h2>
            <p className="mt-1 text-sm text-cz-muted">Ficam nas variáveis de ambiente da Vercel. Nunca no navegador.</p>
          </Card>
        </div>
      </main>
    </SaasSurface>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm text-cz-muted">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-cz-muted">{hint}</p>}
    </Card>
  );
}
