import type { Metadata } from "next";
import { Suspense } from "react";
import { SEED_SLUGS, findSeedTenant } from "@/lib/seed";
import { RemoteTenantProvider } from "@/components/loja/use-store-tenant";
import { getRealTenant } from "@/lib/server/tenant";
import { StorePage } from "./store-page";

export function generateStaticParams() {
  return SEED_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/loja/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = findSeedTenant(slug) ?? (await getRealTenant(slug));
  const name = t?.name ?? "Cardápio digital";
  return {
    title: { absolute: t ? `${t.name} · ${t.tagline}` : name },
    description: t?.description,
    manifest: `/api/manifest/${slug}`,
    icons: t && findSeedTenant(slug) ? { icon: `/tenants/${slug}/icon-192.png`, apple: `/tenants/${slug}/icon-192.png` } : undefined,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    openGraph: t ? { title: t.name, description: t.tagline, images: [t.cover] } : undefined,
  };
}

export default async function Page({ params }: PageProps<"/loja/[slug]">) {
  const { slug } = await params;
  // Loja real: dados do banco. Demo (semente): dados no navegador.
  const real = findSeedTenant(slug) ? null : await getRealTenant(slug);
  return (
    <RemoteTenantProvider tenant={real}>
      <Suspense>
        <StorePage slug={slug} />
      </Suspense>
    </RemoteTenantProvider>
  );
}
