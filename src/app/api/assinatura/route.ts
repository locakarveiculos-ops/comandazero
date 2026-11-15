import { z } from "zod";
import { SITE_URL } from "@/config/saas-brand";
import { getTenantAccess, getUser } from "@/lib/server/auth";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { createCheckoutLink } from "@/lib/server/infinitepay";
import { cyclePrice, monthlyValue, planById } from "@/lib/plans";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/assinatura { slug, plan, cycle } — dono gera a fatura do plano e recebe o link da InfinitePay.
 * Preço sai de src/lib/plans.ts (nunca do navegador). O plano só ativa depois do /payment_check (webhook ou volta do checkout).
 * Cada ciclo é uma fatura nova: a InfinitePay não tem cobrança recorrente automática pela API.
 */
const Body = z.object({ slug: z.string().min(2).max(60), plan: z.enum(["starter", "pro", "enterprise"]), cycle: z.enum(["monthly", "yearly"]) });

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) throw new HttpError(401, "Entre na sua conta.");
    rateLimit(`assinatura:${user.id}`, 6, 60_000);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Escolha o plano e o ciclo.");
    const { slug, plan, cycle } = parsed.data;
    const access = await getTenantAccess(slug);
    if (!access || access.isDemo) throw new HttpError(404, "Loja não encontrada.");
    if (access.role !== "owner") throw new HttpError(403, "Só o dono da loja pode assinar.");

    const info = planById(plan);
    const amountCents = Math.round(cyclePrice(info, cycle) * 100);
    const sb = supabaseService();
    const { data: inv, error } = await sb
      .from("subscription_invoices")
      .insert({ tenant_id: access.id, plan, cycle, amount_cents: amountCents, monthly_value: monthlyValue(info, cycle), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, "");
    const meta = (user.user_metadata ?? {}) as { name?: string; whatsapp?: string };
    const url = await createCheckoutLink({
      orderNsu: inv.id,
      amountCents,
      description: `ComandaZero ${info.name} ${cycle === "yearly" ? "anual" : "mensal"} - ${access.name}`,
      redirectUrl: `${origin}/painel/${slug}/assinatura/retorno`,
      webhookUrl: `${origin}/api/webhooks/assinatura`,
      customer: { name: meta.name, email: user.email ?? undefined, phone: meta.whatsapp },
    });
    await sb.from("subscription_invoices").update({ link_url: url }).eq("id", inv.id);
    await sb.from("audit_log").insert({ actor: user.id, actor_email: user.email, action: "assinatura.fatura", tenant_id: access.id, details: { slug, plan, cycle, centavos: amountCents } });
    return json({ checkoutUrl: url }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
