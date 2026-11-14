"use client";

// Escolhe a engine pela loja: demo (navegador) ou real (Supabase). As telas usam estes hooks e não sabem qual é.
import { useMemo } from "react";
import type { Order, OrderStatus, Tenant } from "@/lib/types";
import { setOrderStatus as localSetStatus, toggleProduct as localToggle, useMenu as useLocalMenu, useOrders as useLocalOrders } from "./index";
import { remoteSetStatus, remoteToggleProduct, useRemoteMenu, useRemoteOrders } from "./remote";

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
