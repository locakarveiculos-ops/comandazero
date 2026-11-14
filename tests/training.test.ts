import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLES, TRAINING_VERSION, articleById } from "@/lib/training/articles";
import { CHECKLIST, TOURS } from "@/lib/training/tours";

// Garante que a Central de treinamento só referencia prints, rotas, âncoras e guias que existem de verdade.
const ROOT = process.cwd();
const APP_ROUTES = new Set(["/", "/entrar", "/super-admin", "/loja/{slug}", "/painel/{slug}", "/painel/{slug}/pedidos", "/painel/{slug}/pdv", "/painel/{slug}/mesas", "/painel/{slug}/kds", "/painel/{slug}/cardapio", "/painel/{slug}/fidelidade", "/painel/{slug}/aparencia", "/painel/{slug}/integracoes", "/painel/{slug}/treinamento"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const anchors = new Set(
  walk(join(ROOT, "src"))
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/data-tour=(?:"([^"]+)"|\{`kds-\$\{col\.status\}`\})/g)].map((m) => m[1] ?? "kds-*")),
);
const anchorExists = (a: string) => anchors.has(a) || (a.startsWith("kds-") && ["kds-recebido", "kds-preparo", "kds-pronto"].includes(a) && anchors.has("kds-*"));

describe("artigos", () => {
  it("ids únicos e campos obrigatórios", () => {
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.title.length, a.id).toBeGreaterThan(5);
      expect(a.steps.length, a.id).toBeGreaterThan(0);
      expect(a.expectedResult, a.id).toBeTruthy();
      expect(a.version, a.id).toBe(TRAINING_VERSION);
      expect(APP_ROUTES.has(a.route), `${a.id} rota ${a.route}`).toBe(true);
    }
  });

  it("todo artigo tem ao menos um print e todo print existe em public/", () => {
    for (const a of ARTICLES) {
      expect(a.steps.some((s) => s.screenshot), `${a.id} sem print`).toBe(true);
      for (const s of a.steps.filter((x) => x.screenshot)) {
        expect(existsSync(join(ROOT, "public", s.screenshot!)), `${a.id}: ${s.screenshot}`).toBe(true);
        expect(s.alt, `${a.id}: print sem texto alternativo`).toBeTruthy();
      }
    }
  });

  it("destaques apontam para âncoras medidas no próprio print", () => {
    const boxes = JSON.parse(readFileSync(join(ROOT, "public/training/screenshots", TRAINING_VERSION, "highlights.json"), "utf8"));
    for (const a of ARTICLES)
      for (const s of a.steps)
        for (const h of s.highlight ?? []) expect(boxes[s.screenshot!]?.[h.anchor], `${a.id}: ${h.anchor} em ${s.screenshot}`).toBeTruthy();
  });

  it("guias relacionados e pré-requisitos existem", () => {
    for (const a of ARTICLES) for (const id of [...a.relatedGuides, ...a.prerequisites]) expect(articleById(id), `${a.id} -> ${id}`).toBeTruthy();
  });
});

describe("tours", () => {
  it("rotas válidas, versão e âncoras presentes no código", () => {
    expect(new Set(TOURS.map((t) => t.id)).size).toBe(TOURS.length);
    for (const t of TOURS) {
      expect(APP_ROUTES.has(t.route), `${t.id} rota`).toBe(true);
      expect(t.version).toBeGreaterThan(0);
      for (const s of t.steps) if (s.anchor) expect(anchorExists(s.anchor), `${t.id}: âncora ${s.anchor}`).toBe(true);
    }
  });

  it("artigos que citam tour apontam para tour existente", () => {
    for (const a of ARTICLES) if (a.tourId) expect(TOURS.some((t) => t.id === a.tourId), a.id).toBe(true);
  });

  it("checklist aponta para rotas e artigos válidos", () => {
    for (const c of CHECKLIST) {
      expect(APP_ROUTES.has(c.route), c.id).toBe(true);
      if (c.articleId) expect(articleById(c.articleId), c.id).toBeTruthy();
    }
  });
});

describe("manifesto de prints", () => {
  it("todos os prints do manifesto foram capturados e existem", () => {
    const m = JSON.parse(readFileSync(join(ROOT, "docs/training/SCREENSHOT_MANIFEST.json"), "utf8"));
    expect(m.version).toBe(TRAINING_VERSION);
    for (const s of m.screenshots) {
      expect(s.validation, s.name).toBe("capturado");
      expect(existsSync(join(ROOT, "public", s.file)), s.file).toBe(true);
    }
  });
});
