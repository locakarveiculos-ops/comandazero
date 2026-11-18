"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";

export function themeVars(t: Tenant["theme"]): CSSProperties {
  return {
    "--t-paper": t.paper,
    "--t-surface": t.surface,
    "--t-ink": t.ink,
    "--t-muted": t.muted,
    "--t-primary": t.primary,
    "--t-primary-ink": t.primaryInk,
    "--t-secondary": t.secondary,
    "--t-accent": t.accent,
    "--t-accent-text": t.accentText,
    "--t-highlight": t.highlight,
    "--t-line": t.line,
    colorScheme: t.dark ? "dark" : "light",
  } as CSSProperties;
}

/** Aplica as cores e a tipografia de um estabelecimento ao trecho da página. */
export function TenantTheme({ tenant, children, className }: { tenant: Tenant; children: ReactNode; className?: string }) {
  return (
    <div style={themeVars(tenant.theme)} className={cn("tenant bg-paper text-ink", className)} data-display={tenant.theme.fontDisplay}>
      {children}
    </div>
  );
}

export const displayFont = (t: Tenant) => (t.theme.fontDisplay === "serif" ? "font-serif" : "font-display uppercase tracking-tight");

/** Iniciais da loja ("QA Teste Burger" -> "QB"): usadas quando não há logo (QA-10). */
export const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : (w[0]?.[1] ?? ""))).toUpperCase() || "?";
};

/** Logo da loja ou, sem logo, as iniciais na cor da marca. Nunca <img src="">. */
export function TenantLogo({ tenant, className, alt = "" }: { tenant: Pick<Tenant, "logo" | "name" | "theme">; className?: string; alt?: string }) {
  if (tenant.logo)
    // eslint-disable-next-line @next/next/no-img-element -- logo pode vir de upload
    return <img src={tenant.logo} alt={alt} className={cn("object-cover", className)} />;
  return (
    <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={cn("grid place-items-center font-bold", className)} style={{ background: tenant.theme.primary, color: tenant.theme.primaryInk }}>
      {initials(tenant.name)}
    </span>
  );
}
