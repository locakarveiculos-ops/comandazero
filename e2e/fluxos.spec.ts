import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const adminEnv: Record<string, string> = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => /^(E2E_ADMIN_|SUPABASE_SERVICE_ROLE_KEY=|NEXT_PUBLIC_SUPABASE_URL=)/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};

const errorsOf = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("unsplash") && !r.url().includes("viacep")) errs.push(`${r.status()} ${r.url()}`);
  });
  return errs;
};

async function addItem(page: Page, name: string) {
  await page.getByRole("button", { name }).first().click();
  await page.locator("button", { hasText: "Adicionar" }).last().click();
}

test.describe("Rotas e marca", () => {
  for (const path of ["/", "/entrar", "/loja/cafe-e-flor", "/loja/burger-station", "/painel/cafe-e-flor", "/painel/cafe-e-flor/pedidos", "/painel/cafe-e-flor/pdv", "/painel/cafe-e-flor/mesas", "/painel/cafe-e-flor/kds", "/painel/cafe-e-flor/cardapio", "/painel/cafe-e-flor/fidelidade", "/painel/cafe-e-flor/aparencia", "/painel/cafe-e-flor/integracoes", "/super-admin"]) {
    test(`GET ${path} sem erro`, async ({ page }) => {
      const errs = errorsOf(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      expect(errs).toEqual([]);
    });
  }

  test("landing ComandaZero: logo, slogan, calculadora e demos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "ComandaZero" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver loja demo: Café e Flor/ })).toHaveAttribute("href", "/loja/cafe-e-flor");
    await expect(page.getByRole("link", { name: /Burger Station/ })).toHaveAttribute("href", "/loja/burger-station");
    const before = await page.locator("#economia").getByText(/por mês ·/).textContent();
    await page.getByLabel("Vendas mensais pelo delivery").fill("90000");
    await expect(page.locator("#economia").getByText(/por mês ·/)).not.toHaveText(before!);
  });

  test("white-label: lojas sem marca ComandaZero, manifest próprio", async ({ page, request }) => {
    for (const [slug, name, color] of [["cafe-e-flor", "Café e Flor", "#2C1A12"], ["burger-station", "Burger Station", "#FF7A1A"]]) {
      await page.goto(`/loja/${slug}`);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      expect(await page.locator(".cz-saas-ui").count()).toBe(0);
      await page.waitForLoadState("networkidle");
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
      const href = await page.locator('link[rel="manifest"]').getAttribute("href");
      expect(href).toContain(`/api/manifest/${slug}`);
      const m = await (await request.get(`/api/manifest/${slug}`)).json();
      expect(m.name).toBe(name);
      expect(m.theme_color).toBe(color);
      expect(m.scope).toBe(`/loja/${slug}`);
      expect(m.icons[0].src).toContain(`/tenants/${slug}/`);
      expect(JSON.stringify(m)).not.toContain("comandazero");
    }
    const saas = await (await request.get("/api/manifest/saas")).json();
    expect(saas.name).toContain("ComandaZero");
    expect(saas.scope).toBe("/painel");
    expect(saas.icons.map((i: { purpose: string }) => i.purpose)).toEqual(["any", "any", "maskable", "maskable"]);
  });
});

