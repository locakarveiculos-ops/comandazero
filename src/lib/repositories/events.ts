// Barramento entre abas: o cardápio publica "order:new" e o KDS/PDV de outra aba reage na hora.
// Na Fase 2 este arquivo passa a escutar o Supabase Realtime com a mesma assinatura.

export type SyncEvent =
  | { type: "db:update"; origin: string }
  | { type: "order:new"; origin: string; tenantId: string; orderId: string; number: number }
  | { type: "order:status"; origin: string; tenantId: string; orderId: string; status: string }
  | { type: "table:call"; origin: string; tenantId: string; table: string };

const CHANNEL = "comandazero-sync";
export const TAB_ID = typeof window === "undefined" ? "server" : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
const getChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
};

type Listener = (e: SyncEvent, local: boolean) => void;
const listeners = new Set<Listener>();

export function emit(event: SyncEvent) {
  listeners.forEach((l) => l(event, true));
  getChannel()?.postMessage(event);
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  const ch = getChannel();
  const onMessage = (m: MessageEvent<SyncEvent>) => {
    if (m.data?.origin !== TAB_ID) listener(m.data, false);
  };
  ch?.addEventListener("message", onMessage);
  return () => {
    listeners.delete(listener);
    ch?.removeEventListener("message", onMessage);
  };
}
