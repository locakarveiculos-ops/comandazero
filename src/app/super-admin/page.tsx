"use client";

/* eslint-disable @next/next/no-img-element -- logos podem vir de upload */
import { Activity, Building2, ExternalLink, KeyRound, Plus, RotateCcw, Rocket, ShoppingBag, Wallet } from "lucide-react";
import { useClientValue } from "@/lib/use-client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BrandLogo, SaasSurface, ThemeToggle } from "@/components/brand-switcher";
import { useHydrated } from "@/components/providers";
import { Badge, Button, Card, Field, Input, Modal, Select, Skeleton } from "@/components/ui";
import { ROOT_DOMAIN, saasBrand } from "@/config/saas-brand";
import { createTenant, resetDb, useDb } from "@/lib/repositories";
import { readChannelBlob } from "@/lib/integrations/whatsapp/notify";
import type { Plan, Tenant } from "@/lib/types";
import { money, readableInk, round2, slugify } from "@/lib/utils";

const PRICE: Record<Plan, number> = { starter: 89, pro: 179, enterprise: 399 };

export default function SuperAdmin() {
  const hydrated = useHydrated();
  const tenants = useDb((s) => s.tenants);
  const orders = useDb((s) => s.orders);
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.active);
    const gmv = round2(orders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.total, 0));
    return { mrr: active.reduce((s, t) => s + PRICE[t.plan], 0), count: active.length, orders: orders.length, gmv };
  }, [tenants, orders]);

  if (!hydrated) return <Skeleton className="m-6 h-96" />;

  return (
    <SaasSurface>
      {/* Faixa executiva navy com a variante de logo para fundo escuro. */}
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
            <p className="text-sm text-cz-muted">{saasBrand.name} · todas as lojas, receita recorrente e saúde das integrações.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (!confirm("Restaurar os dados de demonstração? Pedidos e alterações feitos neste navegador serão apagados.")) return;
                resetDb();
                toast.success("Dados de demonstração restaurados");
              }}
            >
              <RotateCcw className="size-4" aria-hidden /> Restaurar demo
            </Button>
            <Button variant="brand" size="lg" onClick={() => setCreating(true)}>
              <Rocket className="size-4" aria-hidden /> Criar novo estabelecimento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Wallet} label="MRR" value={money(stats.mrr)} />
          <Kpi icon={Building2} label="Lojas ativas" value={String(stats.count)} />
          <Kpi icon={ShoppingBag} label="Pedidos processados" value={stats.orders.toLocaleString("pt-BR")} />
          <Kpi icon={Activity} label="Volume transacionado" value={money(stats.gmv)} />
        </div>

        <Card className="relative min-w-0 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Estabelecimentos cadastrados</caption>
            <thead className="border-b border-cz-border text-xs uppercase tracking-wider text-cz-muted">
              <tr>
                <th className="p-4">Estabelecimento</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Subdomínio</th>
                <th className="p-4">Pedidos</th>
                <th className="p-4">WhatsApp</th>
                <th className="p-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cz-border">
              {tenants.map((t) => (
                <TenantRow key={t.id} t={t} orders={orders.filter((o) => o.tenantId === t.id).length} />
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-bold">Planos</h2>
            <ul className="mt-3 grid gap-2">
              {(Object.keys(PRICE) as Plan[]).map((p) => (
                <li key={p} className="flex items-center justify-between rounded-xl bg-cz-surface-2 p-3 text-sm">
                  <span className="font-semibold capitalize">{p}</span>
                  <span className="text-cz-muted">{tenants.filter((t) => t.plan === p).length} loja(s)</span>
                  <span className="font-bold tabular-nums">{money(PRICE[p])}/mês</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-bold">
              <KeyRound className="size-4" aria-hidden /> Chaves globais (só no servidor)
            </h2>
            <p className="mt-1 text-sm text-cz-muted">Ficam em variáveis de ambiente da Vercel. Nunca no navegador.</p>
            <ul className="mt-3 grid gap-2 font-mono text-xs">
              {[
                ["WHAILEYS_PARTNER_KEY", "Cria instâncias cpw-* (um número por loja)"],
                ["CHANNEL_SEAL_KEY", "Cifra credenciais dos canais (AES-256-GCM)"],
                ["WA_PROVISION_KEY", "Código de ativação entregue ao lojista"],
                ["RESEND_API_KEY", "Resend master key"],
                ["CLOUDFLARE_API_TOKEN", "DNS wildcard *." + ROOT_DOMAIN],
                ["EVOLUTION_API_KEY", "Evolution server global"],
              ].map(([k, d]) => (
                <li key={k} className="flex flex-wrap justify-between gap-2 rounded-lg bg-cz-surface-2 p-2.5">
                  <b>{k}</b>
                  <span className="font-sans text-cz-muted">{d}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>
      <Onboarding open={creating} onOpenChange={setCreating} />
    </SaasSurface>
  );
}

function TenantRow({ t, orders }: { t: Tenant; orders: number }) {
  const wa = useClientValue(() => !!readChannelBlob(t.slug), false);
  return (
    <tr>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <img src={t.logo} alt="" className="size-10 rounded-full border border-cz-border object-cover" />
          <div>
            <p className="font-semibold">{t.name}</p>
            <p className="text-xs text-cz-muted">{t.category}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <Badge tone={t.plan === "pro" ? "blue" : t.plan === "enterprise" ? "amber" : "neutral"}>{t.plan}</Badge>
      </td>
      <td className="p-4 font-mono text-xs">
        {t.subdomain}.{ROOT_DOMAIN}
      </td>
      <td className="p-4 tabular-nums">{orders}</td>
      <td className="p-4">
        <Badge tone={wa ? "green" : "neutral"}>{wa ? "Canal criado" : "Não conectado"}</Badge>
      </td>
      <td className="p-4">
        <div className="flex justify-end gap-2">
          <Link href={`/painel/${t.slug}`} className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold hover:bg-cz-surface-2">
            Painel
          </Link>
          <Link href={`/loja/${t.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold hover:bg-cz-surface-2">
            Loja <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function Onboarding({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const tenants = useDb((s) => s.tenants);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Padaria");
  const [color, setColor] = useState("#8A3B12");
  const [plan, setPlan] = useState<Plan>("pro");
  const [whatsapp, setWhatsapp] = useState("");
  const slug = slugify(name);
  const taken = tenants.some((t) => t.slug === slug);

  const create = () => {
    if (slug.length < 3) return toast.error("Nome muito curto");
    if (taken) return toast.error("Já existe uma loja com esse endereço");
    const base = tenants[0];
    const t: Tenant = {
      ...base,
      id: `t_${slug}`,
      slug,
      name: name.trim(),
      tagline: `${category} · peça pelo app`,
      description: `Cardápio digital de ${name.trim()}.`,
      category,
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${color}"/><text x="50" y="62" font-family="Arial" font-size="40" font-weight="bold" text-anchor="middle" fill="${readableInk(color)}">${name.trim().slice(0, 1).toUpperCase()}</text></svg>`)}`,
      theme: { ...base.theme, primary: color, primaryInk: readableInk(color), accent: color, dark: false },
      whatsapp: whatsapp.replace(/\D/g, "") ? `55${whatsapp.replace(/\D/g, "").replace(/^55/, "")}` : base.whatsapp,
      instagram: slug.replace(/-/g, ""),
      subdomain: slug.replace(/-/g, "").slice(0, 30),
      plan,
      rating: 5,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
    };
    createTenant(t);
    toast.success(`${t.name} criada! Loja e PWA no ar.`, { action: { label: "Abrir loja", onClick: () => window.open(`/loja/${slug}`, "_blank") } });
    onOpenChange(false);
    setName("");
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Onboarding em 1 minuto" description="Cria a loja, o app instalável e o subdomínio.">
      <div className="grid gap-4 p-5">
        <Field label="Nome do estabelecimento" id="ob-name" error={taken ? "Endereço já usado" : undefined} hint={slug ? `/loja/${slug} · ${slug.replace(/-/g, "")}.${ROOT_DOMAIN}` : undefined}>
          <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Padaria Pão Dourado" aria-invalid={taken} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" id="ob-cat">
            <Select id="ob-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["Padaria", "Cafeteria", "Confeitaria", "Lanchonete", "Hamburgueria", "Açaí"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Plano" id="ob-plan">
            <Select id="ob-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
              {(Object.keys(PRICE) as Plan[]).map((p) => (
                <option key={p} value={p}>
                  {p} · {money(PRICE[p])}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="WhatsApp da loja" id="ob-wa">
            <Input id="ob-wa" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(19) 99999-0000" />
          </Field>
          <label className="grid gap-1.5 text-sm font-semibold">
            Cor
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-16 cursor-pointer rounded-xl border border-cz-border" />
          </label>
        </div>
        <p className="rounded-xl bg-cz-surface-2 p-3 text-xs text-cz-muted">
          O cardápio começa com os produtos modelo; o lojista edita em Cardápio & estoque. Na Fase 2 este botão também cria o registro DNS na Cloudflare e o domínio na Vercel.
        </p>
        <Button variant="brand" size="lg" onClick={create} disabled={!name.trim() || taken}>
          <Plus className="size-4" aria-hidden /> Criar e publicar
        </Button>
      </div>
    </Modal>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm text-cz-muted">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
    </Card>
  );
}