test.describe("Cardápio Café e Flor", () => {
  test("produtos com foto e complementos somando", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    for (const n of ["Espresso & Misto Quente", "Cappuccino Artesanal", "Bolo de Chocolate Clássico", "Bolo de Banana Caramelizada", "Croissants Artesanais", "Sucos Naturais & Smoothies", "Cinnamon Roll Quentinho"]) {
      await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
    }
    expect(await page.locator("main img").count()).toBeGreaterThan(10);
    await page.getByRole("button", { name: "Espresso & Misto Quente" }).first().click();
    const total = page.locator("button", { hasText: "Adicionar" }).last();
    await expect(total).toContainText("22,90");
    await page.getByRole("radio", { name: /Trocar por cappuccino/ }).click();
    await page.getByRole("checkbox", { name: /Requeijão cremoso/ }).click();
    await expect(total).toContainText("29,90");
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(total).toContainText("59,80");
  });

  test("obrigatório bloqueia sem escolha", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await page.getByRole("button", { name: "Espresso & Misto Quente" }).first().click();
    await page.getByRole("radio", { name: "Derretido" }).click(); // desmarca
    await page.locator("button", { hasText: "Adicionar" }).last().click();
    await expect(page.getByRole("alert")).toContainText("Escolha ponto do queijo");
  });

  test("mesa via QR (?mesa=04) e pedir a conta", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor?mesa=04");
    await expect(page.getByText("mesa 04", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: /Mesa 04/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Pedir a conta" }).click();
    await expect(page.getByText(/Pedimos a conta/)).toBeVisible();
  });

  test("encomenda de bolo: peso, frase, data e sinal de 50%", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await page.getByRole("radio", { name: /Encomenda/ }).click();
    await page.getByRole("button", { name: "Bolos de Festa por Encomenda" }).first().click();
    const add = page.locator("button", { hasText: "Adicionar" }).last();
    await expect(add).toContainText("134,85"); // 1,5 kg × 89,90
    await page.getByRole("button", { name: "Aumentar peso" }).click();
    await expect(add).toContainText("179,80"); // 2 kg
    await page.getByLabel("Frase no topo (opcional)").fill("Feliz aniversário, Ana!");
    await expect(page.getByText(/sinal de/)).toContainText("89,90");
    await add.click();
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await expect(page.getByRole("radio", { name: /Dinheiro/ })).toBeDisabled();
    await expect(page.getByText("Sinal agora (50%)")).toBeVisible();
  });

  test("delivery com CEP (ViaCEP) preenche endereço e taxa", async ({ page }) => {
    await page.route("https://viacep.com.br/**", (r) => r.fulfill({ json: { cep: "13339-125", logradouro: "Avenida Presidente Vargas", bairro: "Centro", localidade: "Indaiatuba", uf: "SP" } }));
    await page.goto("/loja/cafe-e-flor");
    await page.getByRole("radio", { name: /Delivery/ }).click();
    await addItem(page, "Brownie da Casa");
    await addItem(page, "Cinnamon Roll Quentinho");
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await page.getByLabel("CEP").fill("13339125");
    await expect(page.getByLabel("Rua")).toHaveValue("Avenida Presidente Vargas");
    await expect(page.getByLabel("Bairro de entrega")).toHaveValue("z1");
    await expect(page.locator("dl").getByText("Entrega").locator("..")).toContainText("5,00");
  });
});

