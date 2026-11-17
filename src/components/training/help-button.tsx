"use client";

import { BookOpen, CircleHelp, PlayCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { ARTICLES } from "@/lib/training/articles";
import { recordTour, updateProgress, useProgress } from "@/lib/training/progress";
import { TOURS } from "@/lib/training/tours";
import type { Persona } from "@/lib/training/types";
import { cn } from "@/lib/utils";
import { runTour } from "./tour-runner";

/** Converte a rota real em rota de registro (/painel/cafe-e-flor/pdv -> /painel/{slug}/pdv). */
export const routeKey = (path: string, slug: string) => path.replace(`/painel/${slug}`, "/painel/{slug}").replace(`/loja/${slug}`, "/loja/{slug}").replace(/\/$/, "") || "/";

/** "? Ajuda desta tela": tour contextual + artigo da tela + atalho para a central. */
export function HelpButton({ slug, variant = "saas", className }: { slug: string; variant?: "saas" | "tenant"; className?: string }) {
  const path = usePathname();
  const key = routeKey(path, slug);
  const tours = TOURS.filter((t) => t.route === key);
  const articles = ARTICLES.filter((a) => a.route === key);
  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  if (!tours.length && !articles.length) return null;

  const start = (id: string) => {
    setOpen(false);
    // Espera o modal fechar e o foco voltar antes de destacar elementos.
    setTimeout(() => setSkipped(runTour(TOURS.find((t) => t.id === id)!, slug)), 180);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajuda desta tela"
        data-testid="ajuda-tela"
        className={cn(
          "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold",
          variant === "saas" ? "border-cz-border bg-cz-surface hover:bg-cz-surface-2" : "border-line bg-surface text-ink",
          className,
        )}
      >
        <CircleHelp className="size-[18px]" aria-hidden />
        <span className="hidden md:inline">Ajuda</span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Ajuda desta tela" description="Tour guiado e guias com prints reais.">
        <div className="grid gap-4 p-5">
          {tours.map((t) => (
            <Button key={t.id} variant="brand" size="lg" className="justify-start" onClick={() => start(t.id)}>
              <PlayCircle className="size-5" aria-hidden /> Iniciar tour: {t.title}
            </Button>
          ))}
          {articles.map((a) => (
            <Link key={a.id} href={`/painel/${slug}/treinamento?artigo=${a.id}`} className="flex min-h-11 items-start gap-3 rounded-[10px] border border-ui-border p-3 hover:bg-ui-surface-2">
              <BookOpen className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">{a.title}</span>
                <span className="block text-sm opacity-80">{a.summary}</span>
              </span>
            </Link>
          ))}
          {variant === "saas" && (
            <Link href={`/painel/${slug}/treinamento`} className="text-center text-sm font-semibold underline underline-offset-2">
              Abrir Central de treinamento
            </Link>
          )}
        </div>
      </Modal>
      {skipped.length > 0 && <span className="sr-only" data-testid="tour-skipped">{skipped.join(",")}</span>}
    </>
  );
}

/** Convite discreto na primeira visita ao painel (por loja), com Começar, Agora não e Não mostrar novamente. */
export function WelcomeTour({ slug, persona = "proprietario" }: { slug: string; persona?: Persona }) {
  const progress = useProgress(slug);
  const path = usePathname();
  const tour = TOURS.find((t) => t.id === "painel-visao-geral")!;
  const [later, setLater] = useState(false);
  const seen = progress.welcomeDismissed || progress.tours[tour.id];
  if (seen || later || routeKey(path, slug) !== tour.route || persona === "cliente") return null;
  return (
    <div role="region" aria-label="Boas-vindas" className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] border border-cz-gold/50 bg-cz-surface p-4">
      <PlayCircle className="size-6 text-cz-gold-text" aria-hidden />
      <p className="min-w-48 flex-1 text-sm">
        <b>Primeira vez por aqui?</b> Um tour de 1 minuto mostra onde fica cada coisa.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" size="sm" onClick={() => runTour(tour, slug)}>
          Começar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setLater(true)}>
          Agora não
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            updateProgress(slug, (p) => ({ ...p, welcomeDismissed: true }));
            recordTour(slug, tour.id, tour.version, "skipped", 0);
          }}
        >
          Não mostrar novamente
        </Button>
      </div>
    </div>
  );
}
