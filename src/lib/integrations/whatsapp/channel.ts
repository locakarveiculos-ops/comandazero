import "server-only";
import { seal, sealEnabled, unseal } from "@/lib/server/seal";
import { WhaileysError, instanceFor, partnerEnabled, setWebhook, type Channel } from "./whaileys";

/**
 * Credenciais do canal de cada loja (Fase 1, sem banco):
 *  - "selo" = { instance, token, secret, bot } cifrado com CHANNEL_SEAL_KEY (AES-256-GCM). Só o servidor abre.
 *  - O painel da loja guarda o selo e o envia nas chamadas; o motor recebe o selo na URL do webhook (?c=),
 *    assim o webhook confere a assinatura daquela loja sem precisar de banco.
 * Fase 2: a tabela whatsapp_channels (supabase/schema.sql) substitui o selo; as rotas mantêm o mesmo contrato.
 */

export type SealedChannel = { v: 1; instance: string; token: string; secret: string; bot: boolean };
export type OpenChannel = Channel & { secret: string; bot: boolean };

export const channelsReady = () => partnerEnabled() && sealEnabled();

export function openChannel(blob: unknown, slug?: string): OpenChannel | null {
  const c = unseal<SealedChannel>(blob);
  if (!c || c.v !== 1 || !c.instance || !c.token || !c.secret) return null;
  if (slug && c.instance !== instanceFor(slug)) return null;
  return { instance: c.instance, token: c.token, secret: c.secret, bot: c.bot !== false };
}

export const webhookBase = (appUrl: string) => `${appUrl.replace(/\/+$/, "")}/api/webhooks/whaileys`;

/** Regrava o selo (ex.: liga/desliga o robô) e atualiza a URL do webhook no motor. */
export async function resealChannel(ch: OpenChannel, appUrl: string) {
  const blob = seal({ v: 1, instance: ch.instance, token: ch.token, secret: ch.secret, bot: ch.bot } satisfies SealedChannel);
  await setWebhook(ch.instance, `${webhookBase(appUrl)}?c=${blob}`);
  return blob;
}

/**
 * Cria a instância da loja no motor. Se ela já existir, NÃO troca as credenciais (isso tiraria o WhatsApp de quem
 * conectou): só o aparelho que tem o selo continua operando. Recuperação fica com o suporte (wh.sh rotate).
 */
export async function provisionChannel(slug: string, appUrl: string): Promise<{ blob: string; channel: OpenChannel }> {
  const instance = instanceFor(slug);
  const key = process.env.WHAILEYS_PARTNER_KEY || "";
  const r = await fetch(`${(process.env.WHAILEYS_API_URL || "").replace(/\/+$/, "")}/instances`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ name: instance, webhookUrl: webhookBase(appUrl) }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const d = (await r.json().catch(() => ({}))) as { token?: string; webhookSecret?: string; error?: string };
  if (r.status === 409)
    throw new WhaileysError("Esta loja já tem um WhatsApp configurado em outro aparelho. Use o painel nele ou fale com o suporte.", 409);
  if (!r.ok || !d.token || !d.webhookSecret) throw new WhaileysError(d.error ? `WhatsApp: ${d.error}` : `WhatsApp indisponível (HTTP ${r.status}).`, r.status || 502);
  const channel: OpenChannel = { instance, token: d.token, secret: d.webhookSecret, bot: true };
  return { blob: await resealChannel(channel, appUrl), channel };
}
