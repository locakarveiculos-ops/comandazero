import { json } from "@/lib/server/http";
import { CATEGORIES, PRODUCTS, TENANTS } from "@/lib/seed";
import { openChannel } from "@/lib/integrations/whatsapp/channel";
import { parseIncoming, sender, type IncomingKey } from "@/lib/integrations/whatsapp/card";
import { respond, type BotCatalog } from "@/lib/integrations/whatsapp/bot";
import { slugFromInstance, verifySignature, whaileysSend } from "@/lib/integrations/whatsapp/whaileys";

/**
 * POST /api/webhooks/whaileys?c=<selo> — mensagens recebidas no WhatsApp de cada loja.
 *  1. corpo cru limitado; selo da URL abre { instance, token, secret }; HMAC conferido ANTES de usar o corpo → senão 401;
 *  2. instanceKey do corpo tem de ser a mesma do selo;
 *  3. id da mensagem registrado antes de processar (o motor reentrega até 3× em 5xx);
 *  4. responde 200 rápido; erro de envio não vira 5xx.
 * Fase 1: dedupe e últimas opções numeradas ficam em memória do servidor; Fase 2 usa as tabelas wa_messages/wa_sessions.
 */

type Payload = { instanceKey?: string; key?: IncomingKey; message?: unknown; pushName?: string };

const seen = new Map<string, number>();
const sessions = new Map<string, { options: string[]; at: number }>();
const TTL = 6 * 3600_000;

function remember<T>(map: Map<string, T>, k: string, v: T) {
  map.set(k, v);
  if (map.size > 5000) map.delete(map.keys().next().value as string);
}

function catalogFor(slug: string): BotCatalog | null {
  const tenant = TENANTS.find((t) => t.slug === slug);
  if (!tenant) return null;
  return {
    tenant,
    categories: CATEGORIES.filter((c) => c.tenantId === tenant.id).sort((a, b) => a.order - b.order),
    products: PRODUCTS.filter((p) => p.tenantId === tenant.id),
  };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 12_000_000) return json({ error: "payload" }, 413);
  const ch = openChannel(new URL(req.url).searchParams.get("c"));
  if (!ch) return json({ ignored: true });
  if (!verifySignature(raw, req.headers.get("x-whaileys-timestamp"), req.headers.get("x-whaileys-signature"), ch.secret))
    return json({ error: "unauthorized" }, 401);

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "payload" }, 400);
  }
  if (body.instanceKey !== ch.instance) return json({ ignored: true });
  const msgId = body.key?.id;
  if (typeof msgId !== "string" || !/^[A-Za-z0-9._-]{4,128}$/.test(msgId)) return json({ ignored: true });
  const dedupeKey = `${ch.instance}:${msgId}`;
  if (seen.has(dedupeKey)) return json({ duplicate: true });
  remember(seen, dedupeKey, Date.now());

  const who = sender(body.key!);
  if ("ignore" in who) return json({ ignored: true });
  if (!ch.bot) return json({ ok: true, bot: false });

  const slug = slugFromInstance(ch.instance);
  const cat = slug ? catalogFor(slug) : null;
  const app = process.env.APP_URL || new URL(req.url).origin;
  const sessKey = `${ch.instance}:${who.phone}`;
  const sess = sessions.get(sessKey);
  const options = sess && Date.now() - sess.at < TTL ? sess.options : [];

  const ev = parseIncoming(body.message, options);
  if (ev.kind === "ignored") return json({ ignored: true });

  const reply = cat
    ? respond(cat, ev, app)
    : { card: { text: "Olá! Recebemos sua mensagem e logo um atendente responde por aqui. 💛" }, options: [] as string[] };
  if (!reply) return json({ ignored: true });

  // Envia ANTES de gravar as opções: se o card não chegou, um "1" seguinte não pode valer para ele.
  const delivered = await whaileysSend(ch, who.replyTo, reply.card).then(
    () => true,
    (e) => {
      console.error("[whaileys] envio", (e as Error).message);
      return false;
    },
  );
  if (delivered) remember(sessions, sessKey, { options: reply.options, at: Date.now() });
  return json({ ok: true, handoff: !!reply.handoff });
}
