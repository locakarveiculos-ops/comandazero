"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Target = { kind: "staff"; slug: string } | { kind: "customer"; orderId: string; token: string };
type State = "loading" | "unsupported" | "denied" | "off" | "on";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Chave VAPID pública (base64url) no formato que o pushManager aceita. */
function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !KEY) return null;
  return navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
}

/**
 * Liga/desliga a notificação push neste aparelho.
 * Equipe: "Novo pedido" mesmo com o painel fechado. Cliente: cada etapa do pedido.
 * No iPhone só funciona com o app instalado na tela inicial (limitação do iOS).
 */
export function PushToggle({ target, className, variant = "staff" }: { target: Target; className?: string; variant?: "staff" | "customer" }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const reg = await registration().catch(() => null);
      if (!alive) return;
      if (!reg) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      if (alive) setState(sub ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    const reg = await registration();
    if (!reg) return setState("unsupported");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
    setState("loading");
    try {
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...target, subscription: sub.toJSON() }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Não foi possível ativar.");
      setState("on");
      toast.success(variant === "staff" ? "Avisos de pedido novo ligados neste aparelho." : "Pronto! Avisamos você a cada etapa do pedido.");
    } catch (e) {
      setState("off");
      toast.error((e as Error).message);
    }
  };

  const disable = async () => {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
    setState("off");
    toast.success("Avisos desligados neste aparelho.");
  };

  if (state === "loading") return null;
  if (state === "unsupported")
    return variant === "customer" ? null : (
      <p className={cn("text-xs text-cz-muted", className)} data-testid="push-indisponivel">
        Avisos com a tela bloqueada: no iPhone, instale o app na tela inicial; em outros aparelhos, use Chrome, Edge ou Firefox.
      </p>
    );
  if (state === "denied")
    return (
      <p className={cn("text-xs", className)} role="status">
        Notificações bloqueadas no navegador. Libere em Configurações do site para receber avisos.
      </p>
    );

  const on = state === "on";
  const base = variant === "staff" ? "border border-cz-border bg-cz-surface hover:bg-cz-surface-2" : "border border-line bg-surface text-ink hover:bg-paper";
  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      aria-pressed={on}
      data-testid="push-toggle"
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-semibold", base, className)}
    >
      {on ? <BellRing className="size-4" aria-hidden /> : variant === "staff" ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
      {variant === "staff" ? (on ? "Avisos no aparelho: ligados" : "Avisar pedidos com a tela bloqueada") : on ? "Avisos do pedido ligados" : "Me avise quando ficar pronto"}
    </button>
  );
}
