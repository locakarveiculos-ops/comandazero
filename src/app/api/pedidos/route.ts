import { z } from "zod";
import { HttpError, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/pedidos — cria o pedido de uma loja real.
 * O navegador envia só ids, quantidades e escolhas; preço, adicionais, taxa, cupom, número e token
 * são definidos no banco (função create_order). Reenvio com a mesma chave devolve o mesmo pedido.
 */

const uuid = z.uuid();
const Body = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  mode: z.enum(["delivery", "retirada", "mesa", "encomenda"]),
  items: z
    .array(
      z.object({
        product_id: uuid,
        qty: z.number().int().min(1).max(99),
        choice_ids: z.array(uuid).max(20).default([]),
        notes: z.string().max(200).default(""),
        cake: z
          .object({
            kg: z.number().positive().max(50),
            massa: z.string().max(60),
            recheio: z.string().max(60),
            cobertura: z.string().max(60),
            frase: z.string().max(40),
            pickupAt: z.iso.datetime({ offset: true }),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(50),
  customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\D*(\d\D*){10,13}$/) }),
  payment: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro", "vale_refeicao"]),
  zoneId: uuid.optional(),
  address: z.object({ cep: z.string().max(9), street: z.string().max(120), number: z.string().max(20), district: z.string().max(80), city: z.string().max(80), complement: z.string().max(120).optional() }).optional(),
  table: z.string().regex(/^\d{1,3}$/).optional(),
  coupon: z.string().regex(/^[A-Z0-9]{3,15}$/i).optional(),
  changeFor: z.number().positive().max(10000).optional(),
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

// Mensagens do banco (create_order) traduzidas para o cliente.
const DB_ERRORS: Record<string, string> = {
  LOJA_INEXISTENTE: "Loja não encontrada.",
  MODO_INDISPONIVEL: "Esta loja não atende neste modo.",
  CARRINHO_INVALIDO: "Carrinho vazio ou grande demais.",
  PRODUTO_INEXISTENTE: "Um produto do carrinho não existe mais. Atualize o cardápio.",
  PRODUTO_ESGOTADO: "Um produto acabou de esgotar",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  OPCAO_INVALIDA: "Uma opção escolhida não vale para o produto.",
  OPCAO_FORA_DO_LIMITE: "Escolha as opções obrigatórias",
  PESO_INVALIDO: "Peso do bolo fora do permitido.",
  ANTECEDENCIA_INSUFICIENTE: "A data de retirada não respeita a antecedência mínima.",
  BAIRRO_INVALIDO: "Escolha o bairro de entrega.",
  PEDIDO_MINIMO: "Pedido abaixo do mínimo para entrega.",
  ENCOMENDA_EXIGE_PIX: "Encomendas exigem sinal via Pix.",
  TROCO_INVALIDO: "O valor do troco é menor que o total.",
};

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    rateLimit(`pedido:${ip}`, 20, 60_000);
    const parsed = Body.safeParse(await readJson(req, 50_000));
    if (!parsed.success) throw new HttpError(400, `Dados do pedido inválidos: ${parsed.error.issues[0]?.path.join(".")}`);
    const b = parsed.data;
    const sb = supabaseService();
    const { data, error } = await sb.rpc("create_order", {
      p_slug: b.slug,
      p_mode: b.mode,
      p_items: b.items,
      p_customer: b.customer,
      p_payment: b.payment,
      p_zone_id: b.zoneId ?? null,
      p_address: b.address ?? null,
      p_table: b.table ? b.table.padStart(2, "0") : null,
      p_coupon: b.coupon ?? null,
      p_change_for: b.changeFor ?? null,
      p_scheduled_for: b.scheduledFor ?? null,
      p_idempotency_key: b.idempotencyKey,
    });
    if (error) {
      const code = error.message.split(":")[0];
      const detail = error.message.split(":")[1];
      if (DB_ERRORS[code]) throw new HttpError(422, detail ? `${DB_ERRORS[code]}: ${detail}` : DB_ERRORS[code]);
      throw error;
    }
    const row = (data as { order_id: string; number: number; track_token: string; total: number; deposit: number | null }[])[0];
    return json({ id: row.order_id, number: row.number, trackToken: row.track_token, total: Number(row.total), deposit: row.deposit == null ? null : Number(row.deposit) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