test.describe("Fluxo do pedido ponta a ponta", () => {
  test("Pix com QR e copia e cola → painel com som → KDS → status no cliente", async ({ browser }) => {
    const ctx = await browser.newContext();
    const panel = await ctx.newPage();
    await panel.goto("/painel/cafe-e-flor/pedidos");
    const store = await ctx.newPage();
    const sendCalls: string[] = [];
    await store.route("**/api/whatsapp/send", (r) => {
      sendCalls.push(r.request().postData() ?? "");
      return r.fulfill({ json: { ok: true, messageId: "TESTE" } });
    });
    await store.goto("/loja/cafe-e-flor");
    await addItem(store, "Brownie da Casa");
    await store.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await store.getByLabel("Nome").fill("Cliente E2E");
    await store.getByLabel("WhatsApp").fill("19999990000");
    await store.getByRole("button", { name: /Pagar com Pix/ }).click();

    const pix = store.getByRole("dialog", { name: "Pague com Pix" });
    await expect(pix.getByRole("img", { name: /QR Code Pix/ })).toBeVisible();
    const code = await pix.getByLabel("Pix copia e cola").inputValue();
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("540511.90");
    await expect(pix.getByText(/Expira em \d\d:\d\d/)).toBeVisible();
    await pix.getByRole("button", { name: /Simular confirmação/ }).click();
    await store.waitForURL("**/pedido/**");
    await expect(store.getByText("Status:")).toContainText("Recebido");

    await expect(panel.getByRole("main").getByText("Cliente E2E")).toBeVisible();
    await expect(panel.getByText(/Novo pedido #\d+/)).toBeVisible();
    await expect(panel.locator("li.flash-new")).toHaveCount(1);
    await expect(panel.getByRole("main").locator("li", { hasText: "Cliente E2E" })).toContainText("Pago");

    const kds = await ctx.newPage();
    await kds.goto("/painel/cafe-e-flor/kds");
    const ticket = kds.locator("li", { hasText: "Brownie da Casa" }).filter({ hasText: "Cliente E2E" });
    await expect(ticket).toBeVisible();
    await ticket.getByRole("button", { name: "Começar" }).click();
    await expect(store.getByText("Status:")).toContainText("Na cozinha");
    await kds.locator("li", { hasText: "Cliente E2E" }).getByRole("button", { name: "Pronto" }).click();
    await expect(store.getByText("Status:")).toContainText("Pronto");
    await ctx.close();
  });

  test("WhatsApp: gatilho de pedido envia card com botões pelo canal da loja", async ({ browser }) => {
    const ctx = await browser.newContext();
    const calls: { to: string; card: { text: string; buttons?: { id: string; title: string }[] } }[] = [];
    await ctx.addInitScript(() => localStorage.setItem("cp-wa-channel:cafe-e-flor", "selo-de-teste"));
    await ctx.route("**/api/whatsapp/send", async (r) => {
      calls.push(JSON.parse(r.request().postData() ?? "{}"));
      await r.fulfill({ json: { ok: true, messageId: "TESTE" } });
    });
    const panel = await ctx.newPage();
    await panel.goto("/painel/cafe-e-flor/pedidos");
    const store = await ctx.newPage();
    await store.goto("/loja/cafe-e-flor");
    await addItem(store, "Brownie da Casa");
    await store.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await store.getByLabel("Nome").fill("Zap Teste");
    await store.getByLabel("WhatsApp").fill("19988887777");
    await store.getByRole("radio", { name: /Dinheiro/ }).click();
    await store.getByRole("button", { name: /Enviar pedido/ }).click();
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    expect(calls[0].to).toBe("5519988887777");
    expect(calls[0].card.text).toContain("Zap");
    expect(calls[0].card.buttons?.map((b) => b.id)[0]).toMatch(/^ok:/);
    expect(calls[0].card.buttons!.every((b) => b.title.length <= 20)).toBe(true);
    await ctx.close();
  });
});

test.describe("Pagamento no acompanhamento (QA-01/02/07)", () => {
  test("dinheiro não pede Pix; Pix na chave mostra QR com a chave da loja", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await addItem(page, "Brownie da Casa");
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    // Vale-refeição só aparece quando a loja liga a opção.
    await expect(page.getByRole("radio", { name: /Vale-refeição/ })).toHaveCount(0);
    await page.getByLabel("Nome").fill("Cliente Dinheiro");
    await page.getByLabel("WhatsApp").fill("19999990001");
    await page.getByRole("radio", { name: /Dinheiro/ }).click();
    await page.getByLabel("Troco para quanto?").fill("50");
    await page.getByRole("button", { name: /Enviar pedido/ }).click();
    await page.waitForURL("**/pedido/**");
    await expect(page.getByTestId("pagamento-entrega")).toContainText("Dinheiro");
    await expect(page.getByTestId("pagamento-entrega")).toContainText("troco");
    await expect(page.getByText(/Aguardando confirmação do Pix/)).toHaveCount(0);

    // Chave Pix própria da loja (Pagamentos) vira QR + copia e cola no acompanhamento.
    await page.goto("/painel/cafe-e-flor/integracoes");
    await page.getByRole("tab", { name: /Pagamentos/ }).click();
    await page.getByLabel("Chave Pix").fill("loja@cafeeflor.com.br");
    await page.getByLabel("Nome de quem recebe").fill("Cafe e Flor");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.goto("/loja/cafe-e-flor");
    await addItem(page, "Brownie da Casa");
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await page.getByLabel("Nome").fill("Cliente Pix");
    await page.getByLabel("WhatsApp").fill("19999990002");
    await page.getByRole("button", { name: /Pagar com Pix/ }).click();
    const pix = page.getByRole("dialog", { name: "Pague com Pix" });
    expect(await pix.getByLabel("Pix copia e cola").inputValue()).toContain("loja@cafeeflor.com.br");
    await page.keyboard.press("Escape");
    await page.waitForURL("**/pedido/**");
    await expect(page.getByTestId("pix-pagamento").getByRole("img", { name: /QR Code Pix/ })).toBeVisible();
    expect(await page.getByLabel("Pix copia e cola").inputValue()).toContain("loja@cafeeflor.com.br");
  });

  test("painel mostra forma de pagamento e troco no pedido", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await addItem(page, "Brownie da Casa");
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await page.getByLabel("Nome").fill("Cliente Troco");
    await page.getByLabel("WhatsApp").fill("19999990003");
    await page.getByRole("radio", { name: /Dinheiro/ }).click();
    await page.getByLabel("Troco para quanto?").fill("50");
    await page.getByRole("button", { name: /Enviar pedido/ }).click();
    await page.waitForURL("**/pedido/**");
    await page.goto("/painel/cafe-e-flor/pedidos");
    const card = page.getByRole("main").locator("li", { hasText: "Cliente Troco" }).first();
    await expect(card.getByTestId("pagamento-pedido")).toContainText(/Dinheiro · troco para R\$\s50,00/);
  });
});

