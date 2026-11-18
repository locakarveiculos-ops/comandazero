import { describe, expect, it } from "vitest";
import { fromAddress, tenantEmailLocal } from "@/lib/integrations/email/resend";

describe("remetente fixo por loja", () => {
  it("cada loja tem endereço próprio no domínio verificado", () => {
    expect(fromAddress("Café e Flor", "cafeeflor", "comandazero.com.br")).toBe("Café e Flor <cafeeflor@comandazero.com.br>");
    expect(fromAddress("Burger", "burger-station", "comandazero.com.br")).toBe("Burger <burgerstation@comandazero.com.br>");
  });
  it("nome com < > ou quebra de linha não injeta cabeçalho", () => {
    expect(fromAddress('Loja <x@y.com>\r\nBcc: z@w.com', "loja", "d.com")).toBe("Loja x@y.comBcc: z@w.com <loja@d.com>");
  });
  it("subdomínio vazio ou estranho não gera endereço inválido", () => {
    expect(tenantEmailLocal("")).toBe("pedidos");
    expect(tenantEmailLocal("Loja.Teste_01!")).toBe("lojateste01");
  });
});
