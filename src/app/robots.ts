import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/saas-brand";

/** Indexa landing, lojas e páginas legais; painel, super admin, APIs e telas de conta ficam fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/loja/", "/termos", "/privacidade"], disallow: ["/painel", "/super-admin", "/api/", "/entrar", "/onboarding", "/auth/", "/redefinir-senha", "/acesso-negado"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
