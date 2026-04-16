# Task 4.8 — Sentry Integration

**Fix ID:** `OBS-02`
**Priority:** P3
**Est. effort:** 2 hours

## Problem

Current error observability:

- Structured logs via `log()` go to stdout, visible in Vercel's log viewer
- No aggregation, no alerting, no source maps
- Impossible to answer "what's the error rate for `/api/book` over the last 24h?"
- A spike in errors goes unnoticed until a user complains

Sentry provides: error aggregation, source maps, breadcrumbs, performance traces, alerting. For a production SaaS, it's table stakes.

## Scope

**Install:**
- `@sentry/nextjs`

**Create:**
- `sentry.client.config.ts` — browser SDK config
- `sentry.server.config.ts` — server SDK config
- `sentry.edge.config.ts` — edge runtime config (minimal)
- `next.config.mjs` — wrap with Sentry's build plugin (or create a companion file)

**Modify:**
- `src/lib/logger.ts` — capture error-level logs to Sentry in addition to stdout
- `src/lib/http-errors.ts` — capture unhandled errors before returning 500
- `.gitignore` — add `.sentryclirc`
- CI workflow — upload source maps on deploy

**Do not touch:**
- Application business logic

## Approach

### Step 1 — Sentry project setup

Create a Sentry project at sentry.io. Save:

- `SENTRY_DSN` — public, can be in `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` — private, CI-only (for source map upload)
- `SENTRY_ORG`, `SENTRY_PROJECT` — for build config

### Step 2 — Run the Sentry wizard

```bash
npx @sentry/wizard@latest -i nextjs
```

This generates the three config files and updates `next.config.mjs`. Review the generated files and adjust:

```ts
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't report errors when running locally during development
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_DEV === "true",

  beforeSend(event) {
    // Redact email addresses from error messages to reduce PII exposure
    if (event.message) {
      event.message = event.message.replace(
        /[\w.+-]+@[\w-]+\.[\w.-]+/g,
        "[redacted-email]"
      );
    }
    return event;
  },

  // Ignore expected errors
  ignoreErrors: [
    /Autenticación requerida/,   // 401 responses, not real errors
    /Demasiadas peticiones/,     // 429 rate limits
    /Datos de reserva inválidos/, // 400 validation errors
  ],
});
```

```ts
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0, // Disable session replay — privacy concern
  replaysOnErrorSampleRate: 0.1,

  enabled: process.env.NODE_ENV === "production",

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
});
```

### Step 3 — Integrate with logger

Forward error-level logs to Sentry:

```ts
// src/lib/logger.ts
import * as Sentry from "@sentry/nextjs";

export function log(level: Level, message: string, context: Record<string, unknown> = {}): void {
  const entry = { level, message, ts: new Date().toISOString(), ...context };

  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      // Forward to Sentry with context
      Sentry.captureMessage(message, {
        level: "error",
        extra: context,
        tags: { service: String(context.service ?? "unknown") },
      });
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
      break;
  }
}
```

### Step 4 — Capture thrown errors in route handlers

```ts
// src/lib/http-errors.ts
import * as Sentry from "@sentry/nextjs";

export function mapDomainErrorToResponse(err: unknown, context: Record<string, unknown> = {}) {
  if (err instanceof DomainError) {
    // Expected business errors — log but don't Sentry
    return responseFor(err);
  }

  // Unexpected — capture to Sentry with full context
  Sentry.captureException(err, { extra: context });
  log("error", "Unhandled error", { ...context, error: String(err) });
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
```

### Step 5 — Source map upload in CI

The Sentry wizard adds `withSentryConfig` to `next.config.mjs`. Ensure CI has `SENTRY_AUTH_TOKEN` set; source maps upload automatically on every production build.

Verify after deploy:

- Sentry dashboard → your project → Releases
- A new release should appear with each deployment
- Source files should be attached to the release

### Step 6 — Alerts

Configure these alerts in the Sentry UI:

1. **Error rate spike** — more than 10 errors in 5 minutes → notify admin
2. **New error type** — any previously-unseen error → notify admin
3. **Payment webhook errors** — any error tagged `service: webhook` → immediate notify

### Step 7 — Privacy considerations

Sentry sees error messages and stack traces. With the `beforeSend` redaction above, email addresses are scrubbed from messages. Also:

- Don't include full request bodies in Sentry context
- Don't log payment card details (Stripe doesn't send them to us, but guard anyway)
- Review Sentry's data retention settings — default 90 days is fine; extend if legally required

## Acceptance Criteria

- [ ] Sentry SDK installed
- [ ] Three config files exist with appropriate settings
- [ ] `next.config.mjs` wrapped with Sentry build config
- [ ] PII redaction in `beforeSend` scrubs email addresses
- [ ] Expected errors (401, 429, 400 validation) are in `ignoreErrors`
- [ ] Logger forwards `error` level to Sentry
- [ ] `mapDomainErrorToResponse` captures unexpected errors
- [ ] Source maps uploaded on production build (verify in Sentry dashboard)
- [ ] Session replay enabled only on errors, with masking
- [ ] Alerts configured for error rate spike, new errors, webhook errors
- [ ] Manual test: trigger a handled error (e.g., bad checkout input) → verify it does NOT reach Sentry
- [ ] Manual test: force an unhandled error (e.g., divide-by-zero in a route) → verify it DOES reach Sentry with source map
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **11.1 Observability Stack**.

## Testing

Manual verification is the main test. Sentry has a dashboard; watch for the expected events when triggering errors in preview.

For unit testing of the logger integration:

```ts
jest.mock("@sentry/nextjs");
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

test("error logs are forwarded to Sentry", () => {
  log("error", "something failed", { service: "test", foo: "bar" });
  expect(Sentry.captureMessage).toHaveBeenCalledWith("something failed", {
    level: "error",
    extra: expect.objectContaining({ service: "test", foo: "bar" }),
    tags: { service: "test" },
  });
});
```

## Out of Scope

- Performance monitoring beyond the default sample rate
- Release health / crash-free rates
- User context attachment (requires session context in Sentry)
- Custom dashboards in the Sentry UI

## Rollback

If Sentry causes performance issues or unexpected costs, disable with `SENTRY_ENABLE=false` (add an env var gate in the config files). Removing the SDK is more involved but straightforward.
