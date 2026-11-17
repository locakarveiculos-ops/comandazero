"use client";

/* eslint-disable @next/next/no-img-element -- logo da loja pode vir de upload */
import {
  BarChart3,
  Bell,
  BellOff,
  ChefHat,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  GraduationCap,
  Heart,
  LayoutGrid,
  ListOrdered,
  Menu as MenuIcon,
  MonitorSmartphone,
  Palette,
  Plug,
  Store,
  Users,
  Wallet,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, createContext, useContext, useState, type ReactNode } from "react";
import { BrandLogo, SaasSurface, ThemeToggle, useSaasTheme } from "@/components/brand-switcher";
import { useStoreTenant } from "@/components/loja/use-store-tenant";
import { useOrderAlerts, useRemoteOrderAlert } from "@/components/painel/use-panel";
import { Skeleton } from "@/components/ui";
import { ActivationButton } from "@/components/training/activation-checklist";
import { HelpButton, WelcomeTour } from "@/components/training/help-button";
import { TourFromQuery } from "@/components/training/training-center";
import { useDb } from "@/lib/repositories";
import { useStoreOrders } from "@/lib/repositories/engine";
import { mutate } from "@/lib/repositories/store";
import { useClientValue } from "@/lib/use-client";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

// Papéis que veem cada item (espelha PAGE_PERMISSION do servidor; o servidor é quem bloqueia de fato).
const ALL: Role[] = ["owner", "manager", "cashier", "waiter", "kitchen"];
// realOnly: telas que só existem para loja real (equipe e cobrança não fazem sentido na demonstração).
// mode: item só aparece se a loja atende nesse modo (sem mesas = menu mais simples para quem está começando).
const NAV: { href: string; label: string; icon: typeof BarChart3; badge?: boolean; roles: Role[]; realOnly?: boolean; mode?: "mesa" }[] = [
  { href: "", label: "Dashboard", icon: BarChart3, roles: ALL },
  { href: "/pedidos", label: "Pedidos", icon: ListOrdered, badge: true, roles: ALL },
  { href: "/pdv", label: "Frente de Caixa (PDV)", icon: MonitorSmartphone, roles: ["owner", "manager", "cashier"] },
  { href: "/mesas", label: "Mesas e comandas", icon: UtensilsCrossed, roles: ["owner", "manager", "cashier", "waiter"], mode: "mesa" },
  { href: "/kds", label: "Tela da Cozinha (KDS)", icon: ChefHat, roles: ALL },
  { href: "/cardapio", label: "Cardápio", icon: LayoutGrid, roles: ["owner", "manager"] },
  { href: "/fidelidade", label: "Fidelidade & cupons", icon: Heart, roles: ["owner", "manager"] },
  { href: "/aparencia", label: "Marca do app", icon: Palette, roles: ["owner", "manager"] },
  { href: "/integracoes", label: "Pagamentos e WhatsApp", icon: Plug, roles: ["owner", "manager"] },
  { href: "/equipe", label: "Equipe", icon: Users, roles: ["owner"], realOnly: true },
  { href: "/assinatura", label: "Assinatura", icon: Wallet, roles: ["owner"], realOnly: true },
  { href: "/treinamento", label: "Central de treinamento", icon: GraduationCap, roles: ALL },
];

type Role = "owner" | "manager" | "cashier" | "waiter" | "kitchen";
export type PanelAccess = { tenantId: string; isDemo: boolean; role: Role | null; platformAdmin: boolean; readOnly?: boolean; plan?: Plan; trial?: boolean };

// Contexto para as telas do painel lerem plano e permissão sem nova consulta.
const PanelAccessContext = createContext<PanelAccess>({ tenantId: "", isDemo: true, role: null, platformAdmin: false, plan: "enterprise", trial: true });
export const usePanelAccess = () => useContext(PanelAccessContext);

const COLLAPSE_KEY = "cz-sidebar-collapsed";

