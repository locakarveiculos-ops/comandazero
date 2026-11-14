import { z } from "zod";
import { createSubscription, ensureCustomer, firstPaymentUrl } from "@/lib/server/asaas";
import { getTenantAccess, getUser } from "@/lib/server/auth";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { cyclePrice, monthlyValue, planById } from "@/lib/plans";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/assinatura { slug, plan, cycle, cpfCnpj } — dono assina um plano.
 * Preço sai de src/lib/plans.ts (nunca do navegador). Cria cliente + assinatura no Asaas e devolve o link da fatura.
 * A assinatura só vira "active" quando o webhook do Asaas confirma o pagamento.
 */
const Body = z.object({
  slug: z.string().min(2).max(60),
  plan: z.enum(["starter", "pro", "enterprise"]),
  cycle: z.enum(["monthly", "yearly"]),
  cpfCnpj: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^(\d{11}|\d{14})$/, "CPF ou CNPJ inválido")),
});

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) throw new HttpError(401, "Entre na sua conta.");
    rateLimit(`assinatura:${user.id}`, 5, 60_000);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const { slug, plan, cycle, cpfCnpj } = parsed.data;
    const access = await getTenantAccess(slug);
    if (!access || access.isDemo) throw new HttpError(404, "Loja não encontrada.");
    if (access.role !== "owner") throw new HttpError(403, "Só o dono da loja pode assinar.");

    const sb = supabaseService();
    const { data: sub } = await sb.from("subscriptions").select("status, asaas_customer_id, asaas_subscription_id").eq("tenant_id", access.id).maybeSingle();
    if (sub?.status === "active") throw new HttpError(409, "Esta loja já tem assinatura ativa.");

    const info = planById(plan);
    const customer = await ensureCustomer(
      { name: access.name, email: user.email ?? "", cpfCnpj, phone: (user.user_metadata as { whatsapp?: string })?.whatsapp?.replace(/^55/, ""), externalReference: access.id },
      sub?.asaas_customer_id,
    );
    const created = await createSubscription({
      customer,
      value: cyclePrice(info, cycle),
      cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
      description: `ComandaZero ${info.name} (${cycle === "yearly" ? "anual" : "mensal"}) · ${access.name}`,
      externalReference: access.id,
    });
    await sb
      .from("subscriptions")
      .upsert({ tenant_id: access.id, plan, cycle, monthly_value: monthlyValue(info, cycle), asaas_customer_id: customer, asaas_subscription_id: created.id, updated_at: new Date().toISOString() });
    await sb.from("audit_log").insert({ actor: user.id, actor_email: user.email, action: "assinatura.criar", tenant_id: access.id, details: { slug, plan, cycle } });
    return json({ invoiceUrl: await firstPaymentUrl(created.id) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
