"use client";

// Engine real (lojas com is_demo = false): Supabase com RLS e Realtime. Mesmo formato de dados da engine demo.
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { ORDER_SELECT, PRODUCT_SELECT, categoryFromRow, orderFromRow, productFromRow } from "@/lib/supabase/mappers";
import type { Category, Order, OrderStatus, Product } from "@/lib/types";

export type RemoteMenu = { categories: Category[]; products: Product[]; loading: boolean; error: string | null };

/** Cardápio da loja (leitura pública pela RLS). Atualiza quando o lojista pausa um item (Realtime em products). */
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
    const ch = sb
      .channel(`menu:${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `tenant_id=eq.${tenantId}` }, () => void load())
      .subscribe();
    return () => {
      alive = false;
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
    const ch = sb
      .channel(`orders:${tenantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (p) => void fetchOne((p.new as { id: string }).id, true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (p) => void fetchOne((p.new as { id: string }).id, false))
      .subscribe((status) => {
        if (!alive) return;
        const connected = status === "SUBSCRIBED";
        setState((s) => ({ ...s, connected }));
        // Reconectou: reconcilia com o banco (eventos perdidos durante a queda).
        if (connected) void snapshot();
      });
    return () => {
      alive = false;
      void sb.removeChannel(ch);
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
  if (error) throw new Error(error.message);
}

/** Envia a foto ao Storage (validação de tipo e tamanho no servidor) e devolve a URL pública. */
export async function remoteUploadImage(slug: string, file: File) {
  const form = new FormData();
  form.set("slug", slug);
  form.set("file", file);
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
  if (error) throw new Error(/SEM_PERMISSAO/.test(error.message) ? "Sua função não permite alterar o cardápio." : error.message);
}
