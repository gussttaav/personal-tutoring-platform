/**
 * lib/logger.ts — structured JSON logger
 *
 * OBS-01: Replaces scattered console.info/warn/error calls with a single
 * log() function that emits structured JSON on every line. On Vercel, each
 * log line is indexed and searchable by field — so filtering by service,
 * email, or stripeSessionId in the Vercel dashboard becomes straightforward.
 *
 * OBS-02: Error-level logs are additionally forwarded to Sentry so that
 * spikes are visible in the Sentry dashboard and trigger configured alerts.
 *
 * Output format (one JSON object per line):
 *   {"level":"info","service":"kv","message":"Credits updated","email":"...","ts":"..."}
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log("info",  "Credits updated",   { service: "kv", email, credits });
 *   log("warn",  "Email attempt failed", { service: "book", attempt, error: err.message });
 *   log("error", "Calendar creation failed", { service: "webhook", stripeSessionId });
 *
 * In development the output is still valid JSON, but you can pipe through
 * `| jq .` for readable formatting:
 *   pnpm dev 2>&1 | jq .
 */

import * as Sentry from "@sentry/nextjs";

type Level = "info" | "warn" | "error";

/**
 * Emits a single structured log line to stdout/stderr.
 *
 * @param level    Severity: "info" | "warn" | "error"
 * @param message  Human-readable description of the event
 * @param context  Arbitrary key-value pairs merged into the log object.
 *                 Keep values JSON-serialisable (string, number, boolean).
 *                 Avoid logging PII beyond what is already in your logs
 *                 (email addresses are acceptable; full names or payment
 *                 details are not).
 */
export function log(
  level: Level,
  message: string,
  context: Record<string, unknown> = {}
): void {
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...context,
  };

  // Use the native console method matching the level so Vercel's log
  // viewer correctly colour-codes and categorises each line.
  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      // OBS-02: Forward errors to Sentry for aggregation and alerting
      Sentry.captureMessage(message, {
        level: "error",
        extra: context,
        tags: { service: String(context.service ?? "unknown") },
      });
      break;
    case "warn":  console.warn(JSON.stringify(entry));  break;
    default:      console.log(JSON.stringify(entry));   break;
  }
}
