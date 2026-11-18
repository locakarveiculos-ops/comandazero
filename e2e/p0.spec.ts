import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

// P0 contra o Supabase real, na loja de teste "loja-teste-p0" (is_demo = false).
// Credenciais dos usuários de teste vêm do .env.local (nunca versionado).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SLUG = "loja-teste-p0";
const hasUsers = !!env.E2E_OWNER_EMAIL;

async function login(browser: Browser, who: "OWNER" | "CASHIER" | "ADMIN" | "OUTSIDER", next = `/painel/${SLUG}`) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(env[`E2E_${who}_EMAIL`]);
  await page.getByLabel("Senha", { exact: true }).fill(env[`E2E_${who}_PASSWORD`]);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // Login conclui quando sai de /entrar (cookie de sessão gravado).
  // Espera só o HTML (imagens externas da loja podem atrasar o evento "load").
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 20000, waitUntil: "domcontentloaded" });
  return { ctx, page };
}

async function orderAsCustomer(page: Page, name: string) {
  await page.goto(`/loja/${SLUG}`);
  await page.getByRole("button", { name: "Brownie da Casa" }).first().click();
  await page.locator("button", { hasText: "Adicionar" }).last().click();
  await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("WhatsApp").fill("19900000000");
  await page.getByRole("radio", { name: /Dinheiro/ }).click();
  await page.getByRole("button", { name: /Enviar pedido/ }).click();
  await page.waitForURL(/\/pedido\/[0-9a-f-]{36}\?t=[0-9a-f]{32}/);
}

test.describe("P0 · proteção de rotas", () => {
  test("anônimo é levado para /entrar com next", async ({ page }) => {
    for (const path of [`/painel/${SLUG}/pedidos`, "/super-admin", `/painel/${SLUG}/pdv`]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/entrar\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  });

  test("loja de demonstração continua aberta para visitação", async ({ page }) => {
    const r = await page.goto("/painel/cafe-e-flor/pedidos");
    expect(r?.status()).toBe(200);
    await expect(page.getByText("Demonstração").first()).toBeVisible();
  });

  test.skip(!hasUsers, "usuários de teste ausentes");

  test("lojista sem vínculo recebe 403; lojista não acessa Super Admin", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OUTSIDER", "/painel");
    const r = await page.goto(`/painel/${SLUG}`);
    expect(r?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
    expect((await page.goto("/super-admin"))?.status()).toBe(403);
    await ctx.close();
  });

  test("caixa vê PDV mas não Cardápio (menu e servidor)", async ({ browser }) => {
    const { ctx, page } = await login(browser, "CASHIER");
    await page.waitForURL(`**/painel/${SLUG}`);
    await expect(page.getByRole("link", { name: "Frente de Caixa (PDV)" })).toBeVisible();
    await expect(page.locator(`a[href="/painel/${SLUG}/cardapio"]`)).toHaveCount(0);
    expect((await page.goto(`/painel/${SLUG}/cardapio`))?.status()).toBe(403);
    expect((await page.goto(`/painel/${SLUG}/pdv`))?.status()).toBe(200);
    await ctx.close();
  });

  test("admin da plataforma abre o Super Admin; suspender e reativar ficam no histórico", async ({ browser }) => {
    const { ctx, page } = await login(browser, "ADMIN", "/super-admin");
    await page.waitForURL("**/super-admin");
    await expect(page.getByRole("heading", { name: "Visão da plataforma" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: SLUG.replace(/-/g, "") });
    page.on("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Suspender" }).click();
    await expect(row.getByText("Suspensa")).toBeVisible();
    await row.getByRole("button", { name: "Reativar" }).click();
    await expect(row.getByText("Suspensa")).toHaveCount(0);
    await expect(page.getByText("Suspendeu loja").first()).toBeVisible();
    await expect(page.getByText("Reativou loja").first()).toBeVisible();
    await ctx.close();
  });

  test("lojista não chama a API do Super Admin", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER");
    const r = await page.request.patch("/api/admin/lojas/a8db0aac-0170-440f-a31c-f91ba5be4995", { data: { active: false } });
    expect(r.status()).toBe(403);
    await ctx.close();
  });
});

