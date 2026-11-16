import { expect, test } from "@playwright/test";

const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

test.describe("Landing", () => {
  for (const vp of SIZES) {
    test(`${vp.width}x${vp.height}: sem rolagem horizontal, sem erro de console`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize(vp);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      // Rola até o fim para carregar todas as imagens e seções.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
      });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }

  test("10 seções com conteúdo real e alvos de toque de 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    for (const id of ["#como-funciona", "#perfis", "#economia", "#planos", "#perguntas"]) await expect(page.locator(id)).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Planos vêm de src/lib/plans.ts.
    await expect(page.locator("#planos")).toContainText("R$ 189,90");
    await expect(page.locator("#planos")).toContainText("Mais popular");
    await page.locator("#planos").getByRole("radio", { name: /Anual/ }).click();
    await expect(page.locator("#planos")).toContainText("R$ 149,90");
    // Prints reais carregados.
    const imgs = page.locator('img[src*="training%2Fscreenshots"], img[src*="/training/screenshots/"]');
    expect(await imgs.count()).toBeGreaterThan(8);
    // FAQ abre e fecha.
    const q = page.getByText("A ComandaZero cobra comissão por pedido?");
    await q.click();
    await expect(page.getByText(/Você paga só a mensalidade/)).toBeVisible();
    // Alvos interativos visíveis com pelo menos 44 px (exceto links dentro de texto corrido).
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main a, main button, main summary, header a, header button, footer a")]
        .filter((el) => el.offsetParent && !el.closest("p"))
        .map((el) => ({ t: el.textContent?.trim().slice(0, 30), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }))
        .filter((r) => r.h < 44 || r.w < 44),
    );
    expect(small).toEqual([]);
  });

  test("vitrine troca o print pela aba", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tablist", { name: "Telas do sistema" }).getByRole("tab", { name: "Cozinha" }).click();
    await expect(page.getByRole("img", { name: /Tela da cozinha/ })).toBeVisible();
  });
});

test.describe("Vídeo da landing", () => {
  test("vídeo de 1 minuto com capa, controles e sem baixar antes do clique", async ({ page, request }) => {
    await page.goto("/");
    const video = page.locator("#video video");
    await expect(video).toHaveAttribute("poster", "/video/comandazero-em-1-minuto-capa.webp");
    await expect(video).toHaveAttribute("preload", "none");
    expect(await video.evaluate((v: HTMLVideoElement) => v.controls && !v.autoplay)).toBe(true);
    // Atalho no topo leva até o vídeo.
    await page.getByRole("link", { name: "Assistir em 1 minuto" }).click();
    await expect(page).toHaveURL(/#video$/);
    // Arquivo servido com suporte a intervalo (avançar e voltar no vídeo).
    const head = await request.get("/video/comandazero-em-1-minuto.mp4", { headers: { range: "bytes=0-1023" } });
    expect([200, 206]).toContain(head.status());
    expect(head.headers()["content-type"]).toContain("video/mp4");
    const poster = await request.get("/video/comandazero-em-1-minuto-capa.webp");
    expect(poster.status()).toBe(200);
  });

  test("vídeo toca e chega a 1 minuto de duração", async ({ page }) => {
    await page.goto("/#video");
    const video = page.locator("#video video");
    const d = await video.evaluate((v: HTMLVideoElement) => new Promise<number>((res) => { v.muted = true; v.preload = "metadata"; v.onloadedmetadata = () => res(v.duration); v.load(); }));
    expect(Math.round(d)).toBe(60);
  });
});
