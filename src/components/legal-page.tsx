import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo, SaasSurface } from "@/components/brand-switcher";

/** Moldura das páginas legais: leitura confortável (até 70 caracteres por linha), versão visível no topo. */
export function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  const date = new Date(`${version}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <SaasSurface>
      <header className="border-b border-cz-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="ComandaZero, início" className="inline-flex min-h-11 items-center">
            <BrandLogo variant="compact" height={28} />
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold hover:bg-cz-surface-2">
            <ArrowLeft className="size-4" aria-hidden /> Início
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="cz-heading text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-cz-muted">
          Versão {version} · vigente desde {date}
        </p>
        <div className="legal-prose mt-8 grid max-w-[70ch] gap-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-cz-gold-text [&_a]:underline">
          {children}
        </div>
      </main>
    </SaasSurface>
  );
}
