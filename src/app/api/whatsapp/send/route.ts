import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { channelsReady, openChannel } from "@/lib/integrations/whatsapp/channel";
import type { Card } from "@/lib/integrations/whatsapp/card";
import { whaileysSend } from "@/lib/integrations/whatsapp/whaileys";

/**
 * POST /api/whatsapp/send { slug, blob, to, card } — envio pelo número da loja (gatilhos de pedido e testador).
 * Só quem tem o selo da loja envia; limites do motor: 3 botões (20), lista até 10 linhas (24), texto até 4000.
 */

type Body = { slug?: string; blob?: string; to?: string; card?: Card };

function validCard(c: unknown): Card {
  const card = c as Card;
  if (!card || typeof card.text !== "string" || !card.text.trim() || card.text.length > 4000) throw new HttpError(400, "Texto da mensagem inválido.");
  if (card.buttons && (!Array.isArray(card.buttons) || card.buttons.length > 3 || card.buttons.some((b) => !b?.id || !b?.title || b.title.length > 20)))
    throw new HttpError(400, "Botões: até 3, título com até 20 caracteres.");
  if (card.sections) {
    const rows = Array.isArray(card.sections) ? card.sections.flatMap((s) => (Array.isArray(s?.rows) ? s.rows : [null])) : [null];
    if (!rows.length || rows.length > 10 || rows.some((r) => !r?.id || !r?.title || r.title.length > 24))
      throw new HttpError(400, "Lista: até 10 linhas, título com até 24 caracteres.");
  }
  return {
    text: card.text,
    ...(card.buttons ? { buttons: card.buttons.map((b) => ({ id: String(b.id), title: String(b.title) })) } : {}),
    ...(card.sections ? { sections: card.sections, buttonText: String(card.buttonText || "Ver opções").slice(0, 20) } : {}),
  };
}

export async function POST(req: Request) {
  try {
    if (!channelsReady()) throw new HttpError(503, "WhatsApp ainda não configurado no servidor.");
    const body = await readJson<Body>(req);
    const ch = openChannel(body.blob, String(body.slug ?? ""));
    if (!ch) throw new HttpError(401, "Credencial do WhatsApp inválida. Conecte o número em Integrações.");
    const d = String(body.to ?? "").replace(/\D/g, "");
    const to = /^\d{10,11}$/.test(d) ? `55${d}` : d;
    if (!/^55\d{10,11}$/.test(to)) throw new HttpError(400, "Telefone do cliente inválido.");
    rateLimit(`send:${ch.instance}`, 60, 60_000);
    const r = await whaileysSend(ch, to, validCard(body.card));
    return json({ ok: true, messageId: r.messageId });
  } catch (e) {
    return errorResponse(e);
  }
}
