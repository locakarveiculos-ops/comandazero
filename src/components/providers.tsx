"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { onStorageError, reloadFromStorage, useDb } from "@/lib/repositories";
import { STORAGE_KEY } from "@/lib/repositories/store";
import { subscribe } from "@/lib/repositories/events";
import { unlockAudio } from "@/lib/sound";

/** Hidrata o banco local, sincroniza entre abas e registra o service worker. */
export function Providers({ children }: { children: ReactNode }) {
  const saasTheme = useDb((s) => s.saasTheme);
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
      {/* Toasts ficam num portal no <body>: estilo próprio, legível sobre o SaaS e sobre qualquer loja. */}
      <Toaster
        position="top-center"
        richColors
        closeButton
        theme={saasTheme}
        toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 10 }, classNames: { closeButton: "!size-6" } }}
      />
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
