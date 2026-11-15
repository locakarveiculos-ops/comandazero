"use client";

// Engine real (lojas com is_demo = false): Supabase com RLS e Realtime. Mesmo formato de dados da engine demo.
// Cada hook abre o próprio canal (nome único): o cliente Supabase reaproveita canal de mesmo nome já inscrito.
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { ORDER_SELECT, PRODUCT_SELECT, categoryFromRow, orderFromRow, productFromRow } from "@/lib/supabase/mappers";
import { defaultIntegrations } from "@/lib/seed";
import type { Category, IntegrationSettings, Order, OrderStatus, Product } from "@/lib/types";

export type RemoteMenu = { categories: Category[]; products: Product[]; loading: boolean; error: string | null };

// Avisa os hooks de cardápio abertos nesta aba para recarregar logo após salvar (sem esperar o Realtime).
const menuListeners = new Set<() => void>();
export const refreshRemoteMenu = () => menuListeners.forEach((f) => f());

/** Cardápio da loja (leitura pública pela RLS). Atualiza ao salvar nesta aba e, pelo Realtime, quando outro aparelho muda produto ou categoria. */
export function useRemoteMenu(tenantId: string | undefined, enabled: boolean): RemoteMenu {
  const [state, setState] = useState<RemoteMenu>({ categories: [], products: [], loading: enabled, error: null });
  useEffect(() => {
    const sb = getSupabase();
    if (!enabled || !tenantId || !sb) return;
    let alive = true;
    const load = async () => {
      const [c, p] = await Promise.all([
        sb.from("categories").select("*").eq("tenant_id", tenantId).order("sort"),
        sb.from("products").select(PRODUCT_SELECT).eq("tenant_id", tenantId).order("code"),
      ]);
      if (!alive) return;
      if (c.error || p.error) return setState((s) => ({ ...s, loading: false, error: (c.error ?? p.error)!.message }));
      setState({ categories: (c.data ?? []).map(categoryFromRow), products: (p.data ?? []).map(productFromRow), loading: false, error: null });
    };
    void load();
    const reload = () => void load();
    menuListeners.add(reload);
    const ch = sb
      .channel(`menu:${tenantId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `tenant_id=eq.${tenantId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `tenant_id=eq.${tenantId}` }, reload)
      .subscribe();
    return () => {
      alive = false;
      menuListeners.delete(reload);
      void sb.removeChannel(ch);
    };
  }, [tenantId, enabled]);
  return state;
}

export type RemoteOrders = { orders: Order[]; loading: boolean; error: string | null; connected: boolean };

/**
 * Pedidos da loja em tempo real entre aparelhos. Ao conectar (ou reconectar) busca o retrato atual;
 * depois cada INSERT/UPDATE em orders recarrega só o pedido afetado. RLS limita aos membros da loja.
 */
