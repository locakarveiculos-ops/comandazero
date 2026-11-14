"use client";

import { useHydrated } from "@/components/providers";
import { useTenant } from "@/lib/repositories";
import { findSeedTenant } from "@/lib/seed";

/** Tenant da URL: usa o salvo no navegador (com edições do lojista) e, antes de hidratar, o da semente. */
export function useStoreTenant(slug: string) {
  const hydrated = useHydrated();
  const stored = useTenant(slug);
  const tenant = hydrated ? stored : (stored ?? findSeedTenant(slug));
  return { tenant, hydrated, notFound: hydrated && !stored };
}
