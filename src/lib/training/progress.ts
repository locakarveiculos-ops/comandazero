"use client";

import { useSyncExternalStore } from "react";

// Progresso de tours e artigos. Modo demo: localStorage por loja. Com Supabase ligado, vira tabela por usuário.
export type TourRecord = { version: number; status: "completed" | "skipped"; lastStep: number; updatedAt: string };
export type Progress = {
  tours: Record<string, TourRecord>;
  articles: Record<string, { done: boolean; helpful?: boolean; updatedAt: string }>;
  welcomeDismissed: boolean;
  /** Passos da ativação marcados pela própria tela (Pix salvo, pedido de teste, QR das mesas, link compartilhado). */
  checklist: Record<string, boolean>;
  /** Escolha do usuário de recolher/abrir o widget; sem escolha, abre só no Dashboard. */
  checklistCollapsed?: boolean;
  /** Pedido de teste em andamento (guia Cozinha -> Caixa). */
  testOrder?: { id: string; number: number };
};

const KEY = (tenant: string) => `cz-training:${tenant}`;
const EMPTY: Progress = { tours: {}, articles: {}, welcomeDismissed: false, checklist: {} };
const listeners = new Set<() => void>();
const cache = new Map<string, Progress>();

function read(tenant: string): Progress {
  if (cache.has(tenant)) return cache.get(tenant)!;
  let p = EMPTY;
  try {
    const raw = localStorage.getItem(KEY(tenant));
    if (raw) p = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* sem storage: progresso só nesta sessão */
  }
  cache.set(tenant, p);
  return p;
}

export function updateProgress(tenant: string, fn: (p: Progress) => Progress) {
  const next = fn(read(tenant));
  cache.set(tenant, next);
  try {
    localStorage.setItem(KEY(tenant), JSON.stringify(next));
  } catch {
    /* sem storage */
  }
  listeners.forEach((l) => l());
}

export function useProgress(tenant: string) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY(tenant)) {
          cache.delete(tenant);
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => read(tenant),
    () => EMPTY,
  );
}

export const recordTour = (tenant: string, id: string, version: number, status: TourRecord["status"], lastStep: number) =>
  updateProgress(tenant, (p) => ({ ...p, tours: { ...p.tours, [id]: { version, status, lastStep, updatedAt: new Date().toISOString() } } }));

export const markStep = (tenant: string, id: string, done = true) =>
  updateProgress(tenant, (p) => ({ ...p, checklist: { ...p.checklist, [id]: done } }));

export const markArticle = (tenant: string, id: string, patch: { done?: boolean; helpful?: boolean }) =>
  updateProgress(tenant, (p) => ({ ...p, articles: { ...p.articles, [id]: { ...p.articles[id], ...patch, done: patch.done ?? p.articles[id]?.done ?? false, updatedAt: new Date().toISOString() } } }));
