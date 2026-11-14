import { expect, test } from "@playwright/test";

test.describe("SEO e 404", () => {
  test("loja inexistente responde 404 com página própria", async ({ page }) => {
    const r = await page.goto("/loja/loja-que-nao-existe-xyz");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("robots.txt bloqueia painel e aponta o sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /painel");
    expect(body).toContain("Disallow: /super-admin");
    expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("sitemap lista lojas reais e não as demonstrações", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("/loja/loja-teste-p0");
    expect(body).not.toContain("/loja/cafe-e-flor");
  });

  test("loja tem canonical e dados estruturados", async ({ page }) => {
    await page.goto("/loja/cafe-e-flor");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/loja\/cafe-e-flor$/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
    expect(ld["@type"]).toBe("CafeOrCoffeeShop");
    expect(ld.name).toBe("Café e Flor");
    expect(ld.openingHoursSpecification?.length).toBeGreaterThan(0);
  });
});
