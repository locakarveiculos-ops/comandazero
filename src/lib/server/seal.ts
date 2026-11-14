import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Sela credenciais (AES-256-GCM) para guardar fora do servidor sem expor o conteúdo.
// Fase 1: o painel guarda o blob do canal de WhatsApp da loja; Fase 2: credenciais vão para o Supabase (service_role).

function key() {
  const raw = process.env.CHANNEL_SEAL_KEY;
  if (!raw || raw.length < 32) throw new Error("CHANNEL_SEAL_KEY ausente ou curta");
  return createHash("sha256").update(raw).digest();
}

export const sealEnabled = () => !!process.env.CHANNEL_SEAL_KEY && process.env.CHANNEL_SEAL_KEY.length >= 32;

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(blob: unknown): T | null {
  if (typeof blob !== "string" || blob.length < 40 || blob.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(blob)) return null;
  try {
    const buf = Buffer.from(blob, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
