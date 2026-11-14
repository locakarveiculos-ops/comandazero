import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Fase 0: varre cada rota em desktop, tablet e celular; registra erros de console/rede e elementos interativos sem nome.
// Saída: docs/auditoria/baseline.json (lido pelo inventário de rotas).
const ROUTES = [
  "/", "/entrar", "/loja/cafe-e-flor", "/loja/cafe-e-flor?mesa=07", "/loja/burger-station",
  "/painel/cafe-e-flor", "/painel/cafe-e-flor/pedidos", "/painel/cafe-e-flor/pdv", "/painel/cafe-e-flor/mesas",
  "/painel/cafe-e-flor/kds", "/painel/cafe-e-flor/cardapio", "/painel/cafe-e-flor/fidelidade",
  "/painel/cafe-e-flor/aparencia", "/painel/cafe-e-flor/integracoes", "/super-admin",
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 1024, height: 768 }, mobile: { width: 390, height: 844 } };

test("baseline de rotas", async ({ browser }) => {
  test.setTimeout(600_000);
  const rows: Record<string, unknown>[] = [];
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const console_: string[] = [];
      const network: string[] = [];
      page.on("pageerror", (e) => console_.push(e.message.slice(0, 160)));
      page.on("console", (m) => m.type() === "error" && console_.push(m.text().slice(0, 160)));
      page.on("response", (r) => r.status() >= 400 && !/unsplash|viacep/.test(r.url()) && network.push(`${r.status()} ${new URL(r.url()).pathname}`));
      const t0 = Date.now();
      const res = await page.goto(route);
      await page.waitForLoadState("networkidle");
      const loadMs = Date.now() - t0;
      const info = await page.evaluate(() => {
        const vis = (el: Element) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        };
        const interactive = [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")].filter(vis);
        const unnamed = interactive.filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || (el as HTMLInputElement).labels?.length || el.getAttribute("title") || el.getAttribute("placeholder")));
        return {
          title: document.title,
          h1: document.querySelector("h1")?.textContent?.trim() ?? "",
          interactive: interactive.length,
          unnamed: unnamed.map((el) => el.outerHTML.slice(0, 90)),
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      rows.push({ viewport: vp, route, status: res?.status(), loadMs, ...info, console: console_, network });
      await page.close();
    }
    await ctx.close();
  }
  mkdirSync("docs/auditoria", { recursive: true });
  writeFileSync("docs/auditoria/baseline.json", JSON.stringify(rows, null, 2));
});
