import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/saas-brand";
import { supabaseAnon, supabaseReady } from "@/lib/supabase/server";

export const revalidate = 3600;

/** Landing, páginas legais e cardápios das lojas reais ativas (demonstrações não entram). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!supabaseReady()) return pages;
  const { data } = await supabaseAnon().from("tenants").select("slug, updated_at").eq("is_demo", false).eq("active", true).limit(5000);
  return [...pages, ...(data ?? []).map((t) => ({ url: `${SITE_URL}/loja/${t.slug}`, lastModified: t.updated_at, changeFrequency: "daily" as const, priority: 0.7 }))];
}
