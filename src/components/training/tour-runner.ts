"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { recordTour } from "@/lib/training/progress";
import type { Tour } from "@/lib/training/types";

/**
 * Executa um tour com driver.js. Passos cuja âncora não existe nesta tela (permissão, tamanho de tela)
 * são removidos antes de iniciar, para o progresso "2 de 5" ficar correto e nada quebrar.
 * Retorna os passos pulados (diagnóstico).
 */
export function runTour(tour: Tour, tenantSlug: string): string[] {
  const skipped: string[] = [];
  const visible = (sel: string) => {
    const el = document.querySelector(`[data-tour="${sel}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  };
  const steps: DriveStep[] = tour.steps.flatMap((s) => {
    if (s.anchor && !visible(s.anchor)) {
      skipped.push(s.anchor);
      return [];
    }
    return [{ element: s.anchor ? `[data-tour="${s.anchor}"]` : undefined, popover: { title: s.title, description: s.text, side: s.side, align: "start" as const } }];
  });
  if (!steps.length) return skipped;

  const opener = document.activeElement as HTMLElement | null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let finished = false;

  const d = driver({
    steps,
    animate: !reduceMotion,
    smoothScroll: !reduceMotion,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Anterior",
    doneBtnText: "Concluir",
    closeBtnLabel: "Sair do tour",
    allowKeyboardControl: true,
    overlayColor: "#08162d",
    overlayOpacity: 0.62,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: "cz-tour",
    // O tour só mostra: cliques nos elementos destacados ficam bloqueados (nada é executado sem querer).
    disableActiveInteraction: true,
    onDoneClick: () => {
      finished = true;
      recordTour(tenantSlug, tour.id, tour.version, "completed", steps.length - 1);
      d.destroy();
    },
    onDestroyed: () => {
      if (!finished) recordTour(tenantSlug, tour.id, tour.version, "skipped", d.getActiveIndex() ?? 0);
      opener?.focus?.();
    },
    onPopoverRender: (pop) => {
      pop.wrapper.setAttribute("role", "dialog");
      pop.wrapper.setAttribute("aria-modal", "false");
      pop.wrapper.setAttribute("aria-labelledby", "cz-tour-title");
      pop.title.id = "cz-tour-title";
      // Foco no botão principal para Enter/Tab funcionarem de imediato.
      requestAnimationFrame(() => pop.nextButton.focus());
    },
  });
  d.drive();
  return skipped;
}
