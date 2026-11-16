import { z } from "zod";
import { can, getTenantAccess, getUser } from "@/lib/server/auth";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { pushReady } from "@/lib/server/push";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/push   { kind: "staff", slug, subscription }              equipe logada da loja
 *                  { kind: "customer", orderId, token, subscription } cliente, com o token do pedido
 * DELETE /api/push { endpoint }                                        cancela neste aparelho
 * Endpoint de push só é aceito de serviços conhecidos (evita usar o servidor para chamar URLs arbitrárias).
 */
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com|push\.apple\.com)\//;
const Subscription = z.object({
  endpoint: z.string().url().max(800).refine((u) => PUSH_HOSTS.test(u), "serviço de push desconhecido"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("staff"), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/), subscription: Subscription }),
  z.object({ kind: z.literal("customer"), orderId: z.uuid(), token: z.string().regex(/^[a-f0-9]{32,64}$/), subscription: Subscription }),
]);

export async function POST(req: Request) {
  try {
    if (!pushReady()) throw new HttpError(503, "Notificações ainda não configuradas no servidor.");
    rateLimit(`push:${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`, 20, 60_000);
    const parsed = Body.safeParse(await readJson(req, 4_000));
    if (!parsed.success) throw new HttpError(400, "Inscrição de notificação inválida.");
    const b = parsed.data;
    const sb = supabaseService();
    const base = { endpoint: b.subscription.endpoint, p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth, user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null };

    if (b.kind === "staff") {
      const user = await getUser();
      if (!user) throw new HttpError(401, "Entre na sua conta.");
      const access = await getTenantAccess(b.slug);
      if (!access || access.isDemo) throw new HttpError(400, "Notificações só valem para loja real.");
      if (!can(access.role, "orders.view")) throw new HttpError(403, "Sua função não recebe pedidos.");
      const { error } = await sb.from("push_subscriptions").upsert({ ...base, kind: "staff", tenant_id: access.id, user_id: user.id, order_id: null }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ ok: true }, 201);
    }

    // Cliente: o token prova que a pessoa tem o link do pedido.
    const { data: o } = await sb.from("orders").select("id, tenant_id, status").eq("id", b.orderId).eq("track_token", b.token).maybeSingle();
    if (!o) throw new HttpError(404, "Pedido não encontrado.");
    if (["entregue", "cancelado"].includes(o.status)) return json({ ok: true, finished: true });
    const { error } = await sb.from("push_subscriptions").upsert({ ...base, kind: "customer", tenant_id: o.tenant_id, order_id: o.id, user_id: null }, { onConflict: "endpoint" });
    if (error) throw error;
    return json({ ok: true }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const b = z.object({ endpoint: z.string().url().max(800) }).safeParse(await readJson(req, 2_000));
    if (!b.success) throw new HttpError(400, "Inscrição inválida.");
    // Quem tem o endpoint é o próprio aparelho: basta ele para cancelar.
    await supabaseService().from("push_subscriptions").delete().eq("endpoint", b.data.endpoint);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
