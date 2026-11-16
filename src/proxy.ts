import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Roteamento multi-tenant por subdomínio (Cloudflare + Vercel wildcard *.ROOT_DOMAIN):
 *   cafeeflor.comandazero.com.br/        -> /loja/cafeeflor
 *   cafeeflor.comandazero.com.br/pedido/x -> /loja/cafeeflor/pedido/x
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

// Lojas de demonstração: painel aberto para visitação (dados só no navegador). As demais exigem login.
const DEMO_SLUGS = new Set((process.env.DEMO_TENANTS || "cafe-e-flor,burger-station").split(",").map((s) => s.trim()));

/** Renova a sessão do Supabase (cookies), devolve se há usuário e um cliente com a sessão dele. */
async function session(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { res, user: false, sb: null };
  let out = res;
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        const headers = new Headers(req.headers);
        headers.set("x-cz-path", req.nextUrl.pathname);
        out = NextResponse.next({ request: { headers } });
        list.forEach(({ name, value, options }) => out.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  return { res: () => out, user: !!data.user, sb };
}

/** Rota protegida? (verificação otimista; a página confere papel e loja no servidor). */
export function needsLogin(pathname: string) {
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) return true;
  if (pathname === "/painel") return false; // a própria página decide (demo ou loja do usuário)
  if (pathname === "/onboarding" || pathname === "/painel/nova-loja") return true;
  const m = /^\/painel\/([^/]+)/.exec(pathname);
  return !!m && !DEMO_SLUGS.has(m[1]);
}

// Subdomínio da loja (sem hífens, ex. "lojatestep0") → slug real ("loja-teste-p0").
const DEMO_SUBDOMAINS: Record<string, string> = { cafeeflor: "cafe-e-flor", burgerstation: "burger-station" };
async function slugFromSubdomain(sub: string) {
  if (DEMO_SUBDOMAINS[sub]) return DEMO_SUBDOMAINS[sub];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return sub;
  const r = await fetch(`${url}/rest/v1/tenants?select=slug&subdomain=eq.${encodeURIComponent(sub)}&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  }).catch(() => null);
  const rows = r?.ok ? ((await r.json()) as { slug: string }[]) : [];
  return rows[0]?.slug ?? sub;
}

export async function proxy(req: NextRequest) {
  const sub = tenantFromHost(req.headers.get("host") || "");
  if (sub) {
    const url = req.nextUrl.clone();
    if (url.pathname.startsWith("/loja/") || url.pathname.startsWith("/api/")) return NextResponse.next();
    const slug = await slugFromSubdomain(sub);
    url.pathname = `/loja/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/painel") && !path.startsWith("/super-admin") && path !== "/entrar" && path !== "/onboarding") return NextResponse.next();
  // O layout do painel usa o caminho para conferir a permissão da página (não confia no cliente).
  const headers = new Headers(req.headers);
  headers.set("x-cz-path", path);
  const s = await session(req, NextResponse.next({ request: { headers } }));
  const res = typeof s.res === "function" ? s.res() : s.res;
  if (!s.user && needsLogin(path)) {
    const to = req.nextUrl.clone();
    to.pathname = "/entrar";
    to.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  // Logado mas sem vínculo: 403 antes de a página começar a transmitir (o layout confere de novo, com o papel da página).
  if (s.user && s.sb && needsLogin(path) && path !== "/painel/nova-loja" && path !== "/onboarding") {
    const slug = /^\/painel\/([^/]+)/.exec(path)?.[1];
    const allowed = slug
      ? await s.sb.rpc("my_tenants").then(({ data }) => ((data ?? []) as { slug: string }[]).some((t) => t.slug === slug) || s.sb!.rpc("is_platform_admin").then((r) => r.data === true))
      : await s.sb.rpc("is_platform_admin").then((r) => r.data === true);
    if (!allowed) {
      const to = req.nextUrl.clone();
      to.pathname = "/acesso-negado";
      to.search = "";
      return NextResponse.rewrite(to, { status: 403 });
    }
  }
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|brand|tenants|video|.*\\.(?:png|jpg|jpeg|webp|svg|ico|json|txt|mp4)$).*)"],
};
