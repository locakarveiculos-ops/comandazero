import { describe, expect, it } from "vitest";
import { crc16 } from "@/lib/pix";
import { paymentSummary, trackingPayment } from "@/lib/payment-info";

const base = { number: 1003, total: 46.4, deposit: undefined, changeFor: undefined, paymentStatus: "pendente" as const };
const pix = { key: "qa@email.com", name: "QA Teste", city: "Indaiatuba" };

describe("acompanhamento: pagamento (QA-01/QA-02)", () => {
  it("Pix pendente com chave da loja gera BR Code com a chave e o valor", () => {
    const r = trackingPayment({ ...base, paymentMethod: "pix" }, pix);
    expect(r.kind).toBe("pix");
    if (r.kind !== "pix") return;
    expect(r.payload.startsWith("000201")).toBe(true);
    expect(r.payload).toContain("qa@email.com");
    expect(r.payload).toContain("540546.40");
    expect(r.payload.slice(-4)).toBe(crc16(r.payload.slice(0, -4)));
  });

  it("encomenda cobra só o sinal no Pix", () => {
    const r = trackingPayment({ ...base, total: 100, deposit: 50, paymentMethod: "pix" }, pix);
    expect(r.kind === "pix" && r.amount).toBe(50);
  });

  it("Pix sem chave cadastrada não inventa QR", () => expect(trackingPayment({ ...base, paymentMethod: "pix" }, null).kind).toBe("pix_sem_chave"));

  it("dinheiro e cartão nunca mostram 'aguardando Pix'", () => {
    expect(trackingPayment({ ...base, paymentMethod: "dinheiro", changeFor: 50 }, pix)).toEqual({ kind: "na_entrega", label: "Dinheiro", change: 3.6 });
    expect(trackingPayment({ ...base, paymentMethod: "cartao_credito" }, pix)).toEqual({ kind: "na_entrega", label: "Cartão de crédito", change: 0 });
  });

  it("pedido pago não pede pagamento", () => expect(trackingPayment({ ...base, paymentStatus: "pago", paymentMethod: "pix" }, pix).kind).toBe("pago"));
});

describe("painel: forma de pagamento e troco (QA-03)", () => {
  // Intl separa "R$" do valor com espaço não separável; normaliza para comparar.
  it("dinheiro com troco mostra quanto levar", () => expect(paymentSummary({ paymentMethod: "dinheiro", changeFor: 50, total: 38.4 }).replace(/\s/g, " ")).toBe("Dinheiro · troco para R$ 50,00 (levar R$ 11,60)"));
  it("sem troco só a forma", () => {
    expect(paymentSummary({ paymentMethod: "dinheiro", total: 38.4 })).toBe("Dinheiro");
    expect(paymentSummary({ paymentMethod: "cartao_debito", total: 10 })).toBe("Cartão de débito");
  });
});
