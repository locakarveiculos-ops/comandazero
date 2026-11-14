import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Fase 1: links de e-mail, redefinição de senha, cadastro com aceite e páginas legais.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

test.describe("Auth · links de e-mail", () => {
  test("callback com link inválido volta para /entrar com aviso em PT", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=invalido&type=signup");
    await expect(page).toHaveURL(/\/entrar\?erro=link-invalido/);
    await expect(page.getByRole("alert").filter({ hasText: "Link vencido ou já usado" })).toBeVisible();
  });

  test("callback de recuperação inválido abre o modo recuperar", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=invalido&type=recovery");
    await expect(page).toHaveURL(/modo=recuperar/);
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });

  test("redefinir senha sem sessão pede link novo", async ({ page }) => {
    await page.goto("/redefinir-senha");
    await expect(page.getByText("Link vencido ou já usado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir novo link" })).toHaveAttribute("href", "/entrar?modo=recuperar");
  });

  test("/auth/confirmado sem login leva para /entrar", async ({ page }) => {
    await page.goto("/auth/confirmado");
    await expect(page).toHaveURL(/\/entrar/);
  });
});

test.describe("Auth · cadastro", () => {
  test("valida WhatsApp, termos e mostra força da senha", async ({ page }) => {
    await page.goto("/entrar?modo=cadastro");
    await page.getByLabel("Seu nome").fill("Teste");
    await page.getByLabel("E-mail").fill("teste@exemplo.com");
    await page.getByLabel("WhatsApp", { exact: true }).fill("1999");
    await page.getByLabel("Senha", { exact: true }).fill("abc");
    await expect(page.getByText("Força da senha: Muito curta")).toBeVisible();
    await page.getByLabel("Senha", { exact: true }).fill("Abcdef12!x");
    await expect(page.getByText("Força da senha: Forte")).toBeVisible();
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/Informe DDD \+ número/)).toBeVisible();
    await expect(page.getByText(/aceite os Termos de Uso/)).toBeVisible();
    await page.getByLabel("WhatsApp", { exact: true }).fill("19999990000");
    await expect(page.getByLabel("WhatsApp", { exact: true })).toHaveValue("(19) 99999-0000");
  });

  test("conta nova grava aceite dos Termos com versão e vai para a criação da loja", async ({ page, request }) => {
    test.skip(!env.SUPABASE_SERVICE_ROLE_KEY, "Supabase ausente");
    const email = `e2e-cadastro-${Date.now()}@comandazero.test`;
    await page.goto("/entrar?modo=cadastro");
    await page.getByLabel("Seu nome").fill("Cadastro E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("WhatsApp", { exact: true }).fill("19999990000");
    await page.getByLabel("Senha", { exact: true }).fill("SenhaForte123!");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("**/onboarding", { timeout: 15000 });

    const base = env.NEXT_PUBLIC_SUPABASE_URL;
    const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
    const users = await (await request.get(`${base}/auth/v1/admin/users?per_page=200`, { headers })).json();
    const user = (users.users as { id: string; email: string }[]).find((u) => u.email === email);
    expect(user).toBeTruthy();
    const rows = await (await request.get(`${base}/rest/v1/legal_acceptances?user_id=eq.${user!.id}&select=document,version,accepted`, { headers })).json();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ document: "termos", accepted: true }),
        expect.objectContaining({ document: "privacidade", accepted: true }),
        expect.objectContaining({ document: "marketing_whatsapp", accepted: false }),
      ]),
    );
    // Limpeza: remove o usuário de teste (aceites caem junto, on delete cascade).
    await request.delete(`${base}/auth/v1/admin/users/${user!.id}`, { headers });
  });
});

test.describe("Páginas legais", () => {
  for (const [path, title] of [
    ["/termos", "Termos de Uso"],
    ["/privacidade", "Política de Privacidade"],
  ]) {
    test(`${path} publicada com versão`, async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(/Versão \d{4}-\d{2}-\d{2}/)).toBeVisible();
    });
  }
});
