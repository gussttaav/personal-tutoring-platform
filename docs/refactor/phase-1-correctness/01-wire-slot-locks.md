# Task P1-01 — Wire `acquireSlotLock` into `BookingService.createBooking`

**Severity:** 🔴 Critical
**Effort:** 2–3 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`SupabaseBookingRepository.acquireSlotLock` is fully implemented and tested, the SQL function exists, but `BookingService.createBooking` **never calls it**. Two concurrent bookings for the same slot will both succeed.

## Context

### The bug

Bug surface:
- `src/services/BookingService.ts:31574` — `createBooking()` runs `min-notice guard → reschedule → credit decrement → calendar event → ...` with no concurrency control
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:30602` — `acquireSlotLock()` exists
- `supabase/migrations/0001_complete_schema.sql:15286` — `acquire_slot_lock(p_start_iso, p_duration_minutes)` SQL function exists
- `src/infrastructure/supabase/__tests__/SupabaseBookingRepository.test.ts:13707` — test exists and passes

The infrastructure was built, then the wiring step was forgotten.

### Why this is critical, not theoretical

The availability cache (`PERF-10`) means two browsers see the same slot as free for up to the cache TTL. Both can POST `/api/book` in the same second. Without a lock:

1. Both pass `getAvailableSlots` (cached, identical answer)
2. Both create Calendar events (no Calendar-side conflict check)
3. Both decrement credits
4. Both insert booking rows
5. Tutor sees double-booked Calendar; second student gets no room

## Files affected

| File | Change |
|------|--------|
| `src/services/BookingService.ts` | Add `acquireSlotLock` call + `try/finally` release |
| `supabase/migrations/0005_booking_exclusion_constraint.sql` | **NEW** — belt-and-suspenders DB-level constraint |
| `src/services/__tests__/BookingService.test.ts` | New tests for the lock path |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts` | Add `acquireSlotLock` / `releaseSlotLock` (verify they're already there — see `28667`) |

## The change

### 1. `src/services/BookingService.ts`

Update the comment block at the top of the file:

```typescript
// ARCH-13: BookingService — orchestrates session booking, cancellation, and listing.
// Extracted from /api/book, /api/cancel, and /api/my-bookings route handlers so
// that route handlers become thin parsers + dispatchers with no business logic.
//
// REFACTOR-P1-01: Acquires a Postgres-backed slot lock before any side effects
// to prevent concurrent bookings for the same time slot. Replaces the previous
// approach which had no concurrency control between getAvailableSlots and insert.
```

Modify `createBooking` — wrap the existing body in a slot-lock acquire + try/finally:

```typescript
async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
  // 1. Min-notice guard
  const startsAt    = new Date(input.startIso);
  const minBookable = new Date(Date.now() + SCHEDULE.minNoticeHours * 60 * 60_000);
  if (startsAt < minBookable) throw new SlotUnavailableError();

  // 2. REFACTOR-P1-01: Acquire slot lock. Held until the booking row is committed
  //    (or compensation completes — see REFACTOR-P1-03).
  const durationMinutes = Math.round(
    (new Date(input.endIso).getTime() - new Date(input.startIso).getTime()) / 60_000
  );
  const locked = await this.bookings.acquireSlotLock(input.startIso, durationMinutes);
  if (!locked) {
    throw new SlotUnavailableError();
  }

  try {
    // ── existing body of createBooking goes here, unchanged ──
    // (reschedule → credit decrement → calendar → QStash → booking insert → session insert → emails)
    return { eventId, zoomSessionName, zoomPasscode, cancelToken, joinToken, emailFailed: !confirmSent };
  } finally {
    await this.bookings.releaseSlotLock(input.startIso).catch(err =>
      log("warn", "Slot lock release failed (will expire on TTL)", {
        service: "BookingService",
        startIso: input.startIso,
        error: String(err),
      })
    );
  }
}
```

### 2. New migration: `supabase/migrations/0005_booking_exclusion_constraint.sql`

Belt-and-suspenders. The app-level lock prevents thrashing; this constraint guarantees correctness even if the lock layer has a bug.

```sql
-- REFACTOR-P1-01: DB-level safeguard against overlapping confirmed bookings.
-- The application uses acquire_slot_lock for the happy path, but a bug in the
-- lock-acquire code path would silently re-introduce the original race.
-- This constraint rejects any insert/update that would create overlapping
-- confirmed bookings, at the cost of a slightly more expensive index.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');
```

Notes:
- Requires `btree_gist`. Supabase Postgres includes it; verify with `SELECT * FROM pg_available_extensions WHERE name = 'btree_gist';`.
- If existing data has overlapping confirmed bookings, this migration will fail. Run a check first:
  ```sql
  SELECT a.id, b.id FROM bookings a JOIN bookings b
    ON a.id < b.id
    AND a.status = 'confirmed' AND b.status = 'confirmed'
    AND tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at);
  ```
  Resolve any overlaps before applying.

### 3. Update `InMemoryBookingRepository`

Verify lines around `29799` already have `acquireSlotLock` / `releaseSlotLock`. If they do, no change. If not, add a simple `Set<string>` to track locked slots.

## Acceptance criteria

- [ ] `BookingService.createBooking` calls `acquireSlotLock` before any side effect
- [ ] On `acquireSlotLock` returning `false`, throws `SlotUnavailableError` (which maps to 409 via `mapDomainErrorToResponse`)
- [ ] `releaseSlotLock` is in a `finally` block so it runs whether `createBooking` returns or throws
- [ ] New migration applied, exclusion constraint visible in `\d bookings`
- [ ] All existing tests still pass
- [ ] New test: two concurrent `bookingService.createBooking()` for same `startIso` — exactly one resolves successfully, the other rejects with `SlotUnavailableError`

## Test plan

### Existing tests to verify still pass

```bash
pnpm test src/services/__tests__/BookingService.test.ts
pnpm test src/__tests__/integration/booking.test.ts
pnpm test src/infrastructure/supabase/__tests__/SupabaseBookingRepository.test.ts
```

### New test in `src/services/__tests__/BookingService.test.ts`

```typescript
describe("REFACTOR-P1-01: concurrent booking", () => {
  it("rejects the second concurrent booking for the same slot", async () => {
    const services = buildTestServices();
    const input = {
      email: "a@example.com", name: "A",
      startIso: "2026-06-01T10:00:00.000Z",
      endIso:   "2026-06-01T11:00:00.000Z",
      sessionType: "session1h" as const,
    };

    // Race two createBooking calls with the same slot
    const [first, second] = await Promise.allSettled([
      services.bookingService.createBooking(input),
      services.bookingService.createBooking({ ...input, email: "b@example.com" }),
    ]);

    const fulfilled = [first, second].filter(r => r.status === "fulfilled");
    const rejected  = [first, second].filter(r => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason)
      .toBeInstanceOf(SlotUnavailableError);
  });

  it("releases the slot lock when createBooking throws", async () => {
    const services = buildTestServices();
    // Force a failure inside the try block (e.g. by mocking calendar.createEvent to throw)
    // Then verify the lock is released by acquiring it again
    // ...
  });
});
```

### Manual verification

Per the phase README — two `curl` requests in parallel.

## Notes / gotchas

- The `acquire_slot_lock` SQL function uses an `INSERT ... ON CONFLICT DO NOTHING` pattern, so it's safe under concurrent calls
- The function uses TTL-based lock expiry (`make_interval(secs => p_duration_minutes * 60 + 300)`) so a crashed Node process won't permanently lock a slot
- We **do not** use Postgres advisory locks here — they're session-scoped and don't survive Vercel's connection pool recycling. The `slot_locks` table approach is intentional. (See SQL comment at migration 0001 line 15284.)

## Out of scope

- Cleaning up expired `slot_locks` rows. The `acquire_slot_lock` function does this opportunistically. If you want a sweeper cron, that's Phase 4 work.
- Replacing the `slot_locks` table with PG advisory locks for hot keys — premature optimization.
