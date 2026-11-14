import { NextResponse, type NextRequest } from "next/server";

/**
 * Roteamento multi-tenant por subdomínio (Cloudflare + Vercel wildcard *.ROOT_DOMAIN):
 *   cafeeflor.seudominio.com.br/        -> /loja/cafeeflor
 *   cafeeflor.seudominio.com.br/pedido/x -> /loja/cafeeflor/pedido/x
 *   app.* / www.* / domínio raiz           -> rotas normais (landing, painel, super admin)
 * Localhost e *.vercel.app seguem pelo caminho /loja/[slug].
 * Domínios próprios do lojista (ex.: pedidos.cafeeflor.com.br) entram via mapa CUSTOM_DOMAINS="host=slug,host=slug".
 */

const RESERVED = new Set(["www", "app", "api", "admin", "painel", "super-admin", "static", "cdn"]);

function customDomains() {
  return new Map(
    (process.env.CUSTOM_DOMAINS || "")
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((p) => p.length === 2 && p[0] && p[1])
      .map(([h, s]) => [h.toLowerCase(), s] as [string, string]),
  );
}

export function tenantFromHost(host: string, root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "") {
  const h = host.toLowerCase().split(":")[0];
  const custom = customDomains().get(h);
  if (custom) return custom;
  if (!root || h === root || !h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".") || RESERVED.has(sub)) return null;
  return sub;
}

export function proxy(req: NextRequest) {
  const slug = tenantFromHost(req.headers.get("host") || "");
  if (!slug) return NextResponse.next();
  const url = req.nextUrl.clone();
  if (url.pathname.startsWith("/loja/")) return NextResponse.next();
  url.pathname = `/loja/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|brand|tenants|.*\\.(?:png|jpg|jpeg|webp|svg|ico|json|txt)$).*)"],
};
