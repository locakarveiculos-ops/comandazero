import { describe, expect, it } from "vitest";
import { NICHES, buildPresetMenu, nicheFromCategory } from "@/lib/niche-presets";
import { normalizePixKey } from "@/lib/pix";
import { contrastRatio, readableInk } from "@/lib/utils";

describe("presets dos nichos", () => {
  it("6 nichos com cardápio montável e complementos coerentes", () => {
    expect(NICHES.map((n) => n.id)).toEqual(["cafeteria", "padaria", "confeitaria", "hamburgueria", "acai_sorveteria", "restaurante_balcao"]);
    for (const n of NICHES) {
      const { categories, products } = buildPresetMenu(n.id, "t1", { codeStart: 200 });
      expect(categories.length, n.id).toBe(n.categories.length);
      expect(new Set(products.map((p) => p.code)).size, n.id).toBe(products.length);
      expect(Number(products[0].code)).toBe(201);
      for (const p of products) {
        expect(categories.some((c) => c.id === p.categoryId), `${n.id}/${p.name}`).toBe(true);
        for (const g of p.optionGroups) {
          expect(g.min <= g.max && g.max <= g.choices.length, `${p.name}/${g.name}`).toBe(true);
          // O pedido de teste marca as primeiras escolhas obrigatórias: precisam existir.
          expect(g.choices.length >= g.min, `${p.name}/${g.name}`).toBe(true);
        }
      }
      // Ao menos um produto vendável no PDV / pedido de teste.
      expect(products.some((p) => !p.cake && !p.preorder), n.id).toBe(true);
    }
  });

  it("paletas com contraste AA (texto sobre a cor principal)", () => {
    for (const n of NICHES) for (const p of n.palettes) expect(contrastRatio(p.primary, readableInk(p.primary)), `${n.id}/${p.name}`).toBeGreaterThanOrEqual(4.5);
  });

  it("nicho pela categoria da loja", () => {
    expect(nicheFromCategory("Hamburgueria artesanal")).toBe("hamburgueria");
    expect(nicheFromCategory("Açaí e sorveteria")).toBe("acai_sorveteria");
    expect(nicheFromCategory("Cafeteria artesanal")).toBe("cafeteria");
    expect(nicheFromCategory("Restaurante de balcão")).toBe("restaurante_balcao");
    expect(nicheFromCategory("Pizzaria")).toBeUndefined();
  });
});

describe("chave Pix", () => {
  it("aceita os 5 tipos e recusa lixo", () => {
    expect(normalizePixKey("123.456.789-09")).toBe("12345678909");
    expect(normalizePixKey("12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizePixKey("Loja@Email.com ")).toBe("loja@email.com");
    expect(normalizePixKey("(19) 99999-0000")).toBe("+5519999990000");
    expect(normalizePixKey("+55 19 99999-0000")).toBe("+5519999990000");
    expect(normalizePixKey("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizePixKey("abc")).toBeNull();
    expect(normalizePixKey("1234")).toBeNull();
  });
});
