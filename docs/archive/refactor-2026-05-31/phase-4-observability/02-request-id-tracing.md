# Task P4-02 — Request ID middleware + structured `pino` logger

**Severity:** 🟢 Low
**Effort:** 3–4 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

Two related fixes:

1. **Request IDs.** Today, two concurrent bookings produce interleaved log lines with no way to tell which belongs to which request. A middleware that assigns / propagates `x-request-id`, plus `AsyncLocalStorage` to thread it through `log()`, fixes that.
2. **`pino` migration (optional).** `console.log(JSON.stringify(entry))` works but lacks level filtering, sampling, redaction, and child loggers. `pino` is a drop-in.

The first half is non-negotiable for production debugging. The second is a quality-of-life improvement that you can defer if you want.

## Context

### The current state

```typescript
// src/lib/logger.ts:21276
export function log(level, message, context = {}): void {
  const entry = { level, message, ts: new Date().toISOString(), ...context };
  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      Sentry.captureMessage(message, { level: "error", extra: context, tags: { service: String(context.service ?? "unknown") } });
      break;
    case "warn":  console.warn(JSON.stringify(entry));  break;
    default:      console.log(JSON.stringify(entry));   break;
  }
}
```

Strengths: JSON structured, Sentry forwarding for errors, level routing.
Gaps:
- No request correlation (interleaved logs from concurrent requests are unsorted)
- No level filtering (cannot turn off `info` in prod)
- No child loggers (every call repeats `service: "..."`)
- No redaction (a developer who logs `{ user }` accidentally logs PII)

### Why request IDs first

A single booking flow under [P1-03 saga compensation](../phase-1-correctness/03-booking-saga-compensation.md) produces logs from `BookingService`, `CalendarClient`, `SupabaseSessionRepository`, `EmailClient`, plus any compensation. When two bookings race, distinguishing them in the log stream is currently impossible.

`x-request-id` is the standard solution. Vercel doesn't set one by default; we generate it in middleware and propagate via `AsyncLocalStorage`.

## Files affected

| File | Change |
|------|--------|
| `src/middleware.ts` | **NEW** — assigns `x-request-id`, stores in ALS |
| `src/lib/request-context.ts` | **NEW** — `AsyncLocalStorage` wrapper |
| `src/lib/logger.ts` | Read request ID from ALS, include in every entry |
| `src/lib/__tests__/logger.test.ts` | New tests |
| `package.json` | (Optional, second half) Add `pino` and `pino-pretty` (dev) |

## The change

### Part A — Request IDs (do this)

#### 1. `src/lib/request-context.ts` (NEW)

```typescript
/**
 * REFACTOR-P4-02: Request-scoped context via AsyncLocalStorage.
 *
 * The middleware seeds the store with a request ID. Anything called downstream
 * (services, repositories, the logger) can read it without explicit threading.
 *
 * AsyncLocalStorage is stable in Node 18+ and supported on Vercel's serverless
 * runtime. NOT supported in Edge runtime — keep this strictly server-only.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  // Add other request-scoped fields here as needed (userId, traceparent, etc.)
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}
```

#### 2. `src/middleware.ts` (NEW)

```typescript
/**
 * REFACTOR-P4-02: Request ID propagation.
 *
 * Generates an x-request-id (or honors an incoming one — e.g. from a frontend
 * client that already has a trace context) and attaches it to the response so
 * the browser network panel shows it.
 *
 * The matcher excludes static assets and image optimization endpoints.
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const res = NextResponse.next({
    request: { headers: new Headers([...req.headers.entries(), ["x-request-id", requestId]]) },
  });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};
```

Note: middleware runs in Edge runtime by default, where `AsyncLocalStorage` is NOT available. So the middleware **forwards** the request ID via header; route handlers (Node runtime) call `withRequestContext` themselves.

#### 3. Helper for route handlers — wrap each route

There's no native way to wrap every route automatically. The pragmatic approach: a tiny helper that route handlers opt into.

```typescript
// src/lib/with-request-context.ts (NEW)
import type { NextRequest } from "next/server";
import { withRequestContext } from "./request-context";

export function tracedRoute<Args extends unknown[], R>(
  handler: (req: NextRequest, ...args: Args) => Promise<R>,
) {
  return (req: NextRequest, ...args: Args): Promise<R> => {
    const requestId = req.headers.get("x-request-id") ?? "req_unknown";
    return withRequestContext({ requestId }, () => handler(req, ...args));
  };
}
```

Then in route files (one-line wrap):

```typescript
// Before
export async function POST(req: NextRequest) { /* ... */ }

// After
import { tracedRoute } from "@/lib/with-request-context";
async function postHandler(req: NextRequest) { /* ... */ }
export const POST = tracedRoute(postHandler);
```

Do this **only for routes that perform meaningful work** (book, cancel, chat, webhook, admin). Static pages don't need it.

#### 4. `src/lib/logger.ts`

```typescript
import * as Sentry from "@sentry/nextjs";
import { getRequestId } from "./request-context";

type Level = "info" | "warn" | "error";

export function log(level: Level, message: string, context: Record<string, unknown> = {}): void {
  const requestId = getRequestId();
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(requestId ? { requestId } : {}),  // REFACTOR-P4-02
    ...context,
  };

  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      Sentry.captureMessage(message, {
        level: "error",
        extra: { ...context, ...(requestId ? { requestId } : {}) },
        tags:  { service: String(context.service ?? "unknown") },
      });
      break;
    case "warn":  console.warn(JSON.stringify(entry));  break;
    default:      console.log(JSON.stringify(entry));   break;
  }
}
```

