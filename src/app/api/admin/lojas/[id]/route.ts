import { z } from "zod";
import { HttpError, errorResponse, json, readJson } from "@/lib/server/http";
import { getUser, isPlatformAdmin } from "@/lib/server/auth";
import { supabaseService } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/lojas/<id> { active?, plan? } — Super Admin suspende/reativa loja ou troca o plano.
 * Só admin da plataforma; cada mudança vai para audit_log com quem fez e o antes/depois.
 */
const Body = z.object({ active: z.boolean().optional(), plan: z.enum(["starter", "pro", "enterprise"]).optional() }).refine((b) => b.active !== undefined || b.plan !== undefined);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Loja inválida.");
    const user = await getUser();
    if (!user) throw new HttpError(401, "Entre na sua conta.");
    if (!(await isPlatformAdmin())) throw new HttpError(403, "Somente administradores da plataforma.");
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Nada para alterar.");

    const sb = supabaseService();
    const { data: before } = await sb.from("tenants").select("id, slug, active, plan, is_demo").eq("id", id).maybeSingle();
    if (!before) throw new HttpError(404, "Loja não encontrada.");
    if (before.is_demo && parsed.data.active === false) throw new HttpError(422, "Lojas de demonstração não podem ser suspensas.");

    const { error } = await sb.from("tenants").update(parsed.data).eq("id", id);
    if (error) throw error;
    if (parsed.data.plan) await sb.from("subscriptions").update({ plan: parsed.data.plan, updated_at: new Date().toISOString() }).eq("tenant_id", id);
    await sb.from("audit_log").insert({
      actor: user.id,
      actor_email: user.email,
      action: parsed.data.active === undefined ? "loja.plano" : parsed.data.active ? "loja.reativar" : "loja.suspender",
      tenant_id: id,
      details: { slug: before.slug, antes: { active: before.active, plan: before.plan }, depois: parsed.data },
    });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
