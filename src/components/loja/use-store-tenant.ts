"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";
import { useHydrated } from "@/components/providers";
import { useTenant } from "@/lib/repositories";
import { findSeedTenant } from "@/lib/seed";
import type { Tenant } from "@/lib/types";

/** Loja real carregada pelo servidor (Supabase). Ausente = loja de demonstração (navegador). */
const RemoteTenantContext = createContext<Tenant | null>(null);

export function RemoteTenantProvider({ tenant, children }: { tenant: Tenant | null; children: ReactNode }) {
  return createElement(RemoteTenantContext.Provider, { value: tenant }, children);
}

export const useRemoteTenant = () => useContext(RemoteTenantContext);

/** Tenant da URL: loja real vem do servidor; demo usa o salvo no navegador (e a semente antes de hidratar). */
export function useStoreTenant(slug: string) {
  const remote = useRemoteTenant();
  const hydrated = useHydrated();
  const stored = useTenant(slug);
  if (remote && remote.slug === slug) return { tenant: remote, hydrated: true, notFound: false };
  const tenant = hydrated ? stored : (stored ?? findSeedTenant(slug));
  return { tenant, hydrated, notFound: hydrated && !stored };
}