### Part B — Migrate to `pino` (optional, do later if you want)

Skip if Part A is enough for now. The full file becomes:

```typescript
// REFACTOR-P4-02 (Part B): pino-backed logger.
import pino from "pino";
import * as Sentry from "@sentry/nextjs";
import { getRequestId } from "./request-context";

const isDev = process.env.NODE_ENV !== "production";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "*.password",
      "*.secret",
      "*.token",
      "*.cookie",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev ? {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
    },
  } : {}),
});

type Level = "info" | "warn" | "error";

export function log(level: Level, message: string, context: Record<string, unknown> = {}): void {
  const requestId = getRequestId();
  const ctx = { ...context, ...(requestId ? { requestId } : {}) };

  baseLogger[level](ctx, message);

  if (level === "error") {
    Sentry.captureMessage(message, {
      level: "error",
      extra: ctx,
      tags:  { service: String(context.service ?? "unknown") },
    });
  }
}
```

Add to `package.json`:

```json
{
  "dependencies": { "pino": "^9.5.0" },
  "devDependencies": { "pino-pretty": "^11.3.0" }
}
```

## Acceptance criteria

**Part A (required):**
- [ ] `middleware.ts` exists; generates / forwards `x-request-id`
- [ ] Response headers include `x-request-id`
- [ ] `tracedRoute` helper exists and wraps at least `/api/book`, `/api/cancel`, `/api/stripe/webhook`, `/api/chat`, `/api/chat-session`, `/api/zoom/token`
- [ ] Every log line within a wrapped request includes `requestId`
- [ ] Two concurrent requests have distinct `requestId` values throughout their logs
- [ ] Sentry events include `requestId` in `extra`

**Part B (optional):**
- [ ] `pino` installed
- [ ] Logger uses `pino` under the hood
- [ ] Redact paths cover at least `password`, `secret`, `token`, `cookie`, `authorization`
- [ ] `pino-pretty` activated in dev only

## Test plan

### Unit tests

```typescript
import { withRequestContext } from "@/lib/request-context";
import { log } from "@/lib/logger";

describe("REFACTOR-P4-02: request ID in logs", () => {
  let stdout: jest.SpyInstance;

  beforeEach(() => {
    stdout = jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => stdout.mockRestore());

  it("includes requestId when called inside withRequestContext", () => {
    withRequestContext({ requestId: "req_abc" }, () => {
      log("info", "test", { service: "test" });
    });
    const payload = JSON.parse(stdout.mock.calls[0][0] as string);
    expect(payload.requestId).toBe("req_abc");
  });

  it("omits requestId when called outside any context", () => {
    log("info", "test", { service: "test" });
    const payload = JSON.parse(stdout.mock.calls[0][0] as string);
    expect(payload.requestId).toBeUndefined();
  });

  it("does not leak requestId between contexts", async () => {
    const results: (string | undefined)[] = [];

    await Promise.all([
      withRequestContext({ requestId: "req_a" }, async () => {
        await new Promise(r => setTimeout(r, 10));
        log("info", "from a");
        results.push("a");
      }),
      withRequestContext({ requestId: "req_b" }, async () => {
        log("info", "from b");
        results.push("b");
      }),
    ]);

    const payloads = stdout.mock.calls.map(c => JSON.parse(c[0] as string));
    const fromA = payloads.find(p => p.message === "from a");
    const fromB = payloads.find(p => p.message === "from b");
    expect(fromA?.requestId).toBe("req_a");
    expect(fromB?.requestId).toBe("req_b");
  });
});
```

### Manual verification

```bash
# In a terminal, watch logs
vercel dev | jq -c '{ts, requestId, message}'

# In another terminal, fire two concurrent bookings
curl -X POST http://localhost:3000/api/book -H "..." -d '{...}' &
curl -X POST http://localhost:3000/api/book -H "..." -d '{...}' &
wait

# Confirm each log line has a requestId; sort by requestId to read each request's flow:
vercel dev | jq -c 'select(.requestId == "req_abc123")'
```

## Notes / gotchas

- **Edge runtime:** `AsyncLocalStorage` is NOT available. `middleware.ts` runs in Edge and only forwards the header. Route handlers must opt into `tracedRoute` (or set runtime to nodejs).
- **`waitUntil` and other async escape hatches:** code that runs after the response is sent (background tasks) loses the ALS context. The webhook handler in P1-02 is synchronous now, so this isn't an issue there. If you reintroduce `waitUntil`, capture the requestId in a closure.
- **Compatibility with `tracedRoute`:** verify Next.js 16 type signatures for route handler functions in `[param]` routes. Adjust the helper generics if needed.
- **Redact paths in `pino`:** dot-syntax. Test in dev that PII is actually redacted.
- **Don't log `req.headers` wholesale:** even with redact, raw header dumps tend to leak.

## Out of scope

- OpenTelemetry / distributed tracing across QStash. The request ID is request-local; a QStash invocation is a separate request with a new ID. If you want end-to-end tracing, propagate the ID through the QStash payload — separate task.
- Per-user log throttling. `pino` has sampling; configure if needed.
- Switching to a hosted log aggregator (Datadog, Logtail). Vercel's log search is fine at this scale.
