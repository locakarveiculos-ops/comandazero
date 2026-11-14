"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { onStorageError, reloadFromStorage, useDb } from "@/lib/repositories";
import { STORAGE_KEY } from "@/lib/repositories/store";
import { subscribe } from "@/lib/repositories/events";
import { unlockAudio } from "@/lib/sound";

/** Hidrata o banco local, sincroniza entre abas e aplica a marca do SaaS escolhida no seletor. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useDb.persist.rehydrate();
    onStorageError((msg) => toast.error(msg));
    const off = subscribe((e, local) => {
      if (!local && e.type === "db:update") reloadFromStorage();
    });
    // Reserva para navegadores sem BroadcastChannel: o evento "storage" chega nas outras abas.
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) reloadFromStorage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <>
      {children}
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
    </>
  );
}

/** true depois que o estado salvo no navegador foi carregado (evita piscar dados de demonstração). */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useDb.persist.onFinishHydration(cb),
    () => useDb.persist.hasHydrated(),
    () => false,
  );
}
