import { expect, test } from "@playwright/test";
import { ARTICLES } from "../src/lib/training/articles";

test.describe("Central de treinamento e tours", () => {
  test("central lista guias com prints, busca e filtros", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/treinamento");
    await expect(page.getByRole("heading", { name: "Central de treinamento" })).toBeVisible();
    await expect(page.getByTestId("lista-guias").locator("li")).toHaveCount(ARTICLES.length);
    await page.getByTestId("busca-treinamento").fill("troco");
    await expect(page.getByTestId("lista-guias").locator("li")).toHaveCount(1);
    await expect(page.getByTestId("lista-guias")).toContainText("PDV");
    await page.getByTestId("busca-treinamento").fill("");
    await page.getByLabel("Filtrar por função").selectOption("cozinha");
    await expect(page.getByTestId("lista-guias")).toContainText("KDS");
  });

  test("todo print de todo artigo carrega (sem imagem quebrada)", async ({ page }) => {
    for (const a of ARTICLES) {
      await page.goto(`/painel/cafe-e-flor/treinamento?artigo=${a.id}`);
      await expect(page.getByRole("heading", { level: 1, name: a.title })).toBeVisible();
      const imgs = page.getByTestId("print-treinamento");
      await expect(imgs).toHaveCount(a.steps.filter((s) => s.screenshot).length);
      const broken = await imgs.evaluateAll((els) =>
        Promise.all(els.map(async (el) => {
          const img = el as HTMLImageElement;
          img.loading = "eager";
          if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
          return img.naturalWidth === 0 ? img.src : null;
        })).then((r) => r.filter(Boolean)),
      );
      expect(broken, a.id).toEqual([]);
    }
  });

  test("artigo: abrir tela, marcar concluído e feedback", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/treinamento?artigo=pdv-venda");
    await page.getByRole("button", { name: "Marcar como concluído" }).click();
    await page.getByRole("button", { name: "Sim, foi útil" }).click();
    await expect(page.getByRole("button", { name: "Sim, foi útil" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Todos os guias" }).click();
    await expect(page.getByText(/1 de \d+ guias concluídos/)).toBeVisible();
    await page.goto("/painel/cafe-e-flor/treinamento?artigo=pdv-venda");
    await page.getByRole("link", { name: /Abrir esta tela/ }).click();
    await expect(page).toHaveURL(/\/painel\/cafe-e-flor\/pdv$/);
  });

  test("tour do PDV pelo link: progresso, teclado e Esc devolve o controle", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/pdv?tour=pdv-venda");
    const pop = page.locator(".driver-popover");
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("1 de 5");
    await expect(pop).toContainText("Busque ou digite o código");
    // Enter no botão focado avança (sem depender da animação); depois as setas também navegam.
    await expect(pop.getByRole("button", { name: "Próximo" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(pop).toContainText("2 de 5");
    await expect(pop.getByRole("button", { name: "Próximo" })).toBeFocused();
    await expect(async () => {
      await page.keyboard.press("ArrowLeft");
      await expect(pop).toContainText("1 de 5", { timeout: 800 });
    }).toPass({ timeout: 6000 });
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);
    // O tour não executou nada: venda continua vazia.
    await expect(page.getByLabel("Venda atual")).toContainText("Toque nos produtos");
  });

  test("ajuda desta tela inicia o tour do KDS e conclui", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/kds");
    await page.getByTestId("ajuda-tela").click();
    await page.getByRole("button", { name: /Iniciar tour: Tela da cozinha/ }).click();
    const pop = page.locator(".driver-popover");
    await expect(pop).toContainText("Fila");
    for (let i = 0; i < 3; i++) await pop.getByRole("button", { name: "Próximo" }).click();
    await pop.getByRole("button", { name: "Concluir" }).click();
    await expect(pop).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cz-training:cafe-e-flor") || "{}"));
    expect(saved.tours["kds-cozinha"].status).toBe("completed");
  });

  test("boas-vindas: Não mostrar novamente persiste", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor");
    const region = page.getByRole("region", { name: "Boas-vindas" });
    await expect(region).toBeVisible();
    await region.getByRole("button", { name: "Não mostrar novamente" }).click();
    await page.reload();
    await expect(page.getByRole("region", { name: "Boas-vindas" })).toHaveCount(0);
  });

  test("tour do cliente no cardápio só abre ao tocar no ?", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    await page.getByTestId("ajuda-loja").click();
    await expect(page.locator(".driver-popover")).toContainText("Como você quer receber");
  });

  test("tour com âncora ausente pula o passo sem quebrar (celular)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/painel/cafe-e-flor?tour=painel-visao-geral");
    const pop = page.locator(".driver-popover");
    await expect(pop).toBeVisible();
    // O menu lateral não existe no celular: o tour tem 5 passos em vez de 6.
    await expect(pop).toContainText("1 de 5");
  });

  test("ativação: pedido de teste vai da Cozinha à Frente de Caixa em modo treino", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/kds");
    await page.getByRole("button", { name: "Fazer pedido de teste" }).click();
    const guide = page.getByRole("status").filter({ hasText: "Passo" });
    await expect(guide).toContainText("Passo 1 de 3");
    const ticket = page.getByRole("main").locator("li", { hasText: "Teste" }).first();
    await ticket.getByRole("button", { name: "Começar" }).click();
    await expect(guide).toContainText("Passo 2 de 3");
    await page.getByRole("main").locator("li", { hasText: "Teste" }).first().getByRole("button", { name: "Pronto" }).click();
    await page.getByRole("link", { name: /Treinar cobrança/ }).click();
    await expect(page).toHaveURL(/\/pdv\?treino=1$/);
    await expect(page.getByText("Modo treino: nada é registrado.")).toBeVisible();
    await page.getByRole("button", { name: "Finalizar (F4)" }).click();
    const pay = page.getByRole("dialog", { name: "Receber pagamento" });
    await pay.getByRole("radio", { name: "Dinheiro" }).click();
    await pay.getByRole("textbox").fill("100,00");
    await expect(pay.getByText(/Troco:/)).toBeVisible();
    await pay.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByText(/Treino concluído/)).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cz-training:cafe-e-flor") || "{}"));
    expect(saved.checklist["pedido-teste"]).toBe(true);
    expect(saved.checklist.pdv).toBe(true);
  });

  test("ativação: botão do topo mostra o % e os passos", async ({ page }) => {
    await page.goto("/painel/cafe-e-flor/pedidos");
    await page.getByTestId("ativacao").click();
    const panel = page.getByRole("dialog", { name: /pronta para vender/ });
    await expect(panel.getByRole("progressbar")).toBeVisible();
    await expect(panel).toContainText("Ter produtos no cardápio");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
});
