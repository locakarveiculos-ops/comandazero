"use client";

import { ChefHat, ExternalLink, MonitorSmartphone, Receipt, ShoppingBag, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { useHydrated } from "@/components/providers";
import { Card, Skeleton } from "@/components/ui";
import { useOrders } from "@/lib/repositories";
import type { Channel } from "@/lib/types";
import { useMinute } from "@/lib/use-now";
import { money, round2 } from "@/lib/utils";

const CHANNEL: Record<Channel, { label: string; color: string }> = {
  loja: { label: "App / cardápio", color: "#2563eb" },
  mesa: { label: "Mesa (QR)", color: "#16a34a" },
  balcao: { label: "Balcão (PDV)", color: "#9333ea" },
  delivery: { label: "Delivery", color: "#ea580c" },
  whatsapp: { label: "WhatsApp", color: "#0d9488" },
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function Dashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useStoreTenant(slug);
  const hydrated = useHydrated();
  const orders = useOrders(tenant?.id);
  const now = useMinute();

  const data = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelado");
    const today = dayKey(new Date(now).toISOString());
    const todays = valid.filter((o) => dayKey(o.createdAt) === today);
    const revenue = round2(todays.reduce((s, o) => s + o.total, 0));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      const key = dayKey(d.toISOString());
      return {
        label: d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", ""),
        value: round2(valid.filter((o) => dayKey(o.createdAt) === key).reduce((s, o) => s + o.total, 0)),
      };
    });
    const week = valid.filter((o) => now - new Date(o.createdAt).getTime() < 7 * 86400000);
    const byChannel = (Object.keys(CHANNEL) as Channel[])
      .map((c) => ({ c, value: round2(week.filter((o) => o.channel === c).reduce((s, o) => s + o.total, 0)), count: week.filter((o) => o.channel === c).length }))
      .filter((x) => x.count);
    const top = Object.values(
      week.flatMap((o) => o.items).reduce<Record<string, { name: string; qty: number; value: number }>>((acc, i) => {
        if (i.productId === "servico") return acc;
        acc[i.productId] ??= { name: i.name, qty: 0, value: 0 };
        acc[i.productId].qty += i.qty;
        acc[i.productId].value += i.unitPrice * i.qty;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const weekRevenue = round2(week.reduce((s, o) => s + o.total, 0));
    return {
      revenue,
      count: todays.length,
      ticket: todays.length ? round2(revenue / todays.length) : 0,
      open: valid.filter((o) => ["recebido", "preparo", "pronto", "saiu"].includes(o.status)).length,
      days,
      byChannel,
      top,
      weekRevenue,
      weekTicket: week.length ? round2(weekRevenue / week.length) : 0,
    };
  }, [orders, now]);

  if (!tenant || !hydrated) return <Skeleton className="h-96" />;
  const max = Math.max(1, ...data.days.map((d) => d.value));
  const chTotal = data.byChannel.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cz-heading text-2xl font-bold">Bom dia, {tenant.name} ☕</h1>
          <p className="text-sm text-cz-muted">Resumo de hoje e dos últimos 7 dias.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/painel/${slug}/pdv`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink">
            <MonitorSmartphone className="size-4" aria-hidden /> Abrir PDV
          </Link>
          <Link href={`/painel/${slug}/kds`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-surface px-4 text-sm font-semibold ring-1 ring-cz-border">
            <ChefHat className="size-4" aria-hidden /> KDS
          </Link>
          <Link href={`/loja/${slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-surface px-4 text-sm font-semibold ring-1 ring-cz-border">
            Cardápio <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="dash-kpis">
        <Kpi icon={TrendingUp} label="Faturamento hoje" value={money(data.revenue)} />
        <Kpi icon={Receipt} label="Pedidos hoje" value={String(data.count)} />
        <Kpi icon={ShoppingBag} label="Ticket médio hoje" value={money(data.ticket)} sub={`Semana: ${money(data.weekTicket)}`} />
        <Kpi icon={ChefHat} label="Em andamento" value={String(data.open)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-bold">Faturamento · 7 dias</h2>
          <p className="text-sm text-cz-muted">{money(data.weekRevenue)} na semana</p>
          <div className="mt-5 flex h-52 items-end gap-2" role="img" aria-label={`Faturamento diário: ${data.days.map((d) => `${d.label} ${money(d.value)}`).join(", ")}`}>
            {data.days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-cz-muted">{d.value ? Math.round(d.value) : ""}</span>
                <div className="w-full rounded-t-lg bg-brand transition-all" style={{ height: `${Math.max(3, (d.value / max) * 160)}px`, opacity: i === 6 ? 1 : 0.55 }} />
                <span className="text-xs capitalize text-cz-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Pedidos por canal · 7 dias</h2>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full" aria-hidden>
            {data.byChannel.map((x) => (
              <div key={x.c} style={{ width: `${(x.value / chTotal) * 100}%`, background: CHANNEL[x.c].color }} />
            ))}
          </div>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {data.byChannel.map((x) => (
              <li key={x.c} className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: CHANNEL[x.c].color }} aria-hidden />
                <span className="flex-1">{CHANNEL[x.c].label}</span>
                <span className="text-cz-muted">{x.count} ped.</span>
                <span className="w-24 text-right font-semibold tabular-nums">{money(x.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="flex items-center gap-2 font-bold">
          <Trophy className="size-4 text-cz-gold-text" aria-hidden /> Produtos campeões · 7 dias
        </h2>
        <ol className="mt-4 grid gap-2">
          {data.top.map((t, i) => (
            <li key={t.name} className="flex items-center gap-3 text-sm">
              <span className="grid size-8 place-items-center rounded-full bg-cz-surface-2 font-bold">{i + 1}</span>
              <span className="flex-1 font-medium">{t.name}</span>
              <span className="text-cz-muted">{t.qty} un.</span>
              <span className="w-24 text-right font-semibold tabular-nums">{money(t.value)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof TrendingUp; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm text-cz-muted">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-cz-muted">{sub}</p>}
    </Card>
  );
}
