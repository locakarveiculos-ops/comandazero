import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SITE_URL } from "@/config/saas-brand";
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
  if (!t) return { title: "Loja não encontrada", robots: { index: false, follow: false } };
  const name = t.name;
  return {
    alternates: { canonical: `${SITE_URL}/loja/${slug}` },
    title: { absolute: `${t.name} · ${t.tagline}` },
    description: t.description,
    manifest: `/api/manifest/${slug}`,
    icons: findSeedTenant(slug) ? { icon: `/tenants/${slug}/icon-192.png`, apple: `/tenants/${slug}/icon-192.png` } : undefined,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    openGraph: { title: t.name, description: t.tagline, images: t.cover ? [t.cover] : undefined, locale: "pt_BR", type: "website", url: `${SITE_URL}/loja/${slug}` },
  };
}

export default async function Page({ params }: PageProps<"/loja/[slug]">) {
  const { slug } = await params;
  // Loja real: dados do banco. Demo (semente): dados no navegador.
  const seed = findSeedTenant(slug);
  const real = seed ? null : await getRealTenant(slug);
  // Slug que não existe (nem demo, nem loja ativa no banco): 404 de verdade, não página vazia.
  if (!seed && !real) notFound();
  const t = (seed ?? real)!;
  // Dados estruturados para o Google (horário, endereço, cardápio).
  const ld = {
    "@context": "https://schema.org",
    "@type": /padaria/i.test(t.category) ? "Bakery" : /caf/i.test(t.category) ? "CafeOrCoffeeShop" : "Restaurant",
    name: t.name,
    description: t.description,
    url: `${SITE_URL}/loja/${slug}`,
    image: t.cover || undefined,
    telephone: t.whatsapp ? `+${t.whatsapp}` : undefined,
    servesCuisine: t.category,
    hasMenu: `${SITE_URL}/loja/${slug}`,
    address: t.address?.city ? { "@type": "PostalAddress", streetAddress: t.address.street || undefined, addressLocality: t.address.city, addressRegion: t.address.uf, postalCode: t.address.cep || undefined, addressCountry: "BR" } : undefined,
    openingHoursSpecification: t.hours?.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.day], opens: h.open, closes: h.close })),
  };
  return (
    <RemoteTenantProvider tenant={real}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replaceAll("<", "\u003c") }} />
      <Suspense>
        <StorePage slug={slug} />
      </Suspense>
    </RemoteTenantProvider>
  );
}
