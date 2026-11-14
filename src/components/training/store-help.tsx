"use client";

import { CircleHelp } from "lucide-react";
import { TOURS } from "@/lib/training/tours";
import { runTour } from "./tour-runner";

/** Ajuda opcional do cardápio: só abre quando o cliente toca (sem popups automáticos). */
export function StoreHelp({ slug }: { slug: string }) {
  const tour = TOURS.find((t) => t.id === "loja-cliente")!;
  return (
    <button
      type="button"
      onClick={() => runTour(tour, slug)}
      aria-label="Como pedir"
      data-testid="ajuda-loja"
      className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-paper"
    >
      <CircleHelp className="size-5" aria-hidden />
    </button>
  );
}
