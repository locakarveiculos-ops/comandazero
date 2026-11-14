import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Card } from "./card";

/**
 * Motor Whaileys (WhatsApp com botões e listas). Credenciais só no servidor.
 *  - Cada loja tem a própria instância `cpw-<slug>`, criada com WHAILEYS_PARTNER_KEY (o motor só deixa essa chave
 *    mexer em instâncias cpw-*). Token e segredo de cada instância voltam selados (ver channel.ts).
 */

export type Channel = { instance: string; token: string };
export type SessionStatus = { state: string; qr: string | null; pairingCode?: string | null; me: { id: string | null } | null };

export class WhaileysError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const apiUrl = () => (process.env.WHAILEYS_API_URL || "").replace(/\/+$/, "");
export const partnerEnabled = () => !!(apiUrl() && process.env.WHAILEYS_PARTNER_KEY);

export const PARTNER_PREFIX = "cpw";
export const instanceFor = (slug: string) => `${PARTNER_PREFIX}-${slug}`;
export const INSTANCE_RE = /^cpw-[a-z0-9][a-z0-9-]{1,58}$/;
export const slugFromInstance = (instance: string) => (INSTANCE_RE.test(instance) ? instance.slice(PARTNER_PREFIX.length + 1) : null);

async function request<T>(path: string, key: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { "x-api-key": key, "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const d = (await r.json().catch(() => ({}))) as { error?: unknown };
  if (!r.ok)
    throw new WhaileysError(d?.error ? `WhatsApp: ${String(d.error).slice(0, 120)}` : `WhatsApp indisponível (HTTP ${r.status}).`, r.status);
  return d as T;
}

const call = <T>(ch: Channel, path: string, init: RequestInit = {}) =>
  request<T>(`/sessions/${encodeURIComponent(ch.instance)}${path}`, ch.token, init);

export const whaileysStatus = (ch: Channel) => call<SessionStatus>(ch, "");
/** Com telefone (55 + DDD + número) o motor devolve também o código de pareamento de 8 dígitos. */
export const whaileysConnect = (ch: Channel, phone?: string) =>
  call<SessionStatus>(ch, "/connect", { method: "POST", body: JSON.stringify(phone ? { phone } : {}) });
export const whaileysLogout = (ch: Channel) => call<{ ok: boolean }>(ch, "", { method: "DELETE" });
export const whaileysSend = (ch: Channel, to: string, card: Card) =>
  call<{ messageId: string }>(ch, "/send", { method: "POST", body: JSON.stringify({ to, ...card }) });
export const whaileysKnownPhones = (ch: Channel, phones: string[]) =>
  call(ch, "/known-phones", { method: "POST", body: JSON.stringify({ phones: phones.slice(0, 50) }) });

/** Cria a instância da loja. Se já existir no motor, troca token e segredo (os antigos não aparecem de novo). */
export async function ensureInstance(name: string, webhookUrl: string): Promise<{ token: string; webhookSecret: string }> {
  const key = process.env.WHAILEYS_PARTNER_KEY || "";
  try {
    return await request("/instances", key, { method: "POST", body: JSON.stringify({ name, webhookUrl }) });
  } catch (e) {
    if (!(e instanceof WhaileysError) || e.status !== 409) throw e;
    return request(`/instances/${encodeURIComponent(name)}`, key, {
      method: "PATCH",
      body: JSON.stringify({ webhookUrl, rotateToken: true, rotateSecret: true }),
    });
  }
}

export const setWebhook = (name: string, webhookUrl: string) =>
  request(`/instances/${encodeURIComponent(name)}`, process.env.WHAILEYS_PARTNER_KEY || "", {
    method: "PATCH",
    body: JSON.stringify({ webhookUrl }),
  });

/** HMAC-SHA256 de `${timestamp}.${corpo}` com o segredo da instância; janela de 5 min, comparação em tempo constante. */
export function verifySignature(raw: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!secret || !timestamp || !signature || !/^\d{13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > 300_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
