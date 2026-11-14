import { z } from "zod";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { supabaseAnon } from "@/lib/supabase/server";

/**
 * POST /api/avaliacoes { id, t, stars, comment? } — cliente avalia o próprio pedido pelo link de acompanhamento.
 * O banco confere o token, exige pedido entregue e aceita uma avaliação por pedido.
 */
const Body = z.object({
  id: z.uuid(),
  t: z.string().regex(/^[a-f0-9]{32,64}$/),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
const ERR: Record<string, [number, string]> = {
  PEDIDO_INEXISTENTE: [404, "Pedido não encontrado."],
  PEDIDO_NAO_ENTREGUE: [422, "Você pode avaliar quando o pedido for entregue."],
  JA_AVALIADO: [409, "Este pedido já foi avaliado. Obrigado!"],
  NOTA_INVALIDA: [400, "Escolha de 1 a 5 estrelas."],
};

export async function POST(req: Request) {
  try {
    rateLimit(`avaliacao:${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`, 10, 60_000);
    const body = Body.safeParse(await readJson(req, 4_000));
    if (!body.success) throw new HttpError(400, "Escolha de 1 a 5 estrelas.");
    const { id, t, stars, comment } = body.data;
    const { error } = await supabaseAnon().rpc("submit_order_review", { p_order: id, p_token: t, p_stars: stars, p_comment: comment ?? null });
    if (error) {
      const known = ERR[error.message.split(":")[0]];
      if (known) throw new HttpError(known[0], known[1]);
      throw error;
    }
    return json({ ok: true }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
