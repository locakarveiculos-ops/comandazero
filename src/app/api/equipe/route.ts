import { z } from "zod";
import { getTenantAccess, getUser } from "@/lib/server/auth";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Equipe da loja (só o dono).
 *  POST   { slug, email, role }  convida por e-mail (conta nova recebe o convite; conta existente entra direto)
 *  PATCH  { slug, userId, role } troca o papel
 *  DELETE { slug, userId }       remove o acesso
 * O dono não muda o próprio papel nem se remove (evita loja sem dono).
 */
const ROLES = ["manager", "cashier", "waiter", "kitchen"] as const;
const Invite = z.object({ slug: z.string(), email: z.email().transform((v) => v.trim().toLowerCase()), role: z.enum(ROLES) });
const Change = z.object({ slug: z.string(), userId: z.uuid(), role: z.enum(ROLES) });
const Remove = z.object({ slug: z.string(), userId: z.uuid() });

async function ownerOf(slug: string) {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Entre na sua conta.");
  const access = await getTenantAccess(slug);
  if (!access || access.isDemo) throw new HttpError(404, "Loja não encontrada.");
  if (access.role !== "owner") throw new HttpError(403, "Só o dono gerencia a equipe.");
  return { user, access };
}

const audit = (actor: { id: string; email?: string }, action: string, tenantId: string, details: object) =>
  supabaseService().from("audit_log").insert({ actor: actor.id, actor_email: actor.email, action, tenant_id: tenantId, details });

export async function POST(req: Request) {
  try {
    const body = Invite.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "Informe um e-mail válido e o papel.");
    const { user, access } = await ownerOf(body.data.slug);
    rateLimit(`equipe:${user.id}`, 20, 3_600_000);
    const sb = supabaseService();
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");

    // Conta já existe? Liga direto. Senão, convite por e-mail (define a senha em /redefinir-senha).
    const { data: found } = await sb.rpc("user_id_by_email", { p_email: body.data.email });
    let userId = found as string | null;
    let invited = false;
    if (!userId) {
      const { data, error } = await sb.auth.admin.inviteUserByEmail(body.data.email, { redirectTo: `${origin}/auth/callback?next=/redefinir-senha` });
      if (error) throw new HttpError(422, /rate limit/i.test(error.message) ? "Limite de e-mails atingido. Tente em alguns minutos." : "Não foi possível enviar o convite.");
      userId = data.user.id;
      invited = true;
    }
    if (userId === user.id) throw new HttpError(422, "Você já é o dono desta loja.");
    const { error } = await sb.from("tenant_members").upsert({ tenant_id: access.id, user_id: userId, role: body.data.role }, { onConflict: "tenant_id,user_id" });
    if (error) throw error;
    await audit(user, "equipe.convidar", access.id, { slug: access.slug, email: body.data.email, role: body.data.role, convite: invited });
    return json({ ok: true, invited }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = Change.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "Dados inválidos.");
    const { user, access } = await ownerOf(body.data.slug);
    if (body.data.userId === user.id) throw new HttpError(422, "O dono não pode mudar o próprio papel.");
    const { error, count } = await supabaseService().from("tenant_members").update({ role: body.data.role }, { count: "exact" }).match({ tenant_id: access.id, user_id: body.data.userId }).neq("role", "owner");
    if (error) throw error;
    if (!count) throw new HttpError(404, "Pessoa não encontrada na equipe.");
    await audit(user, "equipe.papel", access.id, { slug: access.slug, userId: body.data.userId, role: body.data.role });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const body = Remove.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, "Dados inválidos.");
    const { user, access } = await ownerOf(body.data.slug);
    if (body.data.userId === user.id) throw new HttpError(422, "O dono não pode se remover.");
    const { error, count } = await supabaseService().from("tenant_members").delete({ count: "exact" }).match({ tenant_id: access.id, user_id: body.data.userId }).neq("role", "owner");
    if (error) throw error;
    if (!count) throw new HttpError(404, "Pessoa não encontrada na equipe.");
    await audit(user, "equipe.remover", access.id, { slug: access.slug, userId: body.data.userId });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
