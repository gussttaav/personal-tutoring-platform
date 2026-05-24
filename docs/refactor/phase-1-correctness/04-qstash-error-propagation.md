# Task P1-04 — QStash: propagate errors, add fallback row

**Severity:** 🟠 High
**Effort:** 2–3 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`SchedulerClient.scheduleAt` silently swallows QStash errors with `.catch(log)`. If QStash is down during a booking, the Zoom session is never scheduled for termination — JWTs for that session remain mintable indefinitely. The booking succeeds; the cleanup is silently lost.

## Context

### The current code

```typescript
// src/infrastructure/qstash/SchedulerClient.ts:3856
export class SchedulerClient implements IScheduler {
  async scheduleAt(params: ScheduleParams): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return;

    await qstash.publishJSON({
      url:   params.url,
      body:  params.body,
      delay: params.delaySeconds,
    }).catch((err: unknown) => {
      log("error", "QStash schedule failed", { url: params.url, error: String(err) });
    });
  }
}
```

The `.catch` makes the promise resolve. Callers think scheduling succeeded.

### Why it's high (not critical)

- An expired JWT cannot be issued for a non-existent session, so the *normal* path is safe.
- The risk is: session record stays in DB indefinitely, so during the period after class-end-time, the **legitimate** student/tutor can still get tokens for it. This is mainly a hygiene issue.
- The error reaches Sentry via `log("error", ...)` so you'd notice the outage — but not on a per-booking basis.

### Why fix it anyway

- Hygiene matters: orphaned `zoom_sessions` rows accumulate, affecting analytics and "did this session happen?" queries.
- A `pending_terminations` table makes the system **self-healing** even during a QStash outage.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/qstash/SchedulerClient.ts` | Let errors propagate; add retry param |
| `src/services/BookingService.ts` | Handle the throw — write to `pending_terminations`, don't fail the booking |
| `src/domain/repositories/IBookingRepository.ts` | Add `recordPendingTermination` |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | Implement it |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts` | Implement it |
| `supabase/migrations/0006_pending_terminations.sql` | **NEW** — table + cleanup function |
| `src/app/api/internal/zoom-terminate-fallback/route.ts` | **NEW** — cron handler |
| `vercel.json` (or wherever cron config lives) | Register the cron |

## The change

### 1. `src/infrastructure/qstash/SchedulerClient.ts`

```typescript
// ARCH-13: Thin wrapper around QStash so BookingService can depend on an
// interface rather than a concrete module — enables testing with mocks.
//
// REFACTOR-P1-04: Errors are now propagated so the caller can record a fallback
// row. Adds explicit retries inside QStash itself for transient flakiness.
//
// Skips scheduling when running locally (QStash cannot reach loopback addresses).

import { qstash } from "./client";
import type { IScheduler, ScheduleParams } from "./IScheduler";

export class SchedulerClient implements IScheduler {
  async scheduleAt(params: ScheduleParams): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return;

    await qstash.publishJSON({
      url:     params.url,
      body:    params.body,
      delay:   params.delaySeconds,
      retries: 3,  // REFACTOR-P1-04: QStash retries the delivery on the receiver side
    });
    // No .catch — let it throw. BookingService handles the fallback path.
  }
}
```

### 2. New migration: `supabase/migrations/0006_pending_terminations.sql`

```sql
-- REFACTOR-P1-04: Fallback queue for Zoom session terminations when QStash
-- scheduling fails at booking time. A daily cron sweeps any rows whose
-- fire_at has passed and calls the terminate handler directly.

CREATE TABLE pending_terminations (
  event_id    TEXT        PRIMARY KEY,
  fire_at     TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_terminations_fire_at
  ON pending_terminations (fire_at)
  WHERE attempts < 5;

ALTER TABLE pending_terminations ENABLE ROW LEVEL SECURITY;
```

### 3. `src/domain/repositories/IBookingRepository.ts`

Add to the interface:

```typescript
// REFACTOR-P1-04: Records an eventId whose QStash termination scheduling
// failed, so a fallback cron can call /api/internal/zoom-terminate manually.
recordPendingTermination(eventId: string, fireAtMs: number): Promise<void>;
```

### 4. `src/infrastructure/supabase/SupabaseBookingRepository.ts`

```typescript
async recordPendingTermination(eventId: string, fireAtMs: number): Promise<void> {
  const { error } = await supabase.from("pending_terminations").upsert({
    event_id: eventId,
    fire_at:  new Date(fireAtMs).toISOString(),
  }, { onConflict: "event_id" });
  if (error) throw error;
}
```

### 5. `src/__tests__/fixtures/InMemoryBookingRepository.ts`

Add a `Map<string, number>` field and the method that writes to it.

### 6. `src/services/BookingService.ts`

In the QStash block (step 8 of `createBooking`):

```typescript
// 8. QStash schedule — fallback to DB row on failure so a cron can pick it up
try {
  await this.scheduler.scheduleAt({
    url:          `${baseUrl}/api/internal/zoom-terminate`,
    body:         { eventId: calResult.eventId },
    delaySeconds,
  });
} catch (err) {
  log("error", "QStash schedule failed — recording for fallback cron", {
    service: "BookingService",
    eventId: calResult.eventId,
    error:   String(err),
  });
  // Do NOT fail the booking — the daily cron will catch this.
  await this.bookings.recordPendingTermination(calResult.eventId, fireAtMs).catch(kvErr =>
    log("error", "Fallback pending_terminations write also failed (manual cleanup needed)", {
      service: "BookingService",
      eventId: calResult.eventId,
      error:   String(kvErr),
    })
  );
}
```

