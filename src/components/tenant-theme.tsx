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
