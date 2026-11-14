"use client";

// Camada de repositório. As telas só falam com estas funções; na Fase 2 elas passam a chamar o Supabase.
import { useMemo } from "react";
import { defaultIntegrations, defaultTables } from "../seed";
import type {
  CartItem,
  Channel,
  Coupon,
  IntegrationSettings,
  Order,
  OrderMode,
  OrderStatus,
  PaymentSplit,
  Product,
  Tenant,
} from "../types";
import { cartSubtotal, round2, toWhatsappNumber, uid } from "../utils";
import { TAB_ID, emit } from "./events";
import { mutate, useDb } from "./store";

export { useDb, resetDb, reloadFromStorage, onStorageError } from "./store";

const now = () => new Date().toISOString();

/* ---------- Tenants ---------- */

export const useTenant = (slug: string) => useDb((s) => s.tenants.find((t) => t.slug === slug));

export function updateTenant(id: string, patch: Partial<Tenant>) {
  mutate((s) => ({ tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

/** Cria a loja já com um cardápio modelo (cópia do da loja de referência) para não nascer vazia. */
export function createTenant(t: Tenant, templateTenantId = "t_cafe") {
  mutate((s) => {
    if (s.tenants.some((x) => x.slug === t.slug)) throw new Error("Já existe uma loja com esse endereço");
    const catMap = new Map<string, string>();
    const categories = s.categories
      .filter((c) => c.tenantId === templateTenantId)
      .map((c) => {
        const id = uid("c_");
        catMap.set(c.id, id);
        return { ...c, id, tenantId: t.id };
      });
    const products = s.products
      .filter((p) => p.tenantId === templateTenantId)
      .map((p) => ({ ...structuredClone(p), id: uid("p_"), tenantId: t.id, categoryId: catMap.get(p.categoryId) ?? p.categoryId }));
    return {
      tenants: [...s.tenants, { ...t, loyalty: { ...t.loyalty, categoryIds: t.loyalty.categoryIds.map((c) => catMap.get(c) ?? c) } }],
      categories: [...s.categories, ...categories],
      products: [...s.products, ...products],
      tables: [...s.tables, ...defaultTables(t)],
      integrations: [...s.integrations, defaultIntegrations(t.id)],
    };
  });
}

/* ---------- Cardápio ---------- */

export function useMenu(tenantId: string | undefined) {
  const categories = useDb((s) => s.categories);
  const products = useDb((s) => s.products);
  return useMemo(
    () => ({
      categories: categories.filter((c) => c.tenantId === tenantId).sort((a, b) => a.order - b.order),
      products: products.filter((p) => p.tenantId === tenantId),
    }),
    [categories, products, tenantId],
  );
}

export function saveProduct(product: Product) {
  mutate((s) => ({
    products: s.products.some((p) => p.id === product.id)
      ? s.products.map((p) => (p.id === product.id ? product : p))
      : [...s.products, product],
  }));
}

export function toggleProduct(id: string) {
  mutate((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, available: !p.available } : p)) }));
}

export function deleteProduct(id: string) {
  mutate((s) => ({ products: s.products.filter((p) => p.id !== id) }));
}

export function addCategory(tenantId: string, name: string) {
  mutate((s) => {
    const order = Math.max(0, ...s.categories.filter((c) => c.tenantId === tenantId).map((c) => c.order)) + 1;
    return { categories: [...s.categories, { id: uid("c_"), tenantId, name, icon: "Utensils", order }] };
  });
}

/* ---------- Carrinho do cliente ---------- */

export const useCart = (tenantId: string) => useDb((s) => s.carts[tenantId] ?? EMPTY);
const EMPTY: CartItem[] = [];

const setCart = (tenantId: string, fn: (items: CartItem[]) => CartItem[]) =>
  mutate((s) => ({ carts: { ...s.carts, [tenantId]: fn(s.carts[tenantId] ?? []) } }));

export function addToCart(tenantId: string, item: Omit<CartItem, "key">) {
  setCart(tenantId, (items) => {
    // Itens idênticos (mesmas opções e observações) somam quantidade em vez de duplicar a linha.
    const sig = JSON.stringify([item.productId, item.options.map((o) => o.choiceId).sort(), item.notes, item.cake ?? null]);
    const same = items.find(
      (i) => JSON.stringify([i.productId, i.options.map((o) => o.choiceId).sort(), i.notes, i.cake ?? null]) === sig,
    );
    if (same) return items.map((i) => (i === same ? { ...i, qty: i.qty + item.qty } : i));
    return [...items, { ...item, key: uid() }];
  });
}

export function setCartQty(tenantId: string, key: string, qty: number) {
  setCart(tenantId, (items) => (qty <= 0 ? items.filter((i) => i.key !== key) : items.map((i) => (i.key === key ? { ...i, qty } : i))));
}

