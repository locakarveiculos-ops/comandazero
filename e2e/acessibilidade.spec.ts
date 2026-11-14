import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Auditoria WCAG 2.2 AA com axe-core + verificações próprias (área de toque, rótulos, teclado).
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

type AxeResult = { violations: { id: string; impact: string; nodes: { target: string[] }[] }[] };

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(
    () =>
      (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<AxeResult> } }).axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      }) as Promise<AxeResult>,
  );
}

const PAGES = ["/", "/entrar", "/loja/cafe-e-flor", "/loja/burger-station", "/painel/cafe-e-flor", "/painel/cafe-e-flor/pedidos", "/painel/cafe-e-flor/pdv", "/painel/cafe-e-flor/mesas", "/painel/cafe-e-flor/kds", "/painel/cafe-e-flor/cardapio", "/painel/cafe-e-flor/integracoes", "/super-admin"];

for (const path of PAGES) {
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark" && path.startsWith("/loja")) continue; // loja não tem modo escuro do SaaS
    test(`axe WCAG AA ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => {
        const raw = localStorage.getItem("comandazero-db");
        if (t === "dark" && !raw) localStorage.setItem("comandazero-db", JSON.stringify({ state: { saasTheme: "dark" }, version: 2 }));
      }, theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      const r = await axe(page);
      const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}

for (const path of ["/loja/cafe-e-flor", "/painel/cafe-e-flor/pdv", "/painel/cafe-e-flor", "/painel/cafe-e-flor/kds"]) {
  test(`área de toque ≥ 44×44 e rótulos em botões de ícone ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, a[href], [role=radio], [role=switch], [role=tab], input:not([type=hidden]), select")]
        .filter((el) => {
          const s = getComputedStyle(el);
          if (s.visibility === "hidden" || s.display === "none" || el.closest("[aria-hidden=true], .sr-only")) return false;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          // Links dentro de texto corrido são isentos (WCAG 2.5.8, exceção "inline").
          if (el.tagName === "A" && s.display === "inline") return false;
          const name = (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).labels?.[0]?.textContent || el.getAttribute("title") || "").trim();
          const small = Math.round(r.width) < 44 || Math.round(r.height) < 44;
          // Switch tem área de toque ampliada por pseudo-elemento (before:-inset-2).
          const isSwitch = el.getAttribute("role") === "switch";
          return (small && !isSwitch && el.tagName !== "INPUT") || !name;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`),
    );
    expect(bad).toEqual([]);
  });
}

test("teclado: Tab mostra foco visível, Esc fecha modal", async ({ page }) => {
  await page.goto("/loja/cafe-e-flor");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).toBe("solid");
  await page.getByRole("button", { name: "Cappuccino Artesanal" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
