import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16 } from "@/lib/pix";
import { couponDiscount, couponError, earliestPickup, splitEvenly, unitPrice, validateSelections } from "@/lib/pricing";
import { GATEWAYS } from "@/lib/integrations/payments/factory";
import { PRODUCTS } from "@/lib/seed";
import { contrastRatio, isOpenNow, isValidBrPhone, toWhatsappNumber, waitLevel } from "@/lib/utils";
import { tenantFromHost } from "@/proxy";
import type { Coupon } from "@/lib/types";

describe("Pix BR Code", () => {
  it("CRC16-CCITT confere com o vetor de referência", () => expect(crc16("123456789")).toBe("29B1"));
  it("payload válido com valor e CRC no fim", () => {
    const p = buildPixPayload({ key: "loja@pix.com.br", name: "Café e Flor", city: "Indaiatuba", amount: 22.9, txid: "o-123" });
    expect(p.startsWith("000201")).toBe(true);
    expect(p).toContain("540522.90");
    expect(p).toContain("5911CAFE E FLOR");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});

describe("preços e opções", () => {
  const combo = PRODUCTS.find((p) => p.id === "p_espresso_misto")!;
  const bolo = PRODUCTS.find((p) => p.id === "p_bolo_festa")!;

  it("obrigatório sem escolha gera erro", () => {
    expect(validateSelections(combo, {})).toHaveLength(2);
    expect(validateSelections(combo, { g_ponto: ["derretido"], g_cafe: ["curto"] })).toHaveLength(0);
  });
  it("adicionais somam ao preço", () => expect(unitPrice(combo, { g_ponto: ["derretido"], g_cafe: ["cappu"], g_add: ["requeijao"] })).toBe(29.9));
  it("bolo por kg", () => expect(unitPrice(bolo, {}, { kg: 2.5 })).toBe(224.75));
  it("retirada respeita antecedência", () => {
    const now = new Date("2026-11-14T10:10:00");
    expect(earliestPickup(48, now).getTime()).toBeGreaterThanOrEqual(now.getTime() + 48 * 3600000);
  });
  it("divisão de conta não perde centavos", () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });
  it("cupons", () => {
    const c: Coupon = { id: "1", tenantId: "t", code: "PAUSA10", type: "percent", value: 10, minOrder: 30, active: true, uses: 0 };
    expect(couponError(c, 20)).toMatch(/a partir/);
    expect(couponDiscount(c, 50, 5)).toBe(5);
    expect(couponDiscount({ ...c, type: "frete" }, 50, 7)).toBe(7);
  });
});

describe("utilitários", () => {
  it("telefone vira 55+DDD", () => {
    expect(toWhatsappNumber("(19) 99586-8521")).toBe("5519995868521");
    expect(isValidBrPhone("19 99586-8521")).toBe(true);
    expect(isValidBrPhone("1234")).toBe(false);
  });
  it("cronômetro do KDS", () => {
    expect(waitLevel(5)).toBe("ok");
    expect(waitLevel(15)).toBe("warn");
    expect(waitLevel(25)).toBe("late");
  });
  it("horário de funcionamento em Brasília (inclusive virada da meia-noite)", () => {
    const hours = [{ day: 5, open: "18:00", close: "02:00" }];
    expect(isOpenNow(hours, new Date("2026-11-13T23:30:00-03:00"))).toBe(true); // sexta 23h30
    expect(isOpenNow(hours, new Date("2026-11-14T01:30:00-03:00"))).toBe(true); // sábado 01h30
    expect(isOpenNow(hours, new Date("2026-11-14T03:00:00-03:00"))).toBe(false);
  });
  it("cores do Café e Flor passam AA", () => expect(contrastRatio("#2C1A12", "#FAF6F0")).toBeGreaterThan(4.5));
});

describe("subdomínio → loja", () => {
  it("resolve subdomínio e ignora reservados", () => {
    expect(tenantFromHost("cafeeflor.seudominio.com.br", "seudominio.com.br")).toBe("cafeeflor");
    expect(tenantFromHost("app.seudominio.com.br", "seudominio.com.br")).toBeNull();
    expect(tenantFromHost("seudominio.com.br", "seudominio.com.br")).toBeNull();
    expect(tenantFromHost("localhost:3000", "seudominio.com.br")).toBeNull();
  });
});

describe("gateways", () => {
  it("todo gateway monta cobrança e entende o próprio webhook", () => {
    for (const g of Object.values(GATEWAYS)) {
      const req = g.buildCharge({ orderId: "o1", amount: 10, description: "x", method: "pix", customer: { name: "A", phone: "5519999990000" }, webhookUrl: "https://x/api/webhooks/pagamentos/a" }, "");
      expect(req.url).toBeTruthy();
      const ev = g.parseWebhook(g.sampleWebhook("o1", 10));
      expect(ev?.chargeId).toContain("o1");
      expect(ev?.status).toBe("paid");
    }
  });
});
