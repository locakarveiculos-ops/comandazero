"use client";

import { useSyncExternalStore } from "react";

// Relógio compartilhado: componentes que mostram tempo decorrido re-renderizam no intervalo, sem Date.now() no render.
function clock(ms: number) {
  let now = Math.floor(Date.now() / ms) * ms;
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    subscribe(cb: () => void) {
      subs.add(cb);
      if (!timer) {
        now = Date.now();
        timer = setInterval(() => {
          now = Date.now();
          subs.forEach((s) => s());
        }, ms);
      }
      return () => {
        subs.delete(cb);
        if (!subs.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    get: () => now,
  };
}

const minuteClock = clock(30_000);
const fastClock = clock(15_000);

/** Hora atual (ms) atualizada a cada 30 s; 0 no servidor. */
export const useMinute = () => useSyncExternalStore(minuteClock.subscribe, minuteClock.get, () => 0);
/** Hora atual (ms) atualizada a cada 15 s, para cronômetros do KDS. */
export const useTick = () => useSyncExternalStore(fastClock.subscribe, fastClock.get, () => 0);