### 7. `src/app/api/internal/zoom-terminate-fallback/route.ts` (NEW)

```typescript
/**
 * GET /api/internal/zoom-terminate-fallback
 *
 * REFACTOR-P1-04: Daily Vercel cron that sweeps pending_terminations whose
 * fire_at has passed and calls the terminate logic directly (no QStash).
 *
 * Authentication: requires CRON_SECRET in the Authorization header.
 * Vercel automatically sets this for scheduled invocations of `/api/cron/*`
 * paths configured in vercel.json.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/infrastructure/supabase/client";
import { sessionService } from "@/services";
import { log } from "@/lib/logger";

const MAX_BATCH = 50;
const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("pending_terminations")
    .select("event_id, attempts")
    .lt("fire_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("fire_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    log("error", "Cron: pending_terminations query failed", { error: String(error) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let cleared = 0, failed = 0;
  for (const row of rows ?? []) {
    try {
      await sessionService.terminateSession(row.event_id);
      await supabase.from("pending_terminations").delete().eq("event_id", row.event_id);
      cleared++;
    } catch (err) {
      await supabase.from("pending_terminations")
        .update({ attempts: row.attempts + 1, last_error: String(err) })
        .eq("event_id", row.event_id);
      failed++;
      log("warn", "Cron: failed to terminate session", { eventId: row.event_id, error: String(err) });
    }
  }

  log("info", "Cron: pending_terminations sweep complete", { cleared, failed, examined: rows?.length ?? 0 });
  return NextResponse.json({ cleared, failed, examined: rows?.length ?? 0 });
}
```

### 8. `vercel.json` — register the cron

```json
{
  "crons": [
    {
      "path": "/api/internal/zoom-terminate-fallback",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Daily at 03:00 UTC. Adjust to off-peak.

### 9. Add `CRON_SECRET` to `startup-checks.ts`

```typescript
// In REQUIRED_ENV_VARS, add:
"CRON_SECRET",
```

Generate with `openssl rand -hex 32` and set in Vercel project settings.

## Acceptance criteria

- [ ] `SchedulerClient.scheduleAt` no longer catches errors
- [ ] `BookingService.createBooking` catches QStash failures and writes to `pending_terminations` — booking still succeeds
- [ ] If both QStash AND `pending_terminations` write fail, the booking still succeeds and an error is logged (this is the "manual intervention" case)
- [ ] New migration applied; table visible in DB
- [ ] Cron endpoint returns 403 without correct `CRON_SECRET`
- [ ] Cron endpoint successfully clears pending entries when run manually with the secret
- [ ] `vercel.json` cron registered
- [ ] `CRON_SECRET` added to `startup-checks.ts` and Vercel env

## Test plan

### New tests in `src/services/__tests__/BookingService.test.ts`

```typescript
describe("REFACTOR-P1-04: QStash fallback", () => {
  it("succeeds the booking even when QStash scheduling throws", async () => {
    const services = buildTestServices();
    jest.spyOn(services.scheduler, "scheduleAt").mockRejectedValueOnce(new Error("QStash 500"));

    const result = await services.bookingService.createBooking({ /* ... */ });
    expect(result.eventId).toBeDefined();

    const recorded = (services.bookingRepo as InMemoryBookingRepository).getPendingTerminations();
    expect(recorded.has(result.eventId)).toBe(true);
  });

  it("succeeds the booking even when BOTH QStash AND fallback write fail", async () => {
    const services = buildTestServices();
    jest.spyOn(services.scheduler, "scheduleAt").mockRejectedValueOnce(new Error("QStash 500"));
    jest.spyOn(services.bookingRepo, "recordPendingTermination").mockRejectedValueOnce(new Error("DB down"));

    const result = await services.bookingService.createBooking({ /* ... */ });
    expect(result.eventId).toBeDefined();
    // Error is in Sentry; manual cleanup needed; booking is fine
  });
});
```

### Manual verification of the cron

```bash
# Insert a fake row
psql $SUPABASE_URL -c "INSERT INTO pending_terminations (event_id, fire_at) VALUES ('test-event-123', now() - interval '1 day');"

# Call the cron
curl -H "Authorization: Bearer $CRON_SECRET" https://gustavoai.dev/api/internal/zoom-terminate-fallback
# Expect: {"cleared": 1, "failed": 0, "examined": 1}

# Verify row is gone
psql $SUPABASE_URL -c "SELECT * FROM pending_terminations WHERE event_id = 'test-event-123';"
# Expect: 0 rows
```

## Notes / gotchas

- **Vercel cron auth:** Vercel automatically adds `Authorization: Bearer ${CRON_SECRET}` for crons defined in `vercel.json`. Verify your Vercel project is on a tier that supports crons (Pro+).
- **Hobby tier doesn't have crons.** If you're on Hobby, use an external scheduler (cron-job.org, EasyCron) to hit the endpoint with the secret in the header.
- **MAX_ATTEMPTS = 5** is a safety net so a permanently-broken termination doesn't loop forever. After 5 failures the row is left for manual review (you can write an admin page to surface these).
- **Cron timing:** 03:00 UTC = 04:00 Madrid in winter, 05:00 in summer. Both are off-peak for a Spanish tutor.

## Out of scope

- Surfacing `pending_terminations` rows with `attempts >= 5` in the admin UI. Add later if it becomes recurring.
- Replacing QStash with a self-hosted alternative — over-engineering for this scale.
