import "server-only";
import { cache } from "react";
import { tenantFromRow } from "@/lib/supabase/mappers";
import { supabaseAnon, supabaseReady } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types";

/** Loja real (is_demo = false) com zonas de entrega, lida com a chave pública (RLS: só lojas ativas). */
export const getRealTenant = cache(async (slug: string): Promise<Tenant | null> => {
  if (!supabaseReady()) return null;
  const sb = supabaseAnon();
  const { data } = await sb.from("tenants").select("*, delivery_zones(*)").eq("slug", slug).eq("is_demo", false).maybeSingle();
  if (!data) return null;
  return tenantFromRow(data, data.delivery_zones ?? []);
});
