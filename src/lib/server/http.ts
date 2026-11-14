import "server-only";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

export function errorResponse(e: unknown) {
  const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : 500;
  // Mensagens de HttpError são escritas por nós (seguras para o usuário); erros inesperados ficam só no log.
  const ours = e instanceof HttpError || (status >= 400 && status < 500);
  const safe = ours ? (e as Error).message : "Falha inesperada. Tente de novo em instantes.";
  if (!ours) console.error("[api]", (e as Error)?.message);
  return json({ error: safe }, status >= 400 && status < 600 ? status : 500);
}

export async function readJson<T>(req: Request, max = 20_000): Promise<T> {
  const raw = await req.text();
  if (raw.length > max) throw new HttpError(413, "Requisição grande demais.");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

/** URL pública do app (o motor exige https para entregar o webhook). */
export function appUrl(req: Request) {
  const env = process.env.APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  const origin = new URL(req.url).origin;
  if (!origin.startsWith("https://")) throw new HttpError(503, "Defina APP_URL com o endereço https público do sistema.");
  return origin;
}

// Limite simples em memória por chave (por instância de servidor). Na Fase 2 vira tabela/Upstash.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, "Muitas solicitações seguidas. Aguarde um pouco.");
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
}
