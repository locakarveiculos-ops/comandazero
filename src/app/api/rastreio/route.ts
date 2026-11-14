import { z } from "zod";
import { HttpError, errorResponse, json, rateLimit } from "@/lib/server/http";
import { supabaseAnon } from "@/lib/supabase/server";

/** GET /api/rastreio?id=&t= — acompanhamento público por token (qualquer aparelho). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const id = q.get("id") ?? "";
    const token = q.get("t") ?? "";
    if (!z.uuid().safeParse(id).success || !/^[a-f0-9]{32,64}$/.test(token)) throw new HttpError(404, "Pedido não encontrado.");
    rateLimit(`rastreio:${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`, 120, 60_000);
    const { data, error } = await supabaseAnon().rpc("get_order_tracking", { p_order: id, p_token: token });
    if (error) throw error;
    if (!data) throw new HttpError(404, "Pedido não encontrado.");
    return json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
