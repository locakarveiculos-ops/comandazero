import { timingSafeEqual } from "node:crypto";
import { HttpError, appUrl, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { channelsReady, openChannel, provisionChannel, resealChannel, type OpenChannel } from "@/lib/integrations/whatsapp/channel";
import { jidUser } from "@/lib/integrations/whatsapp/card";
import { WhaileysError, whaileysConnect, whaileysLogout, whaileysStatus, type SessionStatus } from "@/lib/integrations/whatsapp/whaileys";

/**
 * POST /api/whatsapp/channel — WhatsApp de cada loja (motor Whaileys), operado pelo painel do lojista.
 *   { op: "status",  slug, blob }                     -> { state, qr, pairingCode, phone }
 *   { op: "connect", slug, blob?, phone?, activation? } -> cria a instância cpw-<slug> se preciso (exige código de
 *                                                         ativação) e devolve QR ou código de pareamento + selo novo
 *   { op: "logout",  slug, blob }                     -> desconecta o número
 *   { op: "bot",     slug, blob, enabled }            -> liga/desliga o robô de atendimento (devolve selo novo)
 */

type Body = { op?: string; slug?: string; blob?: string; phone?: string; activation?: string; enabled?: boolean };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const off = { state: "disconnected", qr: null, pairingCode: null, phone: null };
const view = (s: SessionStatus) => ({ state: s.state, qr: s.qr || null, pairingCode: s.pairingCode || null, phone: jidUser(s.me?.id) || null });
const missing = (e: unknown) => e instanceof WhaileysError && e.status === 404;

function activationOk(code: unknown) {
  const expected = process.env.WA_PROVISION_KEY || "";
  if (!expected || typeof code !== "string") return false;
  const a = Buffer.from(code.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizePhone(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const d = String(raw).replace(/\D/g, "");
  const phone = /^\d{10,11}$/.test(d) ? `55${d}` : d;
  if (!/^55\d{10,11}$/.test(phone)) throw new HttpError(400, "Informe o WhatsApp com DDD (ex.: 19 99999-0000).");
  return phone;
}

export async function POST(req: Request) {
  try {
    const body = await readJson<Body>(req);
    const slug = String(body.slug ?? "");
    if (!SLUG_RE.test(slug)) throw new HttpError(400, "Loja inválida.");
    if (!channelsReady()) throw new HttpError(503, "WhatsApp ainda não configurado no servidor (WHAILEYS_PARTNER_KEY / CHANNEL_SEAL_KEY).");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    rateLimit(`ch:${ip}`, 40, 60_000);

    const ch: OpenChannel | null = body.blob ? openChannel(body.blob, slug) : null;
    if (body.blob && !ch) throw new HttpError(401, "Credencial do WhatsApp inválida para esta loja. Conecte de novo.");

    switch (body.op) {
      case "status": {
        if (!ch) return json(off);
        const s = await whaileysStatus(ch).catch((e) => {
          if (missing(e)) return null;
          throw e;
        });
        return json(s ? { ...view(s), bot: ch.bot } : off);
      }
      case "logout": {
        if (!ch) return json(off);
        await whaileysLogout(ch).catch((e) => {
          if (!missing(e)) throw e;
        });
        return json(off);
      }
      case "bot": {
        if (!ch) throw new HttpError(400, "Conecte o WhatsApp primeiro.");
        const blob = await resealChannel({ ...ch, bot: !!body.enabled }, appUrl(req));
        return json({ ok: true, bot: !!body.enabled, blob });
      }
      case "connect": {
        const phone = normalizePhone(body.phone);
        let channel = ch;
        let blob = body.blob;
        if (!channel) {
          if (!activationOk(body.activation)) throw new HttpError(403, "Código de ativação inválido. Peça ao suporte da plataforma.");
          rateLimit(`prov:${ip}`, 5, 3_600_000);
          const created = await provisionChannel(slug, appUrl(req));
          channel = created.channel;
          blob = created.blob;
        }
        const s = await whaileysConnect(channel, phone);
        return json({ ...view(s), bot: channel.bot, blob });
      }
      default:
        throw new HttpError(404, "Ação desconhecida.");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
