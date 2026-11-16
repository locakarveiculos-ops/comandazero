import { after } from "next/server";
import { z } from "zod";
import { HttpError, errorResponse, json, readJson } from "@/lib/server/http";
import { getUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { pushOrderStatus } from "@/lib/server/push";

/**
 * POST /api/pedidos/<id>/status { status } — avança/cancela pedido de loja real.
 * Roda como o usuário logado: a função set_order_status confere se ele é membro da loja do pedido
 * e se o papel permite cancelar. O Realtime avisa painel, KDS e cliente.
 */
const Body = z.object({ status: z.enum(["recebido", "preparo", "pronto", "saiu", "entregue", "cancelado"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Pedido inválido.");
    if (!(await getUser())) throw new HttpError(401, "Entre na sua conta.");
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Status inválido.");
    const sb = await supabaseServer();
    const { error } = await sb.rpc("set_order_status", { p_order: id, p_status: parsed.data.status });
    if (error) {
      if (/SEM_PERMISSAO/.test(error.message)) throw new HttpError(403, "Sua função não permite esta ação.");
      if (/PEDIDO_INEXISTENTE/.test(error.message)) throw new HttpError(404, "Pedido não encontrado.");
      throw error;
    }
    // Push para o cliente que pediu avisos neste pedido.
    after(() => pushOrderStatus(id, parsed.data.status));
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
