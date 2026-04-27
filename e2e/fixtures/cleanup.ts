/**
 * e2e/fixtures/cleanup.ts
 *
 * Shared cleanup helpers used by e2e/global-setup.ts (once per run) and by
 * per-spec `test.beforeEach` hooks (between tests, to keep specs independent).
 *
 * Both helpers run server-side from Node — never imported by spec assertions
 * that run inside the browser context.
 */

import { existsSync, readFileSync } from "fs";
import { createClient }             from "@supabase/supabase-js";
import { google }                   from "googleapis";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) {
      const raw = match[2].trim();
      result[match[1].trim()] = raw.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

/**
 * Merge env files in the same precedence order Next.js applies at runtime:
 *   .env.e2e.local (test overrides) > .env.local (local secrets) > .env
 * Each later file wins. process.env is consulted only as a fallback so a
 * developer's shell-exported value can't accidentally override the test
 * config; CI populates everything via workflow `env:` blocks → process.env
 * (no .env files present), which still works because pick() falls through.
 */
export function loadMergedEnv(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const file of [".env", ".env.local", ".env.e2e.local"]) {
    Object.assign(merged, loadEnvFile(file));
  }
  return merged;
}

export function pick(env: Record<string, string>, key: string): string | undefined {
  return env[key] || process.env[key];
}

/**
 * Deletes every row from the persistent test-DB tables. Order matters because
 * of FK chains: session_messages → zoom_sessions → bookings → users
 * (and credit_packs/payments/audit_log → users).
 */
export async function truncateTestDb(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Each entry pairs a table with a "match-everything" filter on its PK,
  // since the Supabase client requires a WHERE clause on delete().
  const tables: Array<[string, (q: ReturnType<typeof supabase.from>) => unknown]> = [
    ["session_messages", (q) => q.delete().gt("id", 0)],
    ["zoom_sessions",    (q) => q.delete().not("id", "is", null)],
    ["bookings",         (q) => q.delete().not("id", "is", null)],
    ["credit_packs",     (q) => q.delete().not("id", "is", null)],
    ["payments",         (q) => q.delete().not("id", "is", null)],
    ["audit_log",        (q) => q.delete().not("id", "is", null)],
    ["users",            (q) => q.delete().not("id", "is", null)],
    ["failed_bookings",  (q) => q.delete().neq("stripe_session_id", "")],
    ["webhook_events",   (q) => q.delete().neq("idempotency_key", "")],
    ["slot_locks",       (q) => q.delete().neq("start_iso", "")],
  ];

  for (const [table, run] of tables) {
    const { error } = (await run(supabase.from(table))) as { error: { message: string } | null };
    if (error) {
      throw new Error(`[e2e] Failed to truncate ${table}: ${error.message}`);
    }
  }
}

/**
 * Deletes every future event from the configured Google Calendar. Safe only
 * because we use a dedicated test calendar (see GOOGLE_CALENDAR_ID in
 * .env.e2e.local locally and the GitHub secret in CI).
 */
export async function clearTestCalendar(
  calendarId: string,
  serviceAccountEmail: string,
  privateKey: string,
): Promise<number> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key:  privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date().toISOString();
  let pageToken: string | undefined;
  let deleted = 0;

  do {
    const { data } = await calendar.events.list({
      calendarId,
      timeMin,
      singleEvents: true,
      maxResults:   2500,
      pageToken,
    });

    for (const event of data.items ?? []) {
      if (!event.id) continue;
      try {
        await calendar.events.delete({ calendarId, eventId: event.id, sendUpdates: "none" });
        deleted++;
      } catch {
        // Tolerate 404/410 — event may have been removed concurrently.
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return deleted;
}

/**
 * Convenience wrapper for `test.beforeEach` — wipes DB rows and future
 * calendar events using config from the merged env files. Silent no-op if
 * the test environment doesn't have the required config (we surface a clear
 * error from global-setup at run start).
 */
export async function resetTestState(): Promise<void> {
  const env = loadMergedEnv();

  const supabaseUrl    = pick(env, "SUPABASE_URL");
  const serviceRoleKey = pick(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceRoleKey) {
    await truncateTestDb(supabaseUrl, serviceRoleKey);
  }

  const calendarId    = pick(env, "GOOGLE_CALENDAR_ID");
  const serviceEmail  = pick(env, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey    = pick(env, "GOOGLE_PRIVATE_KEY");
  if (calendarId && serviceEmail && privateKey) {
    await clearTestCalendar(calendarId, serviceEmail, privateKey);
  }
}
