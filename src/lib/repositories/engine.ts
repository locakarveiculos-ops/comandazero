"use client";

// Escolhe a engine pela loja: demo (navegador) ou real (Supabase). As telas usam estes hooks e não sabem qual é.
import { useMemo } from "react";
import { buildPresetMenu, type NicheId } from "@/lib/niche-presets";
import type { CartItem, Order, OrderStatus, Product, Tenant } from "@/lib/types";
import { round2, uid } from "@/lib/utils";
import {
  createOrder,
  seedNicheMenu,
  setOrderStatus as localSetStatus,
  toggleProduct as localToggle,
  useMenu as useLocalMenu,
  useOrders as useLocalOrders,
} from "./index";
import { remoteSeedMenu, remoteSetStatus, remoteToggleProduct, useRemoteMenu, useRemoteOrders } from "./remote";

export const isRemote = (t: Pick<Tenant, "isDemo"> | undefined) => !!t && t.isDemo === false;

export function useStoreMenu(tenant: Tenant | undefined) {
  const remote = isRemote(tenant);
  const local = useLocalMenu(remote ? undefined : tenant?.id);
  const r = useRemoteMenu(tenant?.id, remote);
  return remote ? { categories: r.categories, products: r.products, loading: r.loading, error: r.error } : { ...local, loading: false, error: null };
}

export function useStoreOrders(tenant: Tenant | undefined, onNew?: (o: Order) => void) {
  const remote = isRemote(tenant);
  const local = useLocalOrders(remote ? undefined : tenant?.id);
  const r = useRemoteOrders(tenant?.id, remote, onNew);
  return useMemo(
    () => (remote ? { orders: r.orders, loading: r.loading, error: r.error, live: r.connected } : { orders: local, loading: false, error: null, live: true }),
    [remote, r.orders, r.loading, r.error, r.connected, local],
  );
}

export async function changeOrderStatus(tenant: Tenant, orderId: string, status: OrderStatus) {
  if (isRemote(tenant)) return remoteSetStatus(orderId, status);
  localSetStatus(orderId, status);
}

export async function setProductAvailable(tenant: Tenant, productId: string, available: boolean) {
  if (isRemote(tenant)) return remoteToggleProduct(productId, available);
  localToggle(productId);
}

/** Carrega o cardápio de exemplo do nicho, sem colidir códigos do PDV com os produtos que já existem. */
export async function loadNicheMenu(tenant: Tenant, niche: NicheId, current: { products: Product[]; categories: { order: number }[] }) {
  const codeStart = Math.max(100, ...current.products.map((p) => Number(p.code)).filter(Number.isFinite));
  const orderStart = Math.max(0, ...current.categories.map((c) => c.order));
  const menu = buildPresetMenu(niche, tenant.id, { codeStart, orderStart });
  if (isRemote(tenant)) await remoteSeedMenu(tenant.id, menu);
  else seedNicheMenu(tenant.id, menu);
  return menu.products.length;
}

export const TEST_CUSTOMER = "Pedido de teste";

/** Item de treino: primeiro produto vendável com as escolhas obrigatórias já marcadas (null se o cardápio está vazio). */
export function testItem(products: Product[]): CartItem | null {
  const p = products.find((x) => x.available && !x.cake && !x.preorder);
  if (!p) return null;
  const options = p.optionGroups.flatMap((g) => g.choices.slice(0, g.min).map((c) => ({ groupId: g.id, groupName: g.name, choiceId: c.id, name: c.name, price: c.price })));
  return { key: uid(), productId: p.id, name: p.name, image: p.image, unitPrice: round2(p.price + options.reduce((s, o) => s + o.price, 0)), qty: 1, options, notes: TEST_CUSTOMER };
}

/**
 * Pedido de teste em 1 clique. Loja real passa pela mesma rota do cliente (/api/pedidos, preço do banco),
 * então chega na Tela da Cozinha de verdade; o guia cancela no fim para não entrar no faturamento.
 */
export async function createTestOrder(tenant: Tenant, products: Product[]): Promise<{ id: string; number: number; items: CartItem[] }> {
  const item = testItem(products);
  if (!item) throw new Error("Carregue ou cadastre um produto no Cardápio antes do pedido de teste.");
  if (!isRemote(tenant)) {
    const o = createOrder({ tenantId: tenant.id, channel: "loja", mode: "retirada", items: [item], payments: [{ method: "dinheiro", amount: item.unitPrice }], gateway: "presencial", customer: { name: TEST_CUSTOMER, phone: "" } });
    return { id: o.id, number: o.number, items: [item] };
  }
  if (!tenant.whatsapp) throw new Error("Cadastre o WhatsApp da loja antes do pedido de teste.");
  const mode = tenant.modes.includes("retirada") ? "retirada" : tenant.modes.includes("mesa") ? "mesa" : "retirada";
  const r = await fetch("/api/pedidos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: tenant.slug,
      mode,
      table: mode === "mesa" ? "1" : undefined,
      items: [{ product_id: item.productId, qty: 1, choice_ids: item.options.map((o) => o.choiceId), notes: TEST_CUSTOMER }],
      // O aviso de pedido vai para o WhatsApp da própria loja, nunca para um número inventado.
      customer: { name: TEST_CUSTOMER, phone: tenant.whatsapp },
      payment: "dinheiro",
      idempotencyKey: uid("teste"),
    }),
  });
  const d = (await r.json().catch(() => ({}))) as { id?: string; number?: number; error?: string };
  if (!r.ok || !d.id) throw new Error(d.error || "Não foi possível criar o pedido de teste.");
  return { id: d.id, number: d.number!, items: [item] };
}
