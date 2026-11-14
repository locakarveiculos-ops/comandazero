import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { evolution, evolutionRequest, type EvolutionVersion } from "@/lib/integrations/whatsapp/evolution";

/**
 * POST /api/whatsapp/evolution — provedor 2 (Evolution API), com URL e chave só no servidor.
 *   { op: "status", instance }                    -> estado da conexão
 *   { op: "connect", instance }                   -> QR de conexão (base64)
 *   { op: "sendText", instance, to, text }        -> envia texto
 *   { op: "sendMedia", instance, to, url, caption }
 * Sem EVOLUTION_API_URL/KEY configuradas responde 503 (o painel mostra só o payload).
 */
type Body = { op?: string; instance?: string; to?: string; text?: string; url?: string; caption?: string };

const INSTANCE = /^[A-Za-z0-9_-]{2,60}$/;

export async function POST(req: Request) {
  try {
    const base = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    if (!base || !key) throw new HttpError(503, "Evolution API não configurada no servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY).");
    const v: EvolutionVersion = process.env.EVOLUTION_API_VERSION === "v1" ? "v1" : "v2";
    const b = await readJson<Body>(req);
    const instance = String(b.instance ?? "");
    if (!INSTANCE.test(instance)) throw new HttpError(400, "Instância inválida.");
    rateLimit(`evo:${instance}`, 30, 60_000);

    const phone = () => {
      const d = String(b.to ?? "").replace(/\D/g, "");
      const n = /^\d{10,11}$/.test(d) ? `55${d}` : d;
      if (!/^55\d{10,11}$/.test(n)) throw new HttpError(400, "Telefone inválido.");
      return n;
    };

    switch (b.op) {
      case "status":
        return json(await evolutionRequest(base, key, evolution.state(instance)));
      case "connect":
        return json(await evolutionRequest(base, key, evolution.connect(instance)));
      case "sendText": {
        const text = String(b.text ?? "").trim();
        if (!text || text.length > 4000) throw new HttpError(400, "Texto inválido.");
        return json(await evolutionRequest(base, key, evolution.sendText(instance, phone(), text, v)));
      }
      case "sendMedia": {
        if (!/^https:\/\/\S+$/.test(String(b.url ?? ""))) throw new HttpError(400, "URL da mídia deve ser https.");
        return json(await evolutionRequest(base, key, evolution.sendMedia(instance, phone(), { url: b.url!, caption: b.caption }, v)));
      }
      default:
        throw new HttpError(404, "Ação desconhecida.");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
