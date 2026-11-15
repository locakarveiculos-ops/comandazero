import { beforeEach, describe, expect, it, vi } from "vitest";

// Confirmação da fatura da assinatura: o aviso da InfinitePay não é assinado, então só o /payment_check libera o plano.
vi.mock("server-only", () => ({}));

const check = vi.fn();
vi.mock("@/lib/server/infinitepay", () => ({ checkPayment: (...a: unknown[]) => check(...a) }));

let invoice: { id: string; status: string; amount_cents: number } | null;
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invoice }) }) }) }),
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

const { settleInvoice } = await import("@/lib/server/subscription-billing");
const ID = "0f8e1b8a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const args = { invoiceId: ID, transactionNsu: "tx-1", slug: "fatura-1" };

describe("settleInvoice", () => {
  beforeEach(() => {
    invoice = { id: ID, status: "pending", amount_cents: 18990 };
    check.mockReset();
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it("libera o plano quando a InfinitePay confirma o valor da fatura", async () => {
    check.mockResolvedValue({ success: true, paid: true, amount: 18990, paid_amount: 18990, capture_method: "pix" });
    expect(await settleInvoice(args)).toEqual({ ok: true, already: false });
    expect(check).toHaveBeenCalledWith({ orderNsu: ID, transactionNsu: "tx-1", slug: "fatura-1" });
    expect(rpc).toHaveBeenCalledWith("confirm_subscription_invoice", expect.objectContaining({ p_invoice: ID, p_method: "pix", p_paid_cents: 18990 }));
  });

  it("não libera se o /payment_check disser que não foi pago (aviso forjado)", async () => {
    check.mockResolvedValue({ success: true, paid: false });
    expect((await settleInvoice(args)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não libera se o valor pago for menor que a fatura", async () => {
    check.mockResolvedValue({ success: true, paid: true, amount: 100, paid_amount: 100 });
    expect(await settleInvoice(args)).toEqual({ ok: false, reason: "valor pago menor que a fatura" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 20000, "18990"])("recusa valor ausente ou divergente: %s", async (amount) => {
    check.mockResolvedValue({ success: true, paid: true, amount });
    expect((await settleInvoice(args)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não armazena URL de comprovante não autenticada", async () => {
    check.mockResolvedValue({ success: true, paid: true, amount: 18990, paid_amount: 18990 });
    await settleInvoice({ ...args, receiptUrl: "https://example.com/forjado" });
    expect(rpc).toHaveBeenCalledWith("confirm_subscription_invoice", expect.objectContaining({ p_receipt: null }));
  });

  it("fatura já paga não consulta nem estende de novo", async () => {
    invoice = { id: ID, status: "paid", amount_cents: 18990 };
    expect(await settleInvoice(args)).toEqual({ ok: true, already: true });
    expect(check).not.toHaveBeenCalled();
  });

  it("fatura desconhecida ou dados faltando são ignorados", async () => {
    invoice = null;
    expect((await settleInvoice(args)).ok).toBe(false);
    expect((await settleInvoice({ ...args, invoiceId: "x" })).ok).toBe(false);
    expect((await settleInvoice({ ...args, slug: "" })).ok).toBe(false);
  });
});
