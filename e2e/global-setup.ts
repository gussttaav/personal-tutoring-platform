/**
 * e2e/global-setup.ts
 *
 * TEST-02: Runs once before all Playwright tests.
 *
 * Three responsibilities (skipped automatically in Vercel preview mode where
 * E2E_BASE_URL is set — no local DB / calendar to manage):
 *
 *   1. Apply pending Supabase migrations to the test DB so local runs always
 *      reflect the current schema (CI gets the same guarantee from a dedicated
 *      "Apply migrations" step in e2e.yml — skipped here when CI=true).
 *
 *   2. Truncate the test DB so every run starts from an empty state.
 *
 *   3. Wipe future events from the test Google Calendar. Safe because we use
 *      a dedicated test calendar (GOOGLE_CALENDAR_ID points at a non-prod
 *      calendar in .env.e2e.local locally, and a separate GOOGLE_CALENDAR_ID
 *      secret in CI).
 *
 * Per-spec cleanup between tests lives in fixtures/cleanup.ts → resetTestState
 * (called from each booking spec's beforeEach to keep specs independent).
 *
 * Requires SUPABASE_DB_URL in .env.e2e.local (locally) — IMPORTANT: use the
 * session-mode pooler URL, not the direct URL:
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
 *
 * The direct URL (db.[ref].supabase.co) resolves to IPv6 on some regions and
 * will fail with "network is unreachable" on ISPs without IPv6 support.
 */

import { spawnSync } from "child_process";
import {
  loadMergedEnv,
  pick,
  truncateTestDb,
  clearTestCalendar,
} from "./fixtures/cleanup";

async function applyMigrations(dbUrl: string): Promise<void> {
  if (process.env.CI) return; // CI runs `supabase db push` in a dedicated step

  console.log("[e2e] Applying migrations to test database...");
  const result = spawnSync("supabase", ["db", "push", "--db-url", dbUrl], {
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    const stderr = result.stderr ?? "";
    if (result.error?.message.includes("ENOENT")) {
      throw new Error(
        "[e2e] Supabase CLI not found. Install it first:\n" +
        "  Linux:  https://supabase.com/docs/guides/cli/getting-started\n" +
        "  macOS:  brew install supabase/tap/supabase",
      );
    }
    if (stderr.includes("network is unreachable") || stderr.includes("dial error") || stderr.includes("failed to connect")) {
      throw new Error(
        "[e2e] Could not reach the test database — likely an IPv6 connectivity issue.\n" +
        "Use the session-mode pooler URL in .env.e2e.local (always IPv4):\n" +
        "  SUPABASE_DB_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres",
      );
    }
    throw new Error("[e2e] Migration step failed — see output above for details.");
  }
}

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_BASE_URL) return;

  const env   = loadMergedEnv();
  const dbUrl = pick(env, "SUPABASE_DB_URL");

  if (!dbUrl) {
    console.warn(
      "\n[e2e] Warning: SUPABASE_DB_URL not set — migrations were NOT applied to the test database.\n" +
      "Add the session-mode pooler URL to .env.e2e.local:\n" +
      "  SUPABASE_DB_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres\n",
    );
  } else {
    await applyMigrations(dbUrl);
  }

  const supabaseUrl    = pick(env, "SUPABASE_URL");
  const serviceRoleKey = pick(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceRoleKey) {
    console.log("[e2e] Truncating test database...");
    await truncateTestDb(supabaseUrl, serviceRoleKey);
  } else {
    console.warn("[e2e] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping DB truncate.");
  }

  const calendarId    = pick(env, "GOOGLE_CALENDAR_ID");
  const serviceEmail  = pick(env, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey    = pick(env, "GOOGLE_PRIVATE_KEY");
  if (calendarId && serviceEmail && privateKey) {
    console.log(`[e2e] Clearing future events from test calendar (${calendarId})...`);
    const deleted = await clearTestCalendar(calendarId, serviceEmail, privateKey);
    console.log(`[e2e] Deleted ${deleted} future event(s) from test calendar.`);
  } else {
    console.warn(
      "[e2e] GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY not all set " +
      "— skipping test calendar wipe.",
    );
  }
}
