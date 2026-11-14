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
  createInstance: (instance: string, webhookUrl: string): EvolutionCall => ({
    method: "POST",
    path: "/instance/create",
    body: {
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: { url: webhookUrl, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
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

export async function evolutionRequest<T = unknown>(baseUrl: string, apiKey: string, call: EvolutionCall): Promise<T> {
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}${call.path}`, {
    method: call.method,
    headers: { apikey: apiKey, "content-type": "application/json" },
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const d = (await r.json().catch(() => ({}))) as { message?: unknown };
  if (!r.ok) throw new Error(`Evolution: ${typeof d.message === "string" ? d.message : `HTTP ${r.status}`}`);
  return d as T;
}

/** Texto do webhook da Evolution (MESSAGES_UPSERT) no mesmo formato que o robô entende. */
export function evolutionIncoming(body: unknown): { from: string; message: unknown; fromMe: boolean; id: string } | null {
  const b = body as { event?: string; data?: { key?: { remoteJid?: string; fromMe?: boolean; id?: string }; message?: unknown } };
  if (!b?.data?.key?.remoteJid || !/messages[._]upsert/i.test(b.event ?? "")) return null;
  return { from: b.data.key.remoteJid, message: b.data.message, fromMe: !!b.data.key.fromMe, id: b.data.key.id ?? "" };
}
