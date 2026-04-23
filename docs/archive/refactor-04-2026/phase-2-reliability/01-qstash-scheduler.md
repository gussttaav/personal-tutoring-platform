# Task 2.1 — Replace `setTimeout` with QStash

**Fix ID:** `REL-01`
**Priority:** P1 — High
**Est. effort:** 3–4 hours

## Problem

The Stripe webhook uses `setTimeout` inside an async IIFE to schedule Zoom session cleanup after the session ends:

```ts
// src/app/api/stripe/webhook/route.ts
void (async () => {
  await new Promise(r => setTimeout(r, delayMs));
  await fetch(`${BASE_URL}/api/zoom/end`, { ... });
})();
```

On Vercel's serverless runtime, function instances are terminated shortly after the response is returned. A `setTimeout` of 70 minutes (1h session + 10min grace) **will not fire** — the function instance is long dead by then. This code is effectively a no-op in production.

The TODO comment in the file acknowledges this:
> TODO: replace with Upstash QStash for production reliability — setTimeout inside a serverless function may not fire if the process is recycled before the timer elapses.

This task does that.

## Scope

**Install:**
- `@upstash/qstash` npm package

**Create:**
- `src/lib/qstash.ts` — singleton client
- `src/app/api/internal/zoom-terminate/route.ts` — QStash delivery endpoint (protected by QStash signature verification)

**Modify:**
- `src/app/api/stripe/webhook/route.ts` — replace `setTimeout` with QStash scheduling
- `src/app/api/book/route.ts` — add QStash scheduling for free/pack sessions (which currently have no cleanup at all)
- `src/lib/startup-checks.ts` — require new env vars

**Remove (eventually):**
- `src/app/api/zoom/end/route.ts` — can be deleted after QStash is live, since its only caller is being replaced. For safety, keep it for one deploy cycle and delete in a follow-up PR.

## Approach

### Step 1 — QStash client

```ts
// src/lib/qstash.ts
/**
 * REL-01 — QStash singleton for reliable delayed task scheduling.
 *
 * Replaces setTimeout in serverless handlers, which does not fire reliably
 * because function instances are recycled before the timer elapses.
 */
import { Client } from "@upstash/qstash";

function createQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  return new Client({ token });
}

export const qstash = createQStashClient();
```

### Step 2 — QStash delivery endpoint

QStash calls this endpoint after the configured delay. Signature verification ensures only QStash can trigger cleanup.

```ts
// src/app/api/internal/zoom-terminate/route.ts
/**
 * REL-01 — QStash-delivered Zoom session cleanup.
 *
 * Protected by QStash signature verification (not the old INTERNAL_SECRET
 * header, because QStash signs every delivery with its own key).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@upstash/qstash/nextjs";
import { kv } from "@/lib/redis";
import type { ZoomSessionRecord } from "@/lib/zoom";
import { log } from "@/lib/logger";

async function handler(req: NextRequest) {
  let eventId: string;
  try {
    const body = await req.json() as { eventId?: unknown };
    if (typeof body.eventId !== "string" || !body.eventId) throw new Error();
    eventId = body.eventId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const record = await kv.get<ZoomSessionRecord>(`zoom:session:${eventId}`);
  if (!record) {
    return NextResponse.json({ ok: true, note: "already expired" });
  }

  await kv.del(`zoom:session:${eventId}`);
  log("info", "Zoom session terminated via QStash", {
    service: "zoom-terminate", eventId, sessionName: record.sessionName,
  });

  return NextResponse.json({ ok: true });
}

export const POST = verifySignature(handler);
```

### Step 3 — Schedule from webhook

Replace the `setTimeout` IIFE:

```ts
// Before:
const delayMs = getSessionDurationWithGrace(sessionType) * 60 * 1_000;
void (async () => {
  await new Promise(r => setTimeout(r, delayMs));
  await fetch(`${BASE_URL}/api/zoom/end`, { ... });
})();

// After:
const delaySeconds = getSessionDurationWithGrace(sessionType) * 60;
await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/internal/zoom-terminate`,
  body: { eventId },
  delay: delaySeconds,
}).catch((err: unknown) => {
  // Do not fail the webhook if QStash is down — the Zoom JWT TTL (1h)
  // still prevents indefinite session use. Log and continue.
  log("error", "QStash schedule failed", {
    service: "webhook", eventId, error: String(err),
  });
});
```

### Step 4 — Also schedule from `/api/book`

Currently `/api/book` creates calendar events but never schedules cleanup — only the webhook does. This is a pre-existing gap that this task closes. Add the same QStash call in `/api/book` after `createCalendarEvent` succeeds.

### Step 5 — Add env vars

```ts
// src/lib/startup-checks.ts — add to REQUIRED_ENV_VARS
"QSTASH_TOKEN",
"QSTASH_CURRENT_SIGNING_KEY",
"QSTASH_NEXT_SIGNING_KEY",
```

## Acceptance Criteria

- [ ] `@upstash/qstash` appears in `package.json` dependencies
- [ ] `src/lib/qstash.ts` exists with the singleton pattern matching `stripe.ts`
- [ ] `src/app/api/internal/zoom-terminate/route.ts` exists with QStash signature verification
- [ ] The signature verification is enforced — a request without a valid signature returns 401
- [ ] Webhook handler uses `qstash.publishJSON()` instead of `setTimeout`
- [ ] `/api/book` route also schedules cleanup via QStash
- [ ] `/api/zoom/end` is kept for this PR (delete in a follow-up)
- [ ] `/api/internal/zoom-terminate` does NOT require `X-Internal-Secret` (QStash signature replaces it)
- [ ] Env vars added to `startup-checks.ts`
- [ ] QStash scheduling failures are logged but do NOT fail the webhook (catch + log)
- [ ] Manual test in preview: book a session → check Upstash QStash dashboard → verify a scheduled message exists
- [ ] Manual test: schedule a short-delay message (e.g., 60s) → wait → verify the session record is deleted from Redis
- [ ] Fix-ID comments added
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **7.1 Replace setTimeout with QStash** and **9.4 Zoom Session Cleanup Reliability**.

QStash Next.js docs: search "upstash qstash nextjs" — the `@upstash/qstash/nextjs` module exports `verifySignature` that wraps the handler.

## Testing

Manual verification is sufficient for this task. Automated testing of QStash delivery requires either mocking QStash (brittle) or running against a real QStash instance (costs messages). Add unit tests only for the handler logic itself, using a mock `Request` that skips signature verification in test mode.

## Out of Scope

- Migrating other `setTimeout` calls in client components (those are fine — they run in the browser)
- Setting up dead-letter queues in QStash (task 2.3 covers this)
- Building an admin UI for scheduled tasks

## Rollback

If QStash breaks, the impact is that Zoom session records linger in Redis until their natural TTL (durationWithGrace + 24h) expires them. Since the Zoom JWT itself has a 1-hour TTL, no security issue arises — just a slightly delayed cleanup. Safe to revert.

To revert:
1. Remove the `qstash.publishJSON` calls
2. Keep `/api/zoom/end` with its `X-Internal-Secret` check
3. Leave `/api/internal/zoom-terminate` in place (it will receive no calls)
