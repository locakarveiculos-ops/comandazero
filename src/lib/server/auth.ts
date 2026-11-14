import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { supabaseReady, supabaseServer } from "@/lib/supabase/server";

/**
 * Camada de autorização (servidor). Toda tela/ação protegida passa por aqui; o menu escondido não é proteção.
 * Papéis por loja: owner (dono), manager (gerente), cashier (caixa), waiter (garçom), kitchen (cozinha).
 */
export type Role = "owner" | "manager" | "cashier" | "waiter" | "kitchen";
export type TenantAccess = { id: string; slug: string; name: string; isDemo: boolean; role: Role | null; platformAdmin: boolean };

/** O que cada papel pode fazer. Ações sensíveis consultam esta tabela no servidor. */
export const PERMISSIONS = {
  "orders.view": ["owner", "manager", "cashier", "waiter", "kitchen"],
  "orders.advance": ["owner", "manager", "cashier", "waiter", "kitchen"],
  "orders.cancel": ["owner", "manager", "cashier"],
  "pdv.sell": ["owner", "manager", "cashier"],
  "tables.manage": ["owner", "manager", "cashier", "waiter"],
  "menu.edit": ["owner", "manager"],
  "brand.edit": ["owner", "manager"],
  "integrations.edit": ["owner", "manager"],
  "loyalty.edit": ["owner", "manager"],
  "reports.view": ["owner", "manager"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | null, perm: Permission) => !!role && (PERMISSIONS[perm] as readonly Role[]).includes(role);

/** Páginas do painel e a permissão mínima de cada uma. */
export const PAGE_PERMISSION: Record<string, Permission> = {
  "": "orders.view",
  pedidos: "orders.view",
  kds: "orders.advance",
  pdv: "pdv.sell",
  mesas: "tables.manage",
  cardapio: "menu.edit",
  fidelidade: "loyalty.edit",
  aparencia: "brand.edit",
  integracoes: "integrations.edit",
  treinamento: "orders.view",
};

export const getUser = cache(async () => {
  if (!supabaseReady()) return null;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
});

export const isPlatformAdmin = cache(async () => {
  const user = await getUser();
  if (!user) return false;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("is_platform_admin");
  return data === true;
});

/** Loja pelo slug + papel do usuário. Lojas de demonstração ficam abertas (sem dados reais). */
export const getTenantAccess = cache(async (slug: string): Promise<TenantAccess | null> => {
  if (!supabaseReady()) return { id: "", slug, name: slug, isDemo: true, role: null, platformAdmin: false };
  const sb = await supabaseServer();
  const { data: t } = await sb.from("tenants").select("id, slug, name, is_demo").eq("slug", slug).maybeSingle();
  if (!t) {
    // Loja criada só no navegador (onboarding demo) não existe no banco: continua demo.
    return { id: "", slug, name: slug, isDemo: true, role: null, platformAdmin: false };
  }
  const user = await getUser();
  let role: Role | null = null;
  if (user) {
    const { data } = await sb.rpc("my_tenant_role", { p_tenant: t.id });
    role = (data as Role | null) ?? null;
  }
  const platformAdmin = user ? await isPlatformAdmin() : false;
  return { id: t.id, slug: t.slug, name: t.name, isDemo: t.is_demo, role: role ?? (platformAdmin ? "owner" : null), platformAdmin };
});

/** Exige login (redireciona para /entrar) e papel na loja (403 se não tiver). Demo passa direto. */
export async function requireTenant(slug: string, perm: Permission = "orders.view", next?: string) {
  const access = await getTenantAccess(slug);
  if (!access) forbidden();
  if (access.isDemo) return access;
  const user = await getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next ?? `/painel/${slug}`)}`);
  if (!can(access.role, perm)) forbidden();
  return access;
}

export async function requirePlatformAdmin() {
  const user = await getUser();
  if (!user) redirect("/entrar?next=%2Fsuper-admin");
  if (!(await isPlatformAdmin())) forbidden();
  return user;
}
