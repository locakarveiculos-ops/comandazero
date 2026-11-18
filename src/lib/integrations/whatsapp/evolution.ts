// Provedor 2: Evolution API (v1/v2). Envia texto e mídia, gerencia instância, QR de conexão e webhook.
// Os builders são puros (usados pelo testador de payload do painel); evolutionRequest só roda no servidor.

export type EvolutionVersion = "v1" | "v2";
export type EvolutionCall = { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; body?: unknown };

const num = (to: string) => to.replace(/\D/g, "");

export const evolution = {
  sendText: (instance: string, to: string, text: string, v: EvolutionVersion = "v2"): EvolutionCall => ({
    method: "POST",
    path: `/message/sendText/${instance}`,
    body: v === "v2" ? { number: num(to), text, delay: 800 } : { number: num(to), options: { delay: 800 }, textMessage: { text } },
  }),
  sendMedia: (instance: string, to: string, media: { url: string; caption?: string; mediatype?: "image" | "document"; fileName?: string }, v: EvolutionVersion = "v2"): EvolutionCall => {
    const m = { mediatype: media.mediatype ?? "image", media: media.url, caption: media.caption ?? "", fileName: media.fileName };
    return { method: "POST", path: `/message/sendMedia/${instance}`, body: v === "v2" ? { number: num(to), ...m } : { number: num(to), mediaMessage: m } };
  },
  // webhookUrl opcional: sem ele a instância só envia (avisos de pedido); com ele, recebe mensagens.
  createInstance: (instance: string, webhookUrl?: string): EvolutionCall => ({
    method: "POST",
    path: "/instance/create",
    body: {
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      ...(webhookUrl ? { webhook: { url: webhookUrl, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } } : {}),
    },
  }),
  connect: (instance: string): EvolutionCall => ({ method: "GET", path: `/instance/connect/${instance}` }),
  state: (instance: string): EvolutionCall => ({ method: "GET", path: `/instance/connectionState/${instance}` }),
  logout: (instance: string): EvolutionCall => ({ method: "DELETE", path: `/instance/logout/${instance}` }),
  setWebhook: (instance: string, url: string): EvolutionCall => ({
    method: "POST",
    path: `/webhook/set/${instance}`,
    body: { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } },
  }),
};

/** Instância fixa por loja. Prefixo próprio para não colidir com instâncias de outros sistemas no mesmo servidor. */
export const evolutionInstanceName = (slug: string) => `cz-${slug}`;

export type EvolutionStatus = { state: "open" | "connecting" | "disconnected"; qr: string | null; pairingCode: string | null; phone: string | null };

/**
 * Normaliza as respostas da Evolution v2 (connect: { base64, code, pairingCode }; connectionState: { instance: { state } };
 * create: { qrcode: { base64 } }) num formato só, o mesmo do WhatsApp da loja.
 */
export function evolutionView(r: unknown): EvolutionStatus {
  const d = (r ?? {}) as { base64?: string; pairingCode?: string; qrcode?: { base64?: string; pairingCode?: string }; instance?: { state?: string; owner?: string; ownerJid?: string } };
  const qr = d.base64 ?? d.qrcode?.base64 ?? null;
  const pairing = d.pairingCode ?? d.qrcode?.pairingCode ?? null;
  const raw = d.instance?.state ?? (qr ? "connecting" : "close");
  const state = raw === "open" ? "open" : raw === "connecting" || qr ? "connecting" : "disconnected";
  const owner = (d.instance?.ownerJid ?? d.instance?.owner ?? "").split("@")[0].replace(/\D/g, "");
  return { state, qr: qr && qr.startsWith("data:") ? qr : qr ? `data:image/png;base64,${qr}` : null, pairingCode: pairing, phone: owner || null };
}

export async function evolutionRequest<T = unknown>(baseUrl: string, apiKey: string, call: EvolutionCall): Promise<T> {
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}${call.path}`, {
    method: call.method,
    headers: { apikey: apiKey, "content-type": "application/json" },
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  // v2 responde erro como { status, error, response: { message: string[] } }.
  const d = (await r.json().catch(() => ({}))) as { message?: unknown; response?: { message?: unknown } };
  if (!r.ok) {
    const m = d.response?.message ?? d.message;
    const text = Array.isArray(m) ? m.join(" ") : typeof m === "string" ? m : "";
    throw Object.assign(new Error(`Evolution: HTTP ${r.status}${text ? ` ${text}` : ""}`), { status: r.status });
  }
  return d as T;
}

/** Texto do webhook da Evolution (MESSAGES_UPSERT) no mesmo formato que o robô entende. */
export function evolutionIncoming(body: unknown): { from: string; message: unknown; fromMe: boolean; id: string } | null {
  const b = body as { event?: string; data?: { key?: { remoteJid?: string; fromMe?: boolean; id?: string }; message?: unknown } };
  if (!b?.data?.key?.remoteJid || !/messages[._]upsert/i.test(b.event ?? "")) return null;
  return { from: b.data.key.remoteJid, message: b.data.message, fromMe: !!b.data.key.fromMe, id: b.data.key.id ?? "" };
}
