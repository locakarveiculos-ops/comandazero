import { findSeedTenant } from "@/lib/seed";
import { saasBrand } from "@/config/saas-brand";

/**
 * Web App Manifest dinâmico.
 *  /api/manifest/saas          -> PWA administrativo do SaaS (painel)
 *  /api/manifest/<slug>        -> PWA da loja, com nome, ícone, cores e start_url próprios
 *  Lojas criadas no navegador (Fase 1) mandam ?n=&c=&b= para o manifest refletir a marca escolhida.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const q = new URL(req.url).searchParams;

  if (slug === "saas") {
    // App do lojista/administrador. Escopo /painel: nunca alcança /loja/* (o cliente instala a marca da loja).
    const a = saasBrand.assets;
    return manifest({
      id: "/painel",
      name: `${saasBrand.name} · Painel`,
      short_name: saasBrand.shortName,
      description: saasBrand.slogan,
      start_url: "/painel?source=pwa",
      scope: "/painel",
      theme_color: saasBrand.palette.navy,
      background_color: saasBrand.palette.warmWhite,
      icons: [
        { src: a.pwa192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: a.pwa512, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: a.pwaMaskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: a.pwaMaskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    });
  }

  if (!SLUG.test(slug)) return Response.json({ error: "slug inválido" }, { status: 400 });
  const t = findSeedTenant(slug);
  const name = (q.get("n") || t?.name || slug).slice(0, 45);
  const color = HEX.test(q.get("c") || "") ? q.get("c")! : t?.theme.primary || saasBrand.palette.navy;
  const bg = HEX.test(q.get("b") || "") ? q.get("b")! : t?.theme.paper || "#FFFFFF";
  const icon = (size: number) => (t ? `/tenants/${slug}/icon-${size}.png` : `/api/tenant-icon/${slug}?size=${size}&c=${encodeURIComponent(color)}&n=${encodeURIComponent(name)}`);

  return manifest({
    id: `/loja/${slug}`,
    name,
    short_name: name.length > 12 ? name.split(" ").slice(0, 2).join(" ").slice(0, 12) : name,
    description: t?.tagline || `Cardápio digital de ${name}`,
    start_url: `/loja/${slug}?source=pwa`,
    scope: `/loja/${slug}`,
    display: "standalone",
    orientation: "portrait",
    theme_color: color,
    background_color: bg,
    categories: ["food", "shopping"],
    lang: "pt-BR",
    icons: [
      { src: icon(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Meus pedidos", url: `/loja/${slug}?aba=pedidos`, icons: [{ src: icon(192), sizes: "192x192" }] }],
  });
}

function manifest(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ display: "standalone", lang: "pt-BR", ...body }), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
