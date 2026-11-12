# P2-03 — Session-cleanup sweep moves into `BookingService`

**Tag:** `REFACTOR-R5-P2-03` · **Severity:** 🟢 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

`GET /api/internal/session-cleanup` imports `supabaseBookingRepository` directly, and runs the whole
sweep in the route: list due rows, finalize each, delete the row, count attempts and record
failures. That's the shape `REFACTOR-R4-P3-01` removed from the reconcile cron. Move the loop into
`BookingService.sweepPendingTerminations()`, through the `IBookingRepository` methods that already
exist (and already have in-memory fakes). The route keeps the `CRON_SECRET` check, logs and answers.
The response stays `{ cleared, failed, examined }` and the status codes stay the same.

## Context

- `src/app/api/internal/session-cleanup/route.ts:14-15`: imports `supabaseBookingRepository` and `bookingService`.
- `:20-21`: `MAX_BATCH = 50`, `MAX_ATTEMPTS = 5`.
- `:28-35`: `listDuePendingTerminations`, 500 on query failure.
- `:37-53`: per-row `finalizePastSession` → `deletePendingTermination`; on error `recordPendingTerminationFailure(eventId, attempts + 1, error)`.
- `src/domain/repositories/IBookingRepository.ts:223-252`: all four pending-termination methods are on the interface.
- `src/__tests__/fixtures/InMemoryBookingRepository.ts:368-412`: in-memory versions.
- `src/services/BookingService.ts:587-598`: `finalizePastSession` (marks completed / no-show, deletes the Zoom session).
- `src/app/api/internal/session-cleanup/__tests__/route.test.ts`: covers only the auth (`CRON-AUTH-01`).

## Files affected

| File | Change |
|------|--------|
| `src/services/BookingService.ts` | New `sweepPendingTerminations({ maxBatch, maxAttempts })` → `{ cleared, failed, examined }` |
| `src/app/api/internal/session-cleanup/route.ts` | Auth → `bookingService.sweepPendingTerminations` → log + JSON; no `@/infrastructure` import |
| `src/services/__tests__/BookingService.test.ts` | Sweep: mixed success/failure, attempt counting |
| `src/app/api/internal/session-cleanup/__tests__/route.test.ts` | Mock the service method; 200 body + 500 on rejection |

## The change

```ts
// src/services/BookingService.ts
// REFACTOR-R5-P2-03: the session-cleanup cron's sweep (was in its route). A listing error
// propagates (the route answers 500); a per-row error is recorded and counted, never thrown.
async sweepPendingTerminations(opts: { maxBatch: number; maxAttempts: number }): Promise<{
  cleared: number; failed: number; examined: number;
}> {
  const rows = await this.bookings.listDuePendingTerminations(opts.maxBatch, opts.maxAttempts);
  let cleared = 0, failed = 0;
  for (const row of rows) {
    try {
      await this.finalizePastSession(row.eventId);
      await this.bookings.deletePendingTermination(row.eventId);
      cleared++;
    } catch (err) {
      await this.bookings.recordPendingTerminationFailure(row.eventId, row.attempts + 1, String(err));
      failed++;
      log("warn", "Cron: failed to terminate session", { eventId: row.eventId, error: String(err) });
    }
  }
  return { cleared, failed, examined: rows.length };
}
```

The route's `try` around the call maps a rejection to the existing `log("error", "Cron:
pending_terminations query failed", …)` + 500, and a success to the existing info log + JSON.
`MAX_BATCH` / `MAX_ATTEMPTS` stay as constants in the route (cron configuration) and are passed in.

## Acceptance criteria

- [x] The route imports nothing from `@/infrastructure`
- [x] Same JSON and status codes: 403 without/with a wrong secret, 500 when listing fails, 200 `{ cleared, failed, examined }`
- [x] A row whose finalize throws → `recordPendingTerminationFailure(eventId, attempts + 1, msg)`, counted in `failed`, other rows still processed
- [x] File-top blocks carry `REFACTOR-R5-P2-03`

## Test plan

- **Existing:** `route.test.ts` (auth cases), `InMemoryBookingRepository.test.ts` (`listDuePendingTerminations`).
- **New (service):** in-memory repo with three due rows, the second's `finalizePastSession` failing → `{ cleared: 2, failed: 1, examined: 3 }`, the failing row's attempts incremented, the others deleted.
- **New (route):** service resolves → 200 body passthrough; rejects → 500.
- **Manual (optional):** `curl -H "Authorization: Bearer $CRON_SECRET" localhost:<port>/api/internal/session-cleanup` on `pnpm dev` → same JSON as before.

## Notes / gotchas

- `recordPendingTerminationFailure` can itself throw (DB down). Today that escapes the route's loop
  and 500s the whole run. Keep the behaviour identical (let it propagate). Changing it is a separate decision.
- cron-job.org's URL and header are unchanged. Nothing for Gustavo to update.

## Out of scope

- Batch size / attempt-limit tuning.
- Alerting on rows that hit `maxAttempts`.