export const clearCart = (tenantId: string) => setCart(tenantId, () => []);

export function rememberCustomer(name: string, phone: string) {
  mutate(() => ({ customer: { name, phone } }));
}

/* ---------- Pedidos ---------- */

export function useOrders(tenantId: string | undefined) {
  const orders = useDb((s) => s.orders);
  return useMemo(
    () => orders.filter((o) => o.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, tenantId],
  );
}

export const useOrder = (id: string) => useDb((s) => s.orders.find((o) => o.id === id));

export type NewOrderInput = {
  tenantId: string;
  channel: Channel;
  mode: OrderMode;
  items: CartItem[];
  deliveryFee?: number;
  discount?: number;
  payments: PaymentSplit[];
  gateway: Order["gateway"];
  paid?: boolean;
  customer: { name: string; phone: string };
  address?: Order["address"];
  table?: string;
  scheduledFor?: string;
  deposit?: number;
  changeFor?: number;
  coupon?: string;
};

export function createOrder(input: NewOrderInput): Order {
  let created!: Order;
  mutate((s) => {
    const number = Math.max(1000, ...s.orders.filter((o) => o.tenantId === input.tenantId).map((o) => o.number)) + 1;
    const subtotal = cartSubtotal(input.items);
    const deliveryFee = input.deliveryFee ?? 0;
    const discount = input.discount ?? 0;
    const at = now();
    created = {
      id: uid("o"),
      number,
      tenantId: input.tenantId,
      channel: input.channel,
      mode: input.mode,
      status: "recebido",
      paymentStatus: input.paid ? (input.deposit ? "parcial" : "pago") : "pendente",
      payments: input.payments,
      paymentMethod: input.payments[0]?.method ?? "dinheiro",
      gateway: input.gateway,
      items: input.items,
      subtotal,
      deliveryFee,
      discount,
      total: round2(Math.max(0, subtotal + deliveryFee - discount)),
      changeFor: input.changeFor,
      customer: { name: input.customer.name.trim(), phone: input.customer.phone ? toWhatsappNumber(input.customer.phone) : "" },
      address: input.address,
      table: input.table,
      scheduledFor: input.scheduledFor,
      deposit: input.deposit,
      coupon: input.coupon,
      createdAt: at,
      updatedAt: at,
      history: [{ status: "recebido", at }],
      seen: false,
    };
    const coupons = input.coupon
      ? s.coupons.map((c) => (c.tenantId === input.tenantId && c.code === input.coupon ? { ...c, uses: c.uses + 1 } : c))
      : s.coupons;
    return { orders: [created, ...s.orders], coupons, loyalty: applyLoyalty(s, created) };
  });
  emit({ type: "order:new", origin: TAB_ID, tenantId: created.tenantId, orderId: created.id, number: created.number });
  return created;
}

function applyLoyalty(s: ReturnType<typeof useDb.getState>, order: Order) {
  const tenant = s.tenants.find((t) => t.id === order.tenantId);
  if (!tenant?.loyalty.enabled || !order.customer.phone) return s.loyalty;
  const eligible = new Set(s.products.filter((p) => tenant.loyalty.categoryIds.includes(p.categoryId)).map((p) => p.id));
  const stamps = order.items.filter((i) => eligible.has(i.productId)).reduce((n, i) => n + i.qty, 0);
  const cashback = round2((order.total * tenant.loyalty.cashbackPct) / 100);
  if (!stamps && !cashback) return s.loyalty;
  const existing = s.loyalty.find((l) => l.tenantId === tenant.id && l.phone === order.customer.phone);
  if (!existing)
    return [...s.loyalty, { tenantId: tenant.id, phone: order.customer.phone, name: order.customer.name, stamps, redeemed: 0, cashback }];
  return s.loyalty.map((l) => (l === existing ? { ...l, stamps: l.stamps + stamps, cashback: round2(l.cashback + cashback) } : l));
}

export function setOrderStatus(id: string, status: OrderStatus) {
  let tenantId = "";
  mutate((s) => ({
    orders: s.orders.map((o) => {
      if (o.id !== id) return o;
      tenantId = o.tenantId;
      return { ...o, status, seen: true, updatedAt: now(), history: [...o.history, { status, at: now() }] };
    }),
  }));
  emit({ type: "order:status", origin: TAB_ID, tenantId, orderId: id, status });
}

export function markOrderPaid(id: string, payments?: PaymentSplit[]) {
  mutate((s) => ({
    orders: s.orders.map((o) =>
      o.id === id
        ? { ...o, paymentStatus: o.deposit && !payments ? "parcial" : "pago", payments: payments ?? o.payments, updatedAt: now() }
        : o,
    ),
  }));
}

