import { defineConfig } from "@playwright/test";

// E2E: roda contra o build de produção local (npm run build antes) ou contra E2E_BASE_URL.
const PORT = 3300;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: external || `http://localhost:${PORT}`,
    channel: process.env.E2E_CHANNEL || "msedge",
    viewport: { width: 1366, height: 860 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: external
    ? undefined
    : { command: `node node_modules/next/dist/bin/next start -p ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
