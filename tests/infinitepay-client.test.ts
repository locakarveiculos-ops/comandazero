import { afterEach, describe, expect, it, vi } from "vitest";

// Cliente da InfinitePay: /payment_check com transação desconhecida responde 404 e deve virar "não pago".
vi.mock("server-only", () => ({}));
const { checkPayment } = await import("@/lib/server/infinitepay");
const args = { orderNsu: "pedido", transactionNsu: "tx", slug: "fatura" };
const reply = (status: number, body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("checkPayment", () => {
  it("404 Not found da InfinitePay é tratado como não pago", async () => {
    reply(404, { success: false, message: "Not found" });
    expect(await checkPayment(args)).toEqual({ success: false, paid: false });
  });

  it("devolve valor, parcelas e meio quando pago", async () => {
    reply(200, { success: true, paid: true, amount: 18990, paid_amount: 20350, installments: 3, capture_method: "credit_card" });
    expect(await checkPayment(args)).toEqual({ success: true, paid: true, amount: 18990, paid_amount: 20350, installments: 3, capture_method: "credit_card" });
  });

  it("ignora tipos inesperados (valor em texto não vale)", async () => {
    reply(200, { success: true, paid: true, amount: "18990" });
    expect((await checkPayment(args)).amount).toBeUndefined();
  });

  it("erro 5xx do provedor sobe como falha (o aviso é reenviado)", async () => {
    reply(503, {});
    await expect(checkPayment(args)).rejects.toThrow(/HTTP 503/);
  });
});
