import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { evolution, evolutionInstanceName, evolutionRequest, evolutionView, type EvolutionVersion } from "@/lib/integrations/whatsapp/evolution";
import { can, getTenantAccess, getUser } from "@/lib/server/auth";

/**
 * POST /api/whatsapp/evolution — WhatsApp pelo servidor Evolution (URL e chave só no servidor).
 * Exige dono/gerente da loja real. A instância é sempre cz-<slug> (o navegador não escolhe instância:
 * com a chave do servidor, qualquer nome daria acesso a instâncias de outros sistemas).
 *   { op: "status",  slug }                 -> { state, qr, pairingCode, phone }
 *   { op: "connect", slug }                 -> cria a instância se preciso e devolve o QR
 *   { op: "logout",  slug }                 -> desconecta o número
 *   { op: "sendText",  slug, to, text }     -> envia texto (teste do painel)
 *   { op: "sendMedia", slug, to, url, caption }
 */
type Body = { op?: string; slug?: string; to?: string; text?: string; url?: string; caption?: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export async function POST(req: Request) {
  try {
    const base = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    if (!base || !key) throw new HttpError(503, "Servidor de WhatsApp não configurado.");
    const v: EvolutionVersion = process.env.EVOLUTION_API_VERSION === "v1" ? "v1" : "v2";
    const b = await readJson<Body>(req);
    const slug = String(b.slug ?? "");
    if (!SLUG_RE.test(slug)) throw new HttpError(400, "Loja inválida.");
    if (!(await getUser())) throw new HttpError(401, "Entre na sua conta.");
    const access = await getTenantAccess(slug);
    if (!access || access.isDemo) throw new HttpError(400, "Loja de demonstração não conecta WhatsApp de verdade.");
    if (!can(access.role, "integrations.edit")) throw new HttpError(403, "Sua função não permite configurar o WhatsApp.");
    const instance = evolutionInstanceName(slug);
    rateLimit(`evo:${instance}`, 30, 60_000);
    const call = <T = unknown>(c: Parameters<typeof evolutionRequest>[2]) => evolutionRequest<T>(base, key, c);

    const phone = () => {
      const d = String(b.to ?? "").replace(/\D/g, "");
      const n = /^\d{10,11}$/.test(d) ? `55${d}` : d;
      if (!/^55\d{10,11}$/.test(n)) throw new HttpError(400, "Telefone inválido.");
      return n;
    };

    switch (b.op) {
      case "status":
        return json(evolutionView(await call(evolution.state(instance)).catch(notFoundAsClosed)));
      case "connect": {
        // Instância nova: cria (já devolve o QR). Já existente: pede um QR novo.
        const exists = await call(evolution.state(instance)).then(
          () => true,
          (e) => (isNotFound(e) ? false : Promise.reject(e)),
        );
        // Sem webhook: o ComandaZero ainda não tem rota para receber mensagens da Evolution (só envia avisos).
        if (!exists) await call(evolution.createInstance(instance));
        return json(evolutionView(await call(evolution.connect(instance))));
      }
      case "logout":
        await call(evolution.logout(instance)).catch((e) => {
          if (!isNotFound(e)) throw e;
        });
        return json(evolutionView({ instance: { state: "close" } }));
      case "sendText": {
        const text = String(b.text ?? "").trim();
        if (!text || text.length > 4000) throw new HttpError(400, "Texto inválido.");
        return json(await call(evolution.sendText(instance, phone(), text, v)));
      }
      case "sendMedia": {
        if (!/^https:\/\/\S+$/.test(String(b.url ?? ""))) throw new HttpError(400, "URL da mídia deve ser https.");
        return json(await call(evolution.sendMedia(instance, phone(), { url: b.url!, caption: b.caption }, v)));
      }
      default:
        throw new HttpError(404, "Ação desconhecida.");
    }
  } catch (e) {
    return errorResponse(e);
  }
}

const isNotFound = (e: unknown) => (e as { status?: number })?.status === 404 || /does not exist/i.test((e as Error)?.message ?? "");
const notFoundAsClosed = (e: unknown) => {
  if (isNotFound(e)) return { instance: { state: "close" } };
  throw e;
};
