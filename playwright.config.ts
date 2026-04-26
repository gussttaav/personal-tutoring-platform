/**
 * playwright.config.ts
 *
 * TEST-02: Playwright E2E configuration.
 *
 * Local dev — start all three before running tests:
 *   1. Create .env.e2e.local with test DB credentials (see below)
 *   2. stripe listen --forward-to localhost:3000/api/stripe/webhook
 *      (required for booking-pack and booking-single — delivers Stripe webhooks locally)
 *   3. E2E_MODE=true E2E_EMAILS=e2e-test@example.com npm run test:e2e
 *
 * .env.e2e.local (gitignored) — overrides .env.local for the webServer process:
 *   SUPABASE_URL=https://<test-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres
 *   (session-mode pooler — IPv4, supports DDL; direct URL may fail on IPv4-only ISPs)
 *
 * CI (local server mode — no E2E_BASE_URL):
 *   e2e.yml installs the Stripe CLI and runs stripe listen in the background.
 *
 * CI (Vercel preview mode — E2E_BASE_URL set):
 *   Stripe sends webhooks directly to the preview URL; no CLI needed.
 *   webServer is skipped; tests run against the external URL.
 */

import { defineConfig, devices }    from "@playwright/test";
import { existsSync, readFileSync } from "fs";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

// Load .env.e2e.local overrides so the dev server uses the test DB, not the live one.
// Only applies locally — in CI the test DB credentials come from GitHub secrets directly.
const e2eOverrides: Record<string, string> = {};
if (existsSync(".env.e2e.local")) {
  for (const line of readFileSync(".env.e2e.local", "utf-8").split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) {
      const raw = match[2].trim();
      e2eOverrides[match[1].trim()] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

const webServerEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined) webServerEnv[k] = v;
}
Object.assign(webServerEnv, e2eOverrides);

export default defineConfig({
  testDir:     "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Start the dev server automatically when running locally (no E2E_BASE_URL set).
  // In CI against a Vercel preview, the URL is provided externally.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !Object.keys(e2eOverrides).length,
        timeout: 120_000,
        env: webServerEnv,
      },
});
