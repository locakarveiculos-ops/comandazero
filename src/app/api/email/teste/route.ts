import { z } from "zod";
import { fromAddress, sendEmail } from "@/lib/integrations/email/resend";
import { welcomeTenantEmail } from "@/lib/integrations/email/templates";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { can, getTenantAccess, getUser } from "@/lib/server/auth";
import { getRealTenant } from "@/lib/server/tenant";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/email/teste { slug } — envia um e-mail de teste da loja (remetente fixo dela no domínio do sistema).
 * Só dono/gerente da loja real. O destino é sempre o e-mail do dono salvo em Integrações (nunca um endereço
 * vindo do navegador), para a rota não virar envio de e-mail para qualquer pessoa.
 */
const Body = z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/) });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Loja inválida.");
    const { slug } = parsed.data;
    const user = await getUser();
    if (!user) throw new HttpError(401, "Entre na sua conta.");
    const access = await getTenantAccess(slug);
    if (!access || access.isDemo) throw new HttpError(400, "Loja de demonstração não envia e-mail de verdade.");
    if (!can(access.role, "integrations.edit")) throw new HttpError(403, "Sua função não permite testar o e-mail.");
    rateLimit(`email-teste:${access.id}`, 5, 3_600_000);

    const { data } = await (await supabaseServer()).from("integration_settings").select("email").eq("tenant_id", access.id).maybeSingle();
    const cfg = (data?.email ?? {}) as { ownerEmail?: string; fromName?: string };
    const to = String(cfg.ownerEmail ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, "Salve o e-mail do dono antes de testar.");
    const tenant = await getRealTenant(slug);
    if (!tenant) throw new HttpError(404, "Loja não encontrada.");

    const origin = new URL(req.url).origin;
    const mail = welcomeTenantEmail(tenant, `${origin}/painel/${slug}`, `${origin}/loja/${slug}`, origin);
    await sendEmail({ from: fromAddress(cfg.fromName || tenant.name, tenant.subdomain), to: [to], reply_to: to, subject: `[Teste] ${mail.subject}`, html: mail.html, tags: [{ name: "tipo", value: "teste" }] });
    return json({ ok: true, to });
  } catch (e) {
    return errorResponse(e);
  }
}
