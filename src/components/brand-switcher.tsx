"use client";

/* eslint-disable @next/next/no-img-element -- SVGs oficiais do kit, servidos como estão */
import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { saasBrand } from "@/config/saas-brand";
import { useDb } from "@/lib/repositories";
import { mutate } from "@/lib/repositories/store";
import { cn } from "@/lib/utils";

export type SaasTheme = "light" | "dark";
type Variant = "horizontal" | "slogan" | "compact" | "vertical" | "vertical-slogan" | "symbol";

const SRC: Record<Variant, { light: string; dark: string; ratio: number }> = {
  horizontal: { light: saasBrand.assets.logoHorizontal, dark: saasBrand.assets.logoDarkBackground, ratio: saasBrand.ratio.horizontal },
  slogan: { light: saasBrand.assets.logoWithSlogan, dark: saasBrand.assets.logoDarkBackground, ratio: saasBrand.ratio.horizontal },
  compact: { light: saasBrand.assets.logoCompact, dark: saasBrand.assets.logoCompactDark, ratio: saasBrand.ratio.compact },
  vertical: { light: saasBrand.assets.logoVertical, dark: saasBrand.assets.logoVertical, ratio: saasBrand.ratio.vertical },
  "vertical-slogan": { light: saasBrand.assets.logoVerticalWithSlogan, dark: saasBrand.assets.logoVerticalWithSlogan, ratio: saasBrand.ratio.verticalWithSlogan },
  symbol: { light: saasBrand.assets.symbol, dark: saasBrand.assets.symbol, ratio: saasBrand.ratio.symbol },
};

/** Logo oficial ComandaZero. `onDark` escolhe a variante para fundo navy (nunca navy sobre navy). */
export function BrandLogo({ variant = "compact", height = 32, onDark, className }: { variant?: Variant; height?: number; onDark?: boolean; className?: string }) {
  const s = SRC[variant];
  return (
    <img
      src={onDark ? s.dark : s.light}
      alt={saasBrand.name}
      width={Math.round(height * s.ratio)}
      height={height}
      className={cn("block max-w-full shrink-0", className)}
      style={{ height, width: "auto", aspectRatio: String(s.ratio) }}
    />
  );
}

export function useSaasTheme(): SaasTheme {
  return useDb((s) => s.saasTheme);
}

/** Envolve superfícies do SaaS: aplica tokens --cz-* e o modo claro/escuro escolhido. Nunca usar em /loja. */
export function SaasSurface({ children, className, forceTheme }: { children: ReactNode; className?: string; forceTheme?: SaasTheme }) {
  const theme = useSaasTheme();
  return (
    <div className={cn("cz-saas-ui min-h-screen font-sans", className)} data-saas-theme={forceTheme ?? theme}>
      {children}
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSaasTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => mutate((s) => ({ saasTheme: s.saasTheme === "dark" ? "light" : "dark" }))}
      aria-pressed={dark}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      className={cn("grid size-11 place-items-center rounded-[10px] border border-cz-border bg-cz-surface text-cz-text hover:bg-cz-surface-2", className)}
    >
      {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