export function markOrdersSeen(tenantId: string) {
  mutate((s) => ({ orders: s.orders.map((o) => (o.tenantId === tenantId && !o.seen ? { ...o, seen: true } : o)) }));
}

/* ---------- Mesas ---------- */

export function useTables(tenantId: string | undefined) {
  const tables = useDb((s) => s.tables);
  return useMemo(() => tables.filter((t) => t.tenantId === tenantId), [tables, tenantId]);
}

const patchTable = (tenantId: string, number: string, fn: (t: ReturnType<typeof useDb.getState>["tables"][number]) => Partial<ReturnType<typeof useDb.getState>["tables"][number]>) =>
  mutate((s) => ({ tables: s.tables.map((t) => (t.tenantId === tenantId && t.number === number ? { ...t, ...fn(t) } : t)) }));

export function openTable(tenantId: string, number: string, people = 2) {
  patchTable(tenantId, number, (t) => ({ state: "ocupada", openedAt: t.openedAt ?? now(), people: t.people || people }));
}

export function addToTable(tenantId: string, number: string, items: CartItem[]) {
  patchTable(tenantId, number, (t) => ({
    state: t.state === "livre" ? "ocupada" : t.state,
    openedAt: t.openedAt ?? now(),
    people: t.people || 1,
    items: [...t.items, ...items.map((i) => ({ ...i, key: uid() }))],
  }));
}

export function removeTableItem(tenantId: string, number: string, key: string) {
  patchTable(tenantId, number, (t) => ({ items: t.items.filter((i) => i.key !== key) }));
}

export function requestBill(tenantId: string, number: string) {
  patchTable(tenantId, number, () => ({ state: "conta" }));
  emit({ type: "table:call", origin: TAB_ID, tenantId, table: number });
}

export function closeTable(tenantId: string, number: string) {
  patchTable(tenantId, number, () => ({ state: "livre", openedAt: undefined, items: [], people: 0 }));
}

export function transferTable(tenantId: string, from: string, to: string) {
  mutate((s) => {
    const src = s.tables.find((t) => t.tenantId === tenantId && t.number === from);
    const dst = s.tables.find((t) => t.tenantId === tenantId && t.number === to);
    if (!src || !dst) return {};
    return {
      tables: s.tables.map((t) => {
        if (t === dst)
          return {
            ...t,
            state: src.state === "conta" ? "conta" : "ocupada",
            openedAt: dst.openedAt ?? src.openedAt,
            people: dst.people + src.people,
            items: [...dst.items, ...src.items],
          };
        if (t === src) return { ...t, state: "livre", openedAt: undefined, items: [], people: 0 };
        return t;
      }),
    };
  });
}

/* ---------- Cupons e fidelidade ---------- */

export function useCoupons(tenantId: string | undefined) {
  const coupons = useDb((s) => s.coupons);
  return useMemo(() => coupons.filter((c) => c.tenantId === tenantId), [coupons, tenantId]);
}

export const findCoupon = (tenantId: string, code: string): Coupon | undefined =>
  useDb.getState().coupons.find((c) => c.tenantId === tenantId && c.code === code.trim().toUpperCase());

export function saveCoupon(c: Coupon) {
  mutate((s) => ({
    coupons: s.coupons.some((x) => x.id === c.id) ? s.coupons.map((x) => (x.id === c.id ? c : x)) : [...s.coupons, c],
  }));
}

export function useLoyalty(tenantId: string | undefined) {
  const loyalty = useDb((s) => s.loyalty);
  return useMemo(() => loyalty.filter((l) => l.tenantId === tenantId).sort((a, b) => b.stamps - a.stamps), [loyalty, tenantId]);
}

export function redeemLoyalty(tenantId: string, phone: string, goal: number) {
  mutate((s) => ({
    loyalty: s.loyalty.map((l) =>
      l.tenantId === tenantId && l.phone === phone && l.stamps >= goal ? { ...l, stamps: l.stamps - goal, redeemed: l.redeemed + 1 } : l,
    ),
  }));
}

/* ---------- Integrações ---------- */

export const useIntegrations = (tenantId: string | undefined) =>
  useDb((s) => s.integrations.find((i) => i.tenantId === tenantId));

export function updateIntegrations(tenantId: string, fn: (i: IntegrationSettings) => IntegrationSettings) {
  mutate((s) => ({
    integrations: s.integrations.some((i) => i.tenantId === tenantId)
      ? s.integrations.map((i) => (i.tenantId === tenantId ? fn(i) : i))
      : [...s.integrations, fn(defaultIntegrations(tenantId))],
  }));
}
