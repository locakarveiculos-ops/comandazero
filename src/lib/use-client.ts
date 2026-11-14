"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Valor só do navegador sem quebrar a hidratação: no servidor e no 1º render usa `fallback`. */
export function useClientValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noop, read, () => fallback);
}

export const useOrigin = () => useClientValue(() => window.location.origin, "");