export function useRemoteOrders(tenantId: string | undefined, enabled: boolean, onNew?: (o: Order) => void): RemoteOrders {
  const [state, setState] = useState<RemoteOrders>({ orders: [], loading: enabled, error: null, connected: false });
  const onNewRef = useLatest(onNew);
  useEffect(() => {
    const sb = getSupabase();
    if (!enabled || !tenantId || !sb) return;
    let alive = true;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const snapshot = async () => {
      const { data, error } = await sb.from("orders").select(ORDER_SELECT).eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
      if (!alive) return;
      if (error) return setState((s) => ({ ...s, loading: false, error: error.message }));
      setState((s) => ({ ...s, orders: (data ?? []).map(orderFromRow), loading: false, error: null }));
    };
    const fetchOne = async (id: string, isNew: boolean) => {
      const { data } = await sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
      if (!alive || !data) return;
      const o = orderFromRow(data);
      if (isNew) o.seen = false;
      setState((s) => {
        const exists = s.orders.some((x) => x.id === o.id);
        return { ...s, orders: exists ? s.orders.map((x) => (x.id === o.id ? { ...o, seen: x.seen && !isNew } : x)) : [o, ...s.orders] };
      });
      if (isNew) onNewRef.current?.(o);
    };
    void snapshot();
    // O Realtime aplica RLS com o JWT do usuário: sem ele o canal entra como anônimo e não recebe pedidos.
    let ch: ReturnType<typeof sb.channel> | null = null;
    void sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      await sb.realtime.setAuth(data.session?.access_token ?? null);
      if (!alive) return;
      ch = sb
      .channel(`orders:${tenantId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (p) => void fetchOne((p.new as { id: string }).id, true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (p) => void fetchOne((p.new as { id: string }).id, false))
      .subscribe((status) => {
        if (!alive) return;
        const connected = status === "SUBSCRIBED";
        setState((s) => ({ ...s, connected }));
        // Reconectou: reconcilia com o banco (eventos perdidos durante a queda).
        if (connected) void snapshot();
      });
    });
    return () => {
      alive = false;
      if (ch) void sb.removeChannel(ch);
    };
  }, [tenantId, enabled, onNewRef]);
  return state;
}

function useLatest<T>(v: T) {
  const [ref] = useState(() => ({ current: v }));
  useEffect(() => {
    ref.current = v;
  });
  return ref;
}

export async function remoteSetStatus(orderId: string, status: OrderStatus) {
  const r = await fetch(`/api/pedidos/${orderId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
}

export async function remoteToggleProduct(productId: string, available: boolean) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponível");
  const { error } = await sb.from("products").update({ available }).eq("id", productId);
  if (error) throw new Error(friendly(error.message));
  refreshRemoteMenu();
}

/** Mensagens do banco que o lojista pode ler. */
function friendly(msg: string) {
  if (/SEM_PERMISSAO|row-level security/i.test(msg)) return "Sua função não permite alterar o cardápio.";
  if (/SOMENTE_LEITURA/.test(msg)) return "Painel em modo só leitura: regularize a assinatura para editar.";
  if (/RECURSO_DO_PLANO/.test(msg)) return "Recurso disponível em outro plano. Veja em Assinatura.";
  if (/products_tenant_id_code_key/.test(msg)) return "Já existe um produto com esse código. Troque o código e salve de novo.";
  if (/duplicate key/i.test(msg)) return "Já existe um item com esses dados.";
  return msg;
}

export async function remoteDeleteProduct(productId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponível");
  const { error } = await sb.from("products").delete().eq("id", productId);
  if (error) throw new Error(friendly(error.message));
  refreshRemoteMenu();
}

export async function remoteSaveCategory(tenantId: string, name: string, id?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponível");
  const { error } = await sb.rpc("save_category", { p_tenant: tenantId, p_id: id ?? null, p_name: name });
  if (error) throw new Error(friendly(error.message));
  refreshRemoteMenu();
}

/** Envia a foto ao Storage (validação de tipo e tamanho no servidor) e devolve a URL pública. */
export async function remoteUploadImage(slug: string, file: File, kind: "product" | "brand" = "product") {
  const form = new FormData();
  form.set("slug", slug);
  form.set("file", file);
  form.set("kind", kind);
  const r = await fetch("/api/produtos/foto", { method: "POST", body: form });
  const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.error || `HTTP ${r.status}`);
  return d.url;
}

/** Salva produto + grupos + opções numa transação (função save_product confere dono/gerente). */
export async function remoteSaveProduct(tenantId: string, p: Product) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponível");
  const isUuid = /^[0-9a-f-]{36}$/.test(p.id);
  const { error } = await sb.rpc("save_product", { p_tenant: tenantId, p: { ...p, id: isUuid ? p.id : null } });
  if (error) throw new Error(friendly(error.message));
  refreshRemoteMenu();
}

/** Marca da loja real (nome, frase, logo, capa, cores, endereço) direto no banco. Dono/gerente pela RLS. */
export async function remoteUpdateBrand(tenantId: string, b: { name: string; tagline: string; logo: string; cover: string; theme: unknown; subdomain: string }) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponível");
  const { data, error } = await sb
    .from("tenants")
    .update({ name: b.name.trim(), tagline: b.tagline.trim(), logo_url: b.logo || null, cover_url: b.cover || null, theme: b.theme, subdomain: b.subdomain })
    .eq("id", tenantId)
    .select("id");
  if (error) throw new Error(/duplicate key|subdomain/i.test(error.message) ? "Esse endereço já está em uso por outra loja." : friendly(error.message));
  if (!data?.length) throw new Error("Sua função não permite alterar a marca.");
}

/**
 * Configurações de integração da loja real (tabela integration_settings, dono/gerente pela RLS).
 * Campos ausentes no banco vêm do padrão, para a tela sempre abrir completa.
 */
export function useRemoteIntegrations(tenantId: string | undefined, enabled: boolean) {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!enabled || !tenantId || !sb) return;
    let alive = true;
    void sb
      .from("integration_settings")
      .select("whatsapp, payments, email")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const base = defaultIntegrations(tenantId);
        setSettings({
          tenantId,
          whatsapp: { ...base.whatsapp, ...(data?.whatsapp ?? {}), triggers: { ...base.whatsapp.triggers, ...(data?.whatsapp?.triggers ?? {}) } },
          payments: { ...base.payments, ...(data?.payments ?? {}), gateways: { ...base.payments.gateways, ...(data?.payments?.gateways ?? {}) } },
          email: { ...base.email, ...(data?.email ?? {}) },
        });
      });
    return () => {
      alive = false;
    };
  }, [tenantId, enabled]);

  const update = (fn: (s: IntegrationSettings) => IntegrationSettings) => {
    setSettings((cur) => {
      if (!cur || !tenantId) return cur;
      const next = fn(cur);
      const sb = getSupabase();
      void sb
        ?.from("integration_settings")
        .upsert({ tenant_id: tenantId, whatsapp: next.whatsapp, payments: next.payments, email: next.email, updated_at: new Date().toISOString() })
        .then(({ error }) => error && console.error("[integrações]", error.message));
      return next;
    });
  };
  return { settings, update };
}
