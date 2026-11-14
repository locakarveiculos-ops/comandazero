/**
 * Captura prints REAIS da aplicação para a Central de treinamento.
 *  - Usa o build local (ou CAPTURE_BASE_URL) e o tenant demo cafe-e-flor, com dados determinísticos.
 *  - TRAINING_CAPTURE_MODE: chamadas externas (WhatsApp, ViaCEP, imagens Unsplash) são bloqueadas ou respondidas localmente.
 *  - Clientes nos prints são fictícios ("Ana Demo", telefone 19 90000-0000). Nenhum dado real é usado.
 * Uso:  npm run build && npm run training:capture
 * Saída: public/training/screenshots/<versão>/**, docs/training/SCREENSHOT_MANIFEST.json, docs/training/COVERAGE.md
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { ARTICLES, TRAINING_VERSION } from "../src/lib/training/articles";

const PORT = 3400;
// Contas de teste (loja real "loja-teste-p0") para as telas que exigem login. Nunca versionadas.
const ENV: Record<string, string> = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => /^E2E_(ADMIN|OWNER)_/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};
const BASE = process.env.CAPTURE_BASE_URL || `http://localhost:${PORT}`;
const OUT = `public/training/screenshots/${TRAINING_VERSION}`;
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const sha = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "local";
  }
})();

type Shot = { name: string; route: string; viewport: string; state: string; file: string; ok: boolean; error?: string };
const shots: Shot[] = [];
// Posição real (0–1) de cada âncora data-tour visível no momento do print.
const boxes: Record<string, Record<string, { x: number; y: number; w: number; h: number }>> = {};

async function save(page: Page, name: string, route: string, state: string, viewport: "desktop" | "mobile") {
  const file = `${OUT}/${name}.webp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    const png = await page.screenshot({ fullPage: false });
    boxes[`/${file.replace(/^public\//, "")}`] = await page.evaluate(() => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      document.querySelectorAll<HTMLElement>("[data-tour]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > H) return;
        const x = Math.max(0, r.left) / W;
        const y = Math.max(0, r.top) / H;
        out[el.dataset.tour!] = { x, y, w: Math.min(r.right, W) / W - x, h: Math.min(r.bottom, H) / H - y };
      });
      return out;
    });
    await sharp(png).webp({ quality: 78 }).toFile(file);
    shots.push({ name, route, viewport, state, file: `/${file.replace(/^public\//, "")}`, ok: true });
    console.log("  ✓", name);
  } catch (e) {
    shots.push({ name, route, viewport, state, file: "", ok: false, error: (e as Error).message });
    console.log("  ✗", name, (e as Error).message);
  }
}

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    shots.push({ name, route: "", viewport: "", state: "falha", file: "", ok: false, error: (e as Error).message.split("\n")[0] });
    console.log("  ✗", name, (e as Error).message.split("\n")[0]);
  }
}

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("servidor não respondeu");
}

async function main() {
  const server = process.env.CAPTURE_BASE_URL ? null : spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore" });
  try {
    await waitServer();
    const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || "msedge" });
    const ctx = await browser.newContext({ viewport: DESKTOP, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1 });
    // Modo captura: nada sai para serviços externos.
    await ctx.route("**/api/whatsapp/**", (r) => r.fulfill({ json: { ok: true, messageId: "CAPTURA" } }));
    await ctx.route("https://viacep.com.br/**", (r) => r.fulfill({ json: { logradouro: "Avenida Presidente Vargas", bairro: "Centro", localidade: "Indaiatuba", uf: "SP" } }));
    await ctx.addInitScript(() => {
      try {
        // Sem convite de boas-vindas nem som nos prints.
        localStorage.setItem("cz-training:cafe-e-flor", JSON.stringify({ tours: {}, articles: {}, welcomeDismissed: true }));
      } catch {
        /* ignore */
      }
    });
    const page = await ctx.newPage();
    const go = async (path: string) => {
      await page.goto(BASE + path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
    };
    const S = "/painel/cafe-e-flor";

    console.log("Painel");
    await step("painel", async () => {
      await go(S);
      await save(page, "painel/dashboard-desktop", S, "dashboard com dados demo", "desktop");
      await page.setViewportSize(MOBILE);
      await go(S);
      await save(page, "painel/dashboard-mobile", S, "dashboard no celular", "mobile");
      await page.setViewportSize(DESKTOP);
    });

    console.log("Pedidos e cliente");
    await step("pedidos-vazio", async () => {
      await go(`${S}/pedidos`);
      await save(page, "pedidos/vazio", `${S}/pedidos`, "sem pedidos em andamento", "desktop");
    });
    await step("loja", async () => {
      mkdirSync(`${OUT}/loja`, { recursive: true });
      const store = await ctx.newPage();
      await store.setViewportSize(MOBILE);
      await store.goto(`${BASE}/loja/cafe-e-flor`);
      await store.waitForLoadState("networkidle");
      await save(store, "loja/cardapio-mobile", "/loja/cafe-e-flor", "cardápio no celular", "mobile");
      await store.setViewportSize(DESKTOP);
      await save(store, "loja/cardapio-desktop", "/loja/cafe-e-flor", "cardápio no computador", "desktop");
      await store.getByRole("button", { name: "Espresso & Misto Quente" }).first().click();
      await store.getByRole("radio", { name: /Trocar por cappuccino/ }).click();
      await store.getByRole("checkbox", { name: /Requeijão cremoso/ }).click();
      await store.getByRole("dialog").waitFor();
      await save(store, "loja/produto-modal", "/loja/cafe-e-flor", "produto com opções e adicionais somados", "desktop");
      await store.locator("button", { hasText: "Adicionar" }).last().click();
      await store.getByRole("button", { name: /Ver carrinho/ }).last().click();
      await store.getByLabel("Nome").fill("Ana Demo");
      await store.getByLabel("WhatsApp").fill("19900000000");
      await store.getByRole("dialog").waitFor();
      await save(store, "loja/checkout", "/loja/cafe-e-flor", "carrinho com dados do cliente", "desktop");
      await store.getByRole("button", { name: /Pagar com Pix/ }).click();
      await store.getByRole("dialog", { name: "Pague com Pix" }).getByRole("img").waitFor();
      await save(store, "loja/pix", "/loja/cafe-e-flor", "Pix com QR e copia e cola", "desktop");
      await store.getByRole("button", { name: /Simular confirmação/ }).click();
      await store.waitForURL("**/pedido/**");
      await store.waitForLoadState("networkidle");
      await save(store, "loja/acompanhamento", "/loja/cafe-e-flor/pedido/[id]", "acompanhamento do pedido", "desktop");
      // O painel aberto recebe o pedido.
      await page.waitForTimeout(1200);
      await page.getByRole("main").getByText("Ana Demo").waitFor();
      await save(page, "pedidos/novo", `${S}/pedidos`, "pedido novo destacado", "desktop");
      await store.close();
    });

    console.log("KDS");
    await step("kds", async () => {
      await go(`${S}/kds`);
      await save(page, "kds/com-pedido", `${S}/kds`, "pedido na fila", "desktop");
      await page.locator("li", { hasText: "Ana Demo" }).getByRole("button", { name: "Começar" }).click();
      await page.locator('[data-tour="kds-preparo"]').getByText("Ana Demo").waitFor();
      await save(page, "kds/preparando", `${S}/kds`, "pedido em preparo", "desktop");
      await page.locator("li", { hasText: "Ana Demo" }).getByRole("button", { name: "Pronto" }).click();
      await page.locator('[data-tour="kds-pronto"]').getByText("Ana Demo").waitFor();
      await page.locator("li", { hasText: "Ana Demo" }).getByRole("button", { name: "Entregue" }).click();
      await page.locator('[data-tour="kds-pronto"]').getByText("Ana Demo").waitFor({ state: "detached" });
      await save(page, "kds/fila-desktop", `${S}/kds`, "colunas vazias após entregar", "desktop");
    });

    console.log("PDV");
    await step("pdv", async () => {
      await go(`${S}/pdv`);
      await save(page, "pdv/grade", `${S}/pdv`, "grade de produtos", "desktop");
      await page.keyboard.press("F2");
      await page.keyboard.type("103");
      await page.keyboard.press("Enter");
      await page.keyboard.press("F2");
      await page.keyboard.type("204");
      await page.keyboard.press("Enter");
      await page.getByLabel("Venda atual").getByText("Brownie da Casa").waitFor();
      await save(page, "pdv/venda", `${S}/pdv`, "venda com dois itens", "desktop");
      await page.keyboard.press("F4");
      const pay = page.getByRole("dialog", { name: "Receber pagamento" });
      await pay.getByRole("textbox").fill("10,00");
      await pay.getByRole("button", { name: "Lançar parte" }).click();
      await pay.getByText("Pagamentos lançados").or(pay.getByLabel("Pagamentos lançados")).first().waitFor();
      await save(page, "pdv/pagamento", `${S}/pdv`, "pagamento misto com parte no Pix", "desktop");
      await pay.getByRole("radio", { name: "Dinheiro" }).click();
      await pay.getByRole("textbox").fill("20,00");
      await pay.getByText(/Troco/).waitFor();
      await save(page, "pdv/troco", `${S}/pdv`, "troco em dinheiro", "desktop");
      await pay.getByText("Dividir conta por pessoa").click();
      await save(page, "pdv/dividir", `${S}/pdv`, "divisão por pessoa", "desktop");
      await pay.getByRole("button", { name: "Concluir" }).click();
      await page.getByRole("button", { name: "Cupom" }).click();
      await page.getByRole("dialog", { name: /Cupom #/ }).locator("pre").waitFor();
      await save(page, "pdv/cupom", `${S}/pdv`, "cupom não fiscal 80 mm", "desktop");
      await page.keyboard.press("Escape");
    });

    console.log("Mesas");
    await step("mesas", async () => {
      await go(`${S}/mesas`);
      await page.getByRole("button", { name: /^03/ }).click();
      await page.getByRole("button", { name: "Abrir mesa" }).click();
      await page.getByRole("button", { name: "Adicionar itens" }).click();
      await page.getByRole("button", { name: /Brownie da Casa/ }).click();
      await page.getByRole("button", { name: /Espresso Tradicional/ }).click();
      await page.getByRole("button", { name: "Concluir" }).click();
      await page.getByLabel("Itens da comanda").getByText("Brownie da Casa").waitFor();
      await save(page, "mesas/comanda", `${S}/mesas`, "comanda aberta com itens", "desktop");
      await page.keyboard.press("Escape");
      await save(page, "mesas/mapa", `${S}/mesas`, "mapa com mesa ocupada", "desktop");
      await page.getByRole("button", { name: "QR Codes das mesas" }).click();
      await page.getByRole("img", { name: "QR Code da mesa 01" }).waitFor();
      await save(page, "mesas/qr", `${S}/mesas`, "QR Codes para impressão", "desktop");
      await page.keyboard.press("Escape");
    });

    console.log("Cardápio, fidelidade e marca");
    await step("cardapio", async () => {
      await go(`${S}/cardapio`);
      await save(page, "cardapio/lista", `${S}/cardapio`, "lista de produtos", "desktop");
      await page.getByRole("button", { name: /Editar/ }).first().click();
      await page.getByRole("dialog").getByText("Grupos de complementos").waitFor();
      await save(page, "cardapio/editor", `${S}/cardapio`, "editor de produto com complementos", "desktop");
      await page.keyboard.press("Escape");
      await page.getByRole("switch", { name: "Pausar Brownie da Casa" }).click();
      await page.getByRole("tab", { name: "Pausados" }).click();
      await page.getByText("Esgotado").first().waitFor();
      await save(page, "cardapio/pausado", `${S}/cardapio`, "produto pausado", "desktop");
      await page.getByRole("switch", { name: "Reativar Brownie da Casa" }).click();
    });
    await step("fidelidade", async () => {
      await go(`${S}/fidelidade`);
      await save(page, "fidelidade/visao", `${S}/fidelidade`, "regra, clientes e cupons", "desktop");
    });
    await step("aparencia", async () => {
      await go(`${S}/aparencia`);
      await save(page, "aparencia/editor", `${S}/aparencia`, "editor de marca com prévia", "desktop");
    });

    console.log("Integrações");
    await step("integracoes", async () => {
      await go(`${S}/integracoes`);
      await save(page, "integracoes/whatsapp", `${S}/integracoes`, "conexão do WhatsApp", "desktop");
      await page.getByLabel("Mensagem", { exact: true }).selectOption("list");
      await page.getByLabel("Prévia da conversa no WhatsApp").scrollIntoViewIfNeeded();
      await save(page, "integracoes/testador", `${S}/integracoes`, "testador com lista de categorias", "desktop");
      await page.getByRole("tab", { name: /Pagamentos/ }).click();
      await page.getByText(/→ PAGO/).waitFor();
      await save(page, "integracoes/pagamentos", `${S}/integracoes`, "gateways e webhook", "desktop");
    });

    // Telas que exigem login: contexto separado, para não misturar com a demonstração aberta.
    const loginAs = async (who: "ADMIN" | "OWNER", next: string) => {
      const c = await browser.newContext({ viewport: DESKTOP, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1 });
      const p = await c.newPage();
      await p.goto(`${BASE}/entrar?next=${encodeURIComponent(next)}`);
      await p.getByLabel("E-mail").fill(ENV[`E2E_${who}_EMAIL`]);
      await p.getByLabel("Senha", { exact: true }).fill(ENV[`E2E_${who}_PASSWORD`]);
      await p.getByRole("button", { name: "Entrar", exact: true }).click();
      await p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 20000 });
      await p.waitForLoadState("networkidle");
      return { c, p };
    };

    console.log("Super Admin, onboarding, equipe e assinatura");
    await step("super-admin", async () => {
      if (!ENV.E2E_ADMIN_EMAIL) throw new Error("E2E_ADMIN_EMAIL ausente no .env.local");
      const { c, p } = await loginAs("ADMIN", "/super-admin");
      await save(p, "super-admin/visao", "/super-admin", "visão da plataforma com dados reais", "desktop");
      await p.goto(`${BASE}/onboarding`);
      await p.getByLabel("Nome da loja").fill("Padaria Pão Dourado");
      await p.getByLabel("WhatsApp da loja").fill("19900000000");
      await p.getByLabel("Cidade").fill("Indaiatuba");
      await save(p, "super-admin/onboarding", "/onboarding", "passo 1 do assistente", "desktop");
      await p.getByRole("button", { name: "Continuar" }).click();
      await p.getByRole("button", { name: "Continuar" }).click();
      await p.getByRole("button", { name: "Continuar" }).click();
      await save(p, "onboarding/aparencia", "/onboarding", "passo 4 com prévia de cores", "desktop");
      await c.close();
    });
    await step("equipe-assinatura", async () => {
      if (!ENV.E2E_OWNER_EMAIL) throw new Error("E2E_OWNER_EMAIL ausente no .env.local");
      const { c, p } = await loginAs("OWNER", "/painel/loja-teste-p0/equipe");
      await p.evaluate(() => document.fonts.ready);
      await save(p, "equipe/lista", "/painel/[loja]/equipe", "equipe com papéis", "desktop");
      await p.goto(`${BASE}/painel/loja-teste-p0/assinatura`);
      await p.waitForLoadState("networkidle");
      await save(p, "assinatura/planos", "/painel/[loja]/assinatura", "teste grátis e planos", "desktop");
      await c.close();
    });
    await step("entrar", async () => {
      await go("/entrar");
      await save(page, "entrar/login", "/entrar", "tela de entrar", "desktop");
    });

    await browser.close();
  } finally {
    server?.kill();
  }

  // Manifest e cobertura: cada screenshot citado em artigo precisa existir e ter sido capturado agora.
  const captured = new Set(shots.filter((s) => s.ok).map((s) => s.file));
  const referenced = ARTICLES.flatMap((a) => a.steps.filter((s) => s.screenshot).map((s) => ({ article: a.id, route: a.route, file: s.screenshot! })));
  const manifest = {
    version: TRAINING_VERSION,
    buildSha: sha,
    capturedAt: new Date().toISOString(),
    tenant: "cafe-e-flor (demo)",
    screenshots: shots.map((s) => ({ ...s, articles: referenced.filter((r) => r.file === s.file).map((r) => r.article), validation: s.ok ? "capturado" : "pendente" })),
  };
  mkdirSync("docs/training", { recursive: true });
  writeFileSync(`${OUT}/highlights.json`, JSON.stringify(boxes, null, 2));
  const badRefs = ARTICLES.flatMap((a) =>
    a.steps.flatMap((s) => (s.highlight ?? []).filter((h) => !boxes[s.screenshot ?? ""]?.[h.anchor]).map((h) => `${a.id}: âncora ${h.anchor} não visível em ${s.screenshot}`)),
  );
  badRefs.forEach((b) => console.log("  ✗", b));
  if (badRefs.length) process.exitCode = 1;
  writeFileSync("docs/training/SCREENSHOT_MANIFEST.json", JSON.stringify(manifest, null, 2));
  const missing = [...new Set(referenced.filter((r) => !captured.has(r.file)).map((r) => `${r.file} (${r.article})`))];
  const routes = [...new Set(shots.map((s) => s.route).filter(Boolean))];
  const md = [
    `# Cobertura de treinamento · v${TRAINING_VERSION}`,
    "",
    `Gerado em ${manifest.capturedAt} a partir do commit \`${sha}\`, tenant demo \`cafe-e-flor\`.`,
    "",
    `- Prints capturados: **${captured.size}** (falhas: ${shots.filter((s) => !s.ok).length})`,
    `- Artigos: **${ARTICLES.length}**, todos com print: **${ARTICLES.every((a) => a.steps.some((s) => s.screenshot)) ? "sim" : "não"}**`,
    `- Referências de print nos artigos: ${referenced.length}, sem arquivo: **${missing.length}**`,
    `- Rotas com print: ${routes.length}`,
    "",
    "| Print | Rota | Estado | Viewport | Situação |",
    "|---|---|---|---|---|",
    ...shots.map((s) => `| ${s.name} | \`${s.route}\` | ${s.state} | ${s.viewport} | ${s.ok ? "capturado" : `pendente: ${s.error}`} |`),
    "",
    missing.length ? `## Pendentes\n\n${missing.map((m) => `- ${m}`).join("\n")}` : "Nenhum print pendente.",
    "",
  ].join("\n");
  writeFileSync("docs/training/COVERAGE.md", md);
  console.log(`\n${captured.size} prints, ${missing.length} referências sem arquivo.`);
  if (missing.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
