import { Suspense } from "react";
import { RemoteTenantProvider } from "@/components/loja/use-store-tenant";
import { getRealTenant } from "@/lib/server/tenant";
import { findSeedTenant } from "@/lib/seed";
import { Tracking } from "./tracking";

export const metadata = { title: "Acompanhar pedido", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/loja/[slug]/pedido/[id]">) {
  const { slug, id } = await params;
  const real = findSeedTenant(slug) ? null : await getRealTenant(slug);
  return (
    <RemoteTenantProvider tenant={real}>
      <Suspense>
        <Tracking slug={slug} id={id} />
      </Suspense>
    </RemoteTenantProvider>
  );
}