export function PanelShell({ slug, children, access, banner, stores }: { slug: string; children: ReactNode; access: PanelAccess; banner?: ReactNode; stores?: { slug: string; name: string }[] | null }) {
  const path = usePathname();
  const { tenant, notFound } = useStoreTenant(slug);
  // Loja real: pedido novo chega pelo Realtime (outro aparelho). Demo: pelo aviso entre abas (useOrderAlerts).
  const onRemoteNew = useRemoteOrderAlert(tenant);
  const { orders, live } = useStoreOrders(tenant, onRemoteNew);
  const soundOn = useDb((s) => s.soundOn);
  const localTenants = useDb((s) => s.tenants);
  // Demonstração: lojas do navegador. Loja real: lojas da conta vindas do servidor (a atual sempre aparece).
  const tenants = stores ? (stores.some((t) => t.slug === slug) ? stores : [{ slug, name: slug }, ...stores]) : localTenants;
  const theme = useSaasTheme();
  const [open, setOpen] = useState(false);
  const stored = useClientValue(() => localStorage.getItem(COLLAPSE_KEY) === "1", false);
  const [collapsedOverride, setCollapsed] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? stored;
  useOrderAlerts(tenant, { notify: true });

  const base = `/painel/${slug}`;
  const fullscreen = path.endsWith("/kds");
  const unseen = orders.filter((o) => !o.seen).length;

  if (notFound)
    return (
      <SaasSurface className="grid place-items-center p-8">
        <p>Estabelecimento não encontrado.</p>
      </SaasSurface>
    );
  if (!tenant)
    return (
      <SaasSurface>
        <Skeleton className="m-6 h-96" />
      </SaasSurface>
    );
  if (fullscreen)
    return (
      <SaasSurface forceTheme="dark">
        <Suspense>
          <TourFromQuery slug={slug} />
        </Suspense>
        <PanelAccessContext.Provider value={access}>{children}</PanelAccessContext.Provider>
      </SaasSurface>
    );

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* sem storage: vale só nesta aba */
    }
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Painel" className="grid gap-1">
      {NAV.filter((n) => (access.isDemo ? !n.realOnly : !!access.role && n.roles.includes(access.role)) && (!n.mode || tenant.modes.includes(n.mode))).map((n) => {
        const href = base + n.href;
        const active = n.href ? path.startsWith(href) : path === base;
        return (
          <Link
            key={n.href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            title={compact ? n.label : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition",
              compact && "justify-center px-0",
              active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-cz-gold" aria-hidden />}
            <n.icon className="size-[18px] shrink-0" aria-hidden />
            <span className={cn("flex-1", compact && "sr-only")}>{n.label}</span>
            {n.badge && unseen > 0 && (
              <span className={cn("rounded-full bg-[#c2410c] px-2 text-xs font-bold text-white tabular-nums", compact && "absolute right-1 top-1 px-1.5")}>{unseen}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <SaasSurface className={cn("lg:grid", collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[264px_1fr]")}>
      {/* Sidebar navy: logo para fundo escuro (nunca navy sobre navy). */}
      <aside data-tour="menu-lateral" className="hidden bg-cz-navy p-3 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-5" aria-label="Navegação do painel">
        <div className={cn("flex items-center pt-2", collapsed ? "justify-center" : "justify-between px-2")}>
          <Link href="/" aria-label="ComandaZero, início">
            {collapsed ? <BrandLogo variant="symbol" height={34} /> : <BrandLogo variant="compact" height={30} onDark />}
          </Link>
        </div>
        {!collapsed && <TenantSwitch slug={slug} tenants={tenants} />}
        <div className="flex-1 overflow-y-auto">{nav(collapsed)}</div>
        <Link
          href={`/loja/${slug}`}
          target="_blank"
          title={collapsed ? "Ver cardápio" : undefined}
          className={cn("flex min-h-11 items-center gap-2 rounded-[10px] border border-white/15 px-3 text-sm font-semibold text-white/90 hover:bg-white/5", collapsed && "justify-center px-0")}
        >
          <Store className="size-4 shrink-0" aria-hidden />
          <span className={cn(collapsed && "sr-only")}>Ver cardápio</span>
          {!collapsed && <ExternalLink className="ml-auto size-3.5" aria-hidden />}
        </Link>
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[10px] text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
          <span className={cn(collapsed && "sr-only")}>Recolher</span>
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-cz-border bg-cz-surface/90 px-4 py-2 backdrop-blur">
          <button type="button" className="grid size-11 shrink-0 place-items-center rounded-[10px] hover:bg-cz-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
            <MenuIcon className="size-5" aria-hidden />
          </button>
          {/* Marca da loja que está sendo operada (white-label), não da plataforma. */}
          <img src={tenant.logo} alt="" className="size-9 rounded-full border border-cz-border object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{tenant.name}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-cz-muted">
              {access.isDemo ? (
                <span className="rounded-full bg-[#f8ecdc] px-1.5 font-semibold text-[#7d4710]">Demonstração</span>
              ) : (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 font-semibold", live ? "bg-[#e3f3ec] text-[#0f6646]" : "bg-[#f8e4e4] text-[#8f2a2a]")} data-testid="conexao">
                  <span className={cn("size-2 rounded-full", live ? "bg-cz-success" : "bg-cz-error")} aria-hidden />
                  {live ? "Ao vivo" : "Reconectando…"}
                </span>
              )}
              · {tenant.subdomain}
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutate((s) => ({ soundOn: !s.soundOn }))}
            aria-pressed={soundOn}
            data-tour="som"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] border border-cz-border bg-cz-surface px-3 text-sm font-semibold hover:bg-cz-surface-2"
          >
            {soundOn ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
            <span className="hidden sm:inline">Som {soundOn ? "ligado" : "desligado"}</span>
          </button>
          {(access.isDemo || access.role === "owner" || access.role === "manager") && <ActivationButton tenant={tenant} />}
          <HelpButton slug={slug} />
          <ThemeToggle />
        </header>
        <main id="conteudo" className="min-w-0 p-4 sm:p-6">
          {banner}
          <WelcomeTour slug={slug} />
          <Suspense>
            <TourFromQuery slug={slug} />
          </Suspense>
          <PanelAccessContext.Provider value={access}>{children}</PanelAccessContext.Provider>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-cz-navy p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <BrandLogo variant="compact" height={24} onDark />
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-[10px] hover:bg-white/10" aria-label="Fechar menu">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <TenantSwitch slug={slug} tenants={tenants} />
            <div className="overflow-y-auto">{nav(false)}</div>
            <p className="mt-auto text-xs text-white/60">Tema: {theme === "dark" ? "escuro" : "claro"}</p>
          </div>
        </div>
      )}
    </SaasSurface>
  );
}

function TenantSwitch({ slug, tenants }: { slug: string; tenants: { slug: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="grid gap-1 px-1 text-xs font-semibold text-white/70">
      Estabelecimento
      <select
        value={slug}
        onChange={(e) => router.push(`/painel/${e.target.value}`)}
        className="min-h-11 rounded-[10px] border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white [&>option]:text-[#0b1f40]"
      >
        {tenants.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