test.describe("Retaguarda", () => {
  test("PDV: atalho F2, código, pagamento misto, troco e cupom 58/80 mm", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/pdv");
    await page.keyboard.press("F2");
    await page.keyboard.type("103");
    await page.keyboard.press("Enter");
    await page.keyboard.press("F2");
    await page.keyboard.type("204");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Venda atual")).toContainText("18,40");
    await page.keyboard.press("F4");
    const pay = page.getByRole("dialog", { name: "Receber pagamento" });
    await pay.getByRole("textbox").fill("10,00");
    await pay.getByRole("button", { name: "Lançar parte" }).click();
    await pay.getByRole("radio", { name: "Dinheiro" }).click();
    await pay.getByRole("textbox").fill("20,00");
    await expect(pay.getByText("Troco: R$ 11,60")).toBeVisible();
    await pay.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByText(/Última venda #/)).toBeVisible();
    await page.getByRole("button", { name: "Cupom" }).click();
    const rec = page.getByRole("dialog", { name: /Cupom #/ });
    await expect(rec.locator("pre")).toContainText("CUPOM NAO FISCAL");
    await expect(rec.locator("pre")).toContainText("Troco");
    const w80 = await rec.locator("pre").evaluate((e) => e.getBoundingClientRect().width);
    await rec.getByRole("radio", { name: "58 mm" }).click();
    const w58 = await rec.locator("pre").evaluate((e) => e.getBoundingClientRect().width);
    expect(w58).toBeLessThan(w80);
  });

  test("Mesas: abrir, lançar, transferir e QR para impressão", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/mesas");
    await page.getByRole("button", { name: /^07/ }).click();
    await page.getByRole("button", { name: "Abrir mesa" }).click();
    await page.getByRole("button", { name: "Adicionar itens" }).click();
    await page.getByRole("button", { name: /Brownie da Casa/ }).click();
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByLabel("Itens da comanda")).toContainText("Brownie da Casa");
    await page.getByLabel("Transferir para").selectOption("08");
    await page.getByRole("button", { name: "Transferir" }).click();
    await page.getByRole("button", { name: /^08/ }).click();
    await expect(page.getByLabel("Itens da comanda")).toContainText("Brownie da Casa");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "QR Codes das mesas" }).click();
    await expect(page.getByRole("img", { name: "QR Code da mesa 01" })).toBeVisible();
  });

  test("Cardápio: pausar item some da loja", async ({ browser }) => {
    const ctx = await browser.newContext();
    const admin = await ctx.newPage();
    await admin.goto("/painel/cafe-e-flor/cardapio");
    await admin.getByRole("switch", { name: "Pausar Bolo de Banana Caramelizada" }).click();
    const store = await ctx.newPage();
    await store.goto("/loja/cafe-e-flor");
    await expect(store.locator("button", { hasText: "Bolo de Banana Caramelizada" }).first()).toContainText("Esgotado");
    await ctx.close();
  });

  test("Integrações: payload Whaileys/Evolution e gateways", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/integracoes");
    await page.getByLabel("Mensagem", { exact: true }).selectOption("list");
    // Payload técnico fica em "Detalhes técnicos" (fechado por padrão para o lojista).
    await page.getByText("Detalhes técnicos (para o suporte)").first().click();
    await expect(page.locator("pre").first()).toContainText('"sections"');
    await page.getByLabel("Mensagem", { exact: true }).selectOption("evo-text");
    await expect(page.getByText(/\/message\/sendText\//)).toBeVisible();
    await page.getByRole("tab", { name: /Pagamentos/ }).click();
    await page.getByTestId("pagamento-avancado").locator("> summary").click();
    await page.getByRole("button", { name: /Mercado Pago/ }).click();
    await page.getByTestId("pagamento-avancado").getByText("Detalhes técnicos (para o suporte)").last().click();
    await expect(page.getByText("https://api.mercadopago.com/v1/payments")).toBeVisible();
    await expect(page.getByText(/→ PAGO/)).toBeVisible();
    await page.getByRole("tab", { name: /E-mail/ }).click();
    await expect(page.frameLocator('iframe[title="Prévia do e-mail"]').getByText(/Recebemos seu pedido/)).toBeVisible();
  });

  test("Super Admin: dados reais e criação de loja real pelo onboarding", async ({ page, request }) => {
    // Super Admin exige admin da plataforma (credenciais de teste no .env.local).
    test.skip(!adminEnv.E2E_ADMIN_EMAIL, "admin de teste ausente");
    await page.goto("/entrar?next=%2Fsuper-admin");
    await page.getByLabel("E-mail").fill(adminEnv.E2E_ADMIN_EMAIL);
    await page.getByLabel("Senha", { exact: true }).fill(adminEnv.E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/super-admin", { timeout: 15000 });
    await expect(page.getByRole("table")).toContainText("loja-teste-p0".replace(/-/g, ""));
    await expect(page.getByRole("button", { name: /Restaurar demo/ })).toHaveCount(0);

    const slug = `padaria-e2e-${Date.now().toString().slice(-6)}`;
    await page.getByRole("link", { name: "Criar novo estabelecimento" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByLabel("Nome da loja").fill("Padaria Pão Dourado");
    await page.getByLabel("Endereço do cardápio").fill(slug);
    await page.getByLabel("WhatsApp da loja").fill("19999990000");
    await page.getByLabel("Cidade").fill("Indaiatuba");
    await page.getByRole("radio", { name: /Padaria/ }).click();
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Criar loja" }).click();
    await page.waitForURL(`**/painel/${slug}?bemvindo=1`, { timeout: 20000 });
    await page.goto(`/loja/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Padaria Pão Dourado" })).toBeVisible();
    await expect(page.getByText("Pão Francês").first()).toBeVisible();

    // Limpeza: apaga a loja de teste (cascata em cardápio, mesas, membros e assinatura).
    const headers = { apikey: adminEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${adminEnv.SUPABASE_SERVICE_ROLE_KEY}` };
    await request.delete(`${adminEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?slug=eq.${slug}`, { headers });
  });

  test("Login: validação e acessível", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Informe um e-mail válido")).toBeVisible();
    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });
});
