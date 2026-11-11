# P1-03 — One free call per user, enforced by the database

**Tag:** `REFACTOR-R5-P1-03` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

The one-free-call cap (`REFACTOR-R4-P1-01`, policy confirmed by Gustavo on 2026-10-01) is a
read then a write: `hasActiveFreeSession` counts the user's non-cancelled `free15min` rows, and
the insert happens several awaits later. The slot lock is per slot, so two near-simultaneous
requests for **different** slots both pass the read and both book. There are now two ways in (the
booking wizard and the chat assistant's confirmation card), plus the mobile app. Back the rule with
a partial unique index, and map its violation to the existing `FreeSessionAlreadyUsedError`. The
service check stays as the cheap fast path that answers before any calendar work.

## Context

- `src/services/BookingService.ts:204-207`: the check, before the slot lock (`:213`).
- `src/services/BookingService.ts:321-357`: calendar event created → compensation pushed → `bookings.createBooking` insert. A unique violation here throws, and the saga deletes the calendar event.
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:425-446`: `hasActiveFreeSession`, `.neq("status", "cancelled")`. The index's predicate must match it exactly.
- `src/infrastructure/supabase/SupabaseBookingRepository.ts` `createBooking` (`:50-75`): `if (error) throw error;`. The raw PostgREST error reaches `mapDomainErrorToResponse` as a non-domain error → 500.
- `supabase/migrations/0001_complete_schema.sql:57-58`: `status IN ('confirmed','cancelled','completed','no_show')`.
- `supabase/migrations/0005_booking_exclusion_constraint.sql`: the precedent for a DB-level backstop behind an app-level check.
- A reschedule of a free call: the claim (`consumeCancelToken`) flips the original to `cancelled` **before** the new insert, so the index admits the new row. The compensation order (cancel new → reinstate original) also never holds two non-cancelled rows at once.

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0029_free_call_unique.sql` (new) | Pre-check + partial unique index |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `createBooking`: 23505 on `bookings_one_free_call_per_user` → `FreeSessionAlreadyUsedError` |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `reinstateBooking`: the same mapping (a reinstate could hit it if the user booked another free call meanwhile) → returns `false` |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts` | Emulate the constraint in `createBooking` (`:50`) and `reinstateBooking` (`:131`) |
| `src/services/__tests__/BookingService.test.ts` | Repo throws `FreeSessionAlreadyUsedError` on insert → calendar event compensated, error propagates |
| `src/__tests__/integration/booking.test.ts` | Two concurrent free-call bookings → one wins |
| `src/infrastructure/supabase/__tests__/SupabaseBookingRepository.test.ts` | DB-gated: second insert → `FreeSessionAlreadyUsedError` |

## The change

```sql
-- 0029_free_call_unique.sql
-- REFACTOR-R5-P1-03: at most one non-cancelled free15min booking per user — the DB
-- backstop behind BookingService's hasActiveFreeSession check (REFACTOR-R4-P1-01).
-- Predicate = hasActiveFreeSession's: confirmed, completed and no_show all count;
-- cancelling frees the allowance again (Gustavo, 2026-10-01).

DO $$
DECLARE v_dupes INT;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT user_id FROM bookings
    WHERE session_type = 'free15min' AND status <> 'cancelled'
    GROUP BY user_id HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION '0029: % user(s) hold more than one non-cancelled free15min booking; resolve them first (see docs/refactor/phase-1-correctness/03-free-call-unique-index.md)', v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX bookings_one_free_call_per_user
  ON bookings (user_id)
  WHERE session_type = 'free15min' AND status <> 'cancelled';
```

Pre-check to run by hand on production before pushing (read-only):

```sql
SELECT u.email, b.id, b.status, b.starts_at
FROM bookings b JOIN users u ON u.id = b.user_id
WHERE b.session_type = 'free15min' AND b.status <> 'cancelled'
  AND b.user_id IN (
    SELECT user_id FROM bookings
    WHERE session_type = 'free15min' AND status <> 'cancelled'
    GROUP BY user_id HAVING COUNT(*) > 1)
ORDER BY u.email, b.starts_at;
```

Repository mapping:

```ts
// REFACTOR-R5-P1-03: the DB backstop of the one-free-call cap. Two concurrent requests
// both pass hasActiveFreeSession; the second insert lands here.
const FREE_CALL_INDEX = "bookings_one_free_call_per_user";

if (error) {
  if (error.code === "23505" && error.message.includes(FREE_CALL_INDEX)) {
    throw new FreeSessionAlreadyUsedError();
  }
  throw error;
}
```

PostgREST puts the constraint/index name in `message` (`duplicate key value violates unique
constraint "bookings_one_free_call_per_user"`). Check `details` too if `message` turns out not to
carry it on the project's PostgREST version.

## Acceptance criteria

- [ ] `0029` on the test DB; a second non-cancelled `free15min` insert for the same user fails with 23505 on `bookings_one_free_call_per_user`
- [ ] `createBooking` (service) with that insert failing → `FreeSessionAlreadyUsedError` (409), calendar event deleted by the compensation, slot lock released
- [ ] Two concurrent `createBooking(free15min)` calls for one user, different slots (in-memory) → exactly one resolves
- [ ] A free-call reschedule still succeeds; a failed free-call reschedule still reinstates the original
- [ ] The migration aborts with the explanatory message when duplicates exist (verify once against a scratch row pair on the test DB, then delete them)
- [ ] File-top blocks carry `REFACTOR-R5-P1-03`; the migration header names it

## Test plan

- **Existing:** `BookingService.test.ts` free-call cap tests, `booking.test.ts`, `reschedule.test.ts`, `InMemoryBookingRepository.test.ts`.
- **New (service):** mock repo `createBooking` rejects `FreeSessionAlreadyUsedError` → `calendar.deleteEvent` called; error is the domain error.
- **New (integration):** `Promise.all` of two free-call bookings for one email (different slots) with the in-memory repo enforcing uniqueness → one fulfilled, one rejected `FreeSessionAlreadyUsedError`; the fake calendar holds one event.
- **New (DB-gated):** insert, then a second insert → rejects `FreeSessionAlreadyUsedError`; cancel the first → the second insert succeeds.

## Notes / gotchas

- **`supabase db push` hits production.** Apply to the test DB with `--project-ref`. Gustavo runs the
  production step after the pre-check. It's listed in STATUS.md → *Production steps*.
- **The test DB may hold duplicates from older e2e runs.** Run the pre-check there first. Deleting
  test rows is fine; production rows are Gustavo's call (PLAN → Decisions).
- **`reinstateBooking` can now fail on the index**, not only on the exclusion constraint. It already
  returns `false` → the compensation logs "manual intervention". Map both errors to `false`, so the
  log stays the same.
- **Non-concurrent index creation.** `CREATE UNIQUE INDEX` takes a lock that blocks writes to `bookings`
  for the build, which is milliseconds at this table size. `CONCURRENTLY` can't run inside the
  migration's transaction, so don't use it.
- The in-memory fixture must enforce the rule, or the integration test proves nothing.

## Out of scope

- Changing the policy (what counts as "used").
- Showing the chat card's «Confirmar» as disabled when the cap is hit (the tools already answer `already_booked`).