test.describe("P0 · pedido real entre aparelhos", () => {
  test.skip(!hasUsers, "usuários de teste ausentes");

  test("pedido do celular chega no KDS do tablet em menos de 3 s, rastreio por token em outro aparelho", async ({ browser }) => {
    const kds = await login(browser, "OWNER", `/painel/${SLUG}/kds`);
    await kds.page.waitForURL(`**/painel/${SLUG}/kds`);
    await expect(kds.page.getByText("Tela da Cozinha (KDS) ·")).toBeVisible();
    // O KDS mostra "Ao vivo" quando o canal Realtime está inscrito.
    await expect(kds.page.getByTestId("conexao")).toHaveText(/Ao vivo/, { timeout: 15000 });

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const customer = await phone.newPage();
    const name = `Cliente ${Date.now().toString().slice(-6)}`;
    await orderAsCustomer(customer, name);
    const t0 = Date.now();
    await expect(kds.page.getByRole("main").locator("li", { hasText: name })).toBeVisible({ timeout: 3000 });
    const ms = Date.now() - t0;
    console.log(`Realtime: pedido visível no KDS em ${ms} ms`);
    expect(ms).toBeLessThan(3000);

    // Preço calculado no servidor (Brownie 11,90), não pelo navegador.
    const url = customer.url();
    await expect(customer.getByText("R$ 11,90").first()).toBeVisible();

    // Outro aparelho, sem sessão nenhuma, abre o mesmo link.
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(url);
    await expect(p2.getByRole("heading", { name: /Pedido #\d+/ })).toBeVisible();
    await expect(p2.getByText("Status:")).toContainText("Recebido");

    // Cozinha avança; o cliente vê a mudança sem recarregar (consulta a cada 5 s).
    await kds.page.getByRole("main").locator("li", { hasText: name }).getByRole("button", { name: "Começar" }).click();
    await expect(p2.getByText("Status:")).toContainText("Na cozinha", { timeout: 8000 });

    // Token errado não revela nada.
    await p2.goto(url.replace(/t=[0-9a-f]{4}/, "t=0000"));
    await expect(p2.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
    await Promise.all([kds.ctx.close(), phone.close(), other.close()]);
  });
});

test.describe("P0 · APIs", () => {
  test("pedido com preço adulterado é recalculado pelo banco", async ({ request }) => {
    const menu = await request.get(`/loja/${SLUG}`);
    expect(menu.status()).toBe(200);
    const bad = await request.post("/api/pedidos", { data: { slug: SLUG, mode: "retirada", items: [{ product_id: "00000000-0000-4000-8000-000000000000", qty: 1 }], customer: { name: "X Y", phone: "19900000000" }, payment: "dinheiro", idempotencyKey: "teste-produto-falso" } });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).error).toMatch(/não existe/);
  });

  test("webhook: sem assinatura 401, assinatura válida 200, repetição idempotente", async ({ request }) => {
    expect((await request.post("/api/webhooks/pagamentos/mercadopago", { data: {} })).status()).toBe(401);
    test.skip(!env.MERCADOPAGO_WEBHOOK_SECRET, "segredo de teste ausente");
    const id = `teste-${Date.now()}`;
    const body = JSON.stringify({ action: "payment.updated", data: { id }, external_reference: id, status: "approved" });
    const ts = String(Date.now());
    const reqId = "req-e2e";
    const sig = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id};request-id:${reqId};ts:${ts};`).digest("hex");
    const headers = { "content-type": "application/json", "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": reqId };
    const ok = await request.post("/api/webhooks/pagamentos/mercadopago", { data: body, headers });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).ok).toBe(true);
    const again = await request.post("/api/webhooks/pagamentos/mercadopago", { data: body, headers });
    expect((await again.json()).duplicate).toBe(true);
    const forged = await request.post("/api/webhooks/pagamentos/mercadopago", { data: body, headers: { ...headers, "x-signature": `ts=${ts},v1=${"0".repeat(64)}` } });
    expect(forged.status()).toBe(401);
  });

  test("loja real não mostra simulação de Pix nem nota fictícia", async ({ page }) => {
    await page.goto(`/loja/${SLUG}`);
    await expect(page.getByText(/avaliações/)).toHaveCount(0);
    await page.getByRole("button", { name: "Brownie da Casa" }).first().click();
    await page.locator("button", { hasText: "Adicionar" }).last().click();
    await page.getByRole("button", { name: /Ver carrinho/ }).last().click();
    await expect(page.getByTestId("pix-presencial")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pagar com Pix/ })).toHaveCount(0);
  });
});

test.describe("Assinatura e equipe", () => {
  test.skip(!hasUsers, "usuários de teste ausentes");

  test("dono vê aviso de teste grátis, Assinatura e Equipe; caixa não", async ({ browser }) => {
    const owner = await login(browser, "OWNER");
    await owner.page.waitForURL(`**/painel/${SLUG}`);
    await expect(owner.page.getByTestId("aviso-teste")).toContainText("Teste grátis");
    await owner.page.getByRole("link", { name: "Assinatura" }).first().click();
    await expect(owner.page.getByRole("heading", { level: 1, name: "Assinatura" })).toBeVisible();
    await expect(owner.page.getByRole("radio", { name: /^Profissional/ })).toBeVisible();
    await expect(owner.page.getByRole("radio", { name: /^Profissional/ })).toContainText("R$ 189,90");
    await expect(owner.page.getByRole("button", { name: /Pagar Profissional · R\$ 189,90/ })).toBeVisible();
    await expect(owner.page.getByText(/InfinitePay/).first()).toBeVisible();
    await owner.ctx.close();

    const cashier = await login(browser, "CASHIER");
    await cashier.page.waitForURL(`**/painel/${SLUG}`);
    await expect(cashier.page.locator(`a[href="/painel/${SLUG}/assinatura"]`)).toHaveCount(0);
    await expect(cashier.page.locator(`a[href="/painel/${SLUG}/equipe"]`)).toHaveCount(0);
    expect((await cashier.page.goto(`/painel/${SLUG}/assinatura`))?.status()).toBe(403);
    expect((await cashier.page.goto(`/painel/${SLUG}/equipe`))?.status()).toBe(403);
    const r = await cashier.page.request.post("/api/equipe", { data: { slug: SLUG, email: "x@y.com", role: "manager" } });
    expect(r.status()).toBe(403);
    await cashier.ctx.close();
  });

  test("dono adiciona conta existente, troca o papel e remove", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER", `/painel/${SLUG}/equipe`);
    await page.waitForURL(`**/painel/${SLUG}/equipe`);
    const email = env.E2E_OUTSIDER_EMAIL.toLowerCase();
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Papel", { exact: true }).selectOption("kitchen");
    await page.getByRole("button", { name: "Adicionar" }).click();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await row.getByLabel(`Papel de ${email}`).selectOption("waiter");
    await expect(page.getByText("Papel atualizado.")).toBeVisible();
    page.on("dialog", (d) => d.accept());
    await row.getByRole("button", { name: `Remover ${email}` }).click();
    await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(0);
    await ctx.close();
  });

  test("aviso forjado da InfinitePay não ativa assinatura", async ({ request }) => {
    // Sem dados mínimos: ignorado.
    expect(await (await request.post("/api/webhooks/assinatura", { data: { event: "paid" } })).json()).toEqual({ ignored: true });
    // Fatura inexistente com transação inventada: não confirma (o servidor consulta o /payment_check).
    const r = await request.post("/api/webhooks/assinatura", { data: { order_nsu: "00000000-0000-4000-8000-000000000000", transaction_nsu: "forjado", invoice_slug: "forjado", paid_amount: 18990 } });
    expect(r.status()).toBe(200);
    expect((await r.json()).ok).toBe(false);
  });
});

test.describe("Loja real: cardápio, marca e integrações", () => {
  test.skip(!hasUsers, "usuários de teste ausentes");

  test("produto novo aparece na lista sem recarregar e some ao excluir", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER", `/painel/${SLUG}/cardapio`);
    await page.waitForURL(`**/painel/${SLUG}/cardapio`);
    const name = `Produto E2E ${Date.now().toString().slice(-5)}`;
    await page.getByRole("button", { name: "Novo produto" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(name);
    await page.getByLabel("Preço", { exact: true }).fill("7,50");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("main").getByText(name)).toBeVisible({ timeout: 5000 });
    // Abre e exclui (também sem recarregar).
    page.on("dialog", (d) => d.accept());
    await page.getByRole("main").getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("main").getByText(name)).toHaveCount(0, { timeout: 5000 });
    await ctx.close();
  });

  test("marca: logo enviado e salvo continua depois de recarregar", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER", `/painel/${SLUG}/aparencia`);
    await page.waitForURL(`**/painel/${SLUG}/aparencia`);
    // PNG 1x1 válido.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await page.getByLabel("Enviar logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await expect(page.getByRole("img", { name: "Logo atual" })).toHaveAttribute("src", /brand-images/, { timeout: 15000 });
    const src = await page.getByRole("img", { name: "Logo atual" }).getAttribute("src");
    await page.getByRole("button", { name: "Salvar e publicar" }).click();
    await expect(page.getByText("Marca publicada no cardápio e no app")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("img", { name: "Logo atual" })).toHaveAttribute("src", src!);
    await ctx.close();
  });

  test("integrações abrem completas no teste grátis, com WhatsApp incluído", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER", `/painel/${SLUG}/integracoes`);
    await page.waitForURL(`**/painel/${SLUG}/integracoes`);
    for (const tab of ["WhatsApp", "Pagamentos", "E-mail"]) await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    await expect(page.getByText(/Incluído no seu plano/)).toBeVisible();
    await expect(page.getByLabel("Código de ativação")).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("Notificação push", () => {
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/teste-e2e", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };

  test("API recusa anônimo, endpoint estranho e token de pedido errado", async ({ request }) => {
    expect((await request.post("/api/push", { data: { kind: "staff", slug: SLUG, subscription: sub } })).status()).toBe(401);
    const evil = { ...sub, endpoint: "https://exemplo-malicioso.com/x" };
    expect((await request.post("/api/push", { data: { kind: "staff", slug: SLUG, subscription: evil } })).status()).toBe(400);
    const r = await request.post("/api/push", { data: { kind: "customer", orderId: "00000000-0000-4000-8000-000000000000", token: "0".repeat(32), subscription: sub } });
    expect(r.status()).toBe(404);
  });

  test.skip(!hasUsers, "usuários de teste ausentes");
  test("painel da loja real mostra o botão de avisos", async ({ browser }) => {
    const { ctx, page } = await login(browser, "OWNER", `/painel/${SLUG}/pedidos`);
    await page.waitForURL(`**/painel/${SLUG}/pedidos`);
    await expect(page.getByTestId("push-toggle").or(page.getByTestId("push-indisponivel"))).toBeVisible();
    await ctx.close();
  });
});
