# P3-01 — Availability invalidation on the tutor's date

**Tag:** `REFACTOR-R5-P3-01` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

The availability cache is keyed by the tutor's calendar day (`avail:v<n>:<YYYY-MM-DD>:<duration>`,
where the date is the one the client or the chat tools ask for, in `Europe/Madrid`). Every
invalidation computes the date as `iso.slice(0, 10)`, which is the **UTC** date. A slot at 00:30
Madrid (23:30 UTC the day before) clears the wrong day. Its own day keeps serving the now-taken (or
now-free) slot for up to the TTL: 5 minutes ≤ 7 days ahead, 15 minutes beyond. A 2-hour class
crossing local midnight also affects two days. Add `invalidateForWindow(startIso, endIso, timezone)`
to `availability-cache.ts`, and use it at all four call sites. *(Deferred from R4.)*

## Context

- `src/lib/availability-cache.ts:34-36`: `cacheKey(version, date, duration)`.
- `src/lib/availability-cache.ts:52-55`: `invalidate(date)` deletes durations 15/30/60/120 for one date.
- `src/lib/availability-cache.ts:25-32`: `cacheTTLSeconds`. Dates ≤ 1 day ahead are never cached (TTL 0), which is why this rarely shows.
- Call sites, all `x.slice(0, 10)`:
  - `src/services/BookingService.ts:339` (new booking)
  - `src/services/BookingService.ts:495` (cancel)
  - `src/services/BookingService.ts:683` (reschedule teardown of the original)
  - `src/services/AccountService.ts:108` (account deletion cancels upcoming classes)
- `src/services/PaymentService.ts:651`: the webhook already does it right: `formatInTimeZone(start, config.timezone, "yyyy-MM-dd")`.
- `src/services/AvailabilityService.ts:68-95`: `lookup(date, …)`. `date` is the tutor's day.
- `ScheduleService.getConfig()` is Redis-cached (`REFACTOR-R3-P3-02`), so reading the timezone at the cancel site costs a cache hit.

## Files affected

| File | Change |
|------|--------|
| `src/lib/availability-cache.ts` | New `invalidateForWindow(startIso, endIso, timezone)` (start's and end's local dates, deduped) |
| `src/services/BookingService.ts` | `:339`, `:495`, `:683` use it (timezone from the config already read in `createBooking`; `getConfig()` in `cancelByToken`) |
| `src/services/AccountService.ts` | `:108` uses it |
| `src/lib/__tests__/availability-cache.test.ts` | Madrid 00:30 → the local date; a 23:00–01:00 window → two dates |
| `src/services/__tests__/BookingService.test.ts` | Invalidation called with the local date for a near-midnight slot |

## The change

```ts
// src/lib/availability-cache.ts
// REFACTOR-R5-P3-01: the cache is keyed by the TUTOR's calendar day; a booking's UTC date
// is the wrong key between local midnight and the UTC offset. A window crossing local
// midnight touches two days.
export async function invalidateForWindow(startIso: string, endIso: string, timezone: string): Promise<void> {
  const dates = new Set([
    formatInTimeZone(new Date(startIso), timezone, "yyyy-MM-dd"),
    formatInTimeZone(new Date(endIso),   timezone, "yyyy-MM-dd"),
  ]);
  await Promise.all([...dates].map(invalidate));
}
```

```ts
// BookingService.createBooking
await invalidateForWindow(input.startIso, input.endIso, config.timezone).catch(() => {});
```

Keep `invalidate(date)` exported: `/api/admin/schedule` and tests may use it (grep before deciding).
The `.catch(() => {})` at each call site stays: invalidation is best-effort by design.

## Acceptance criteria

- [ ] All four call sites use the tutor's timezone; no `slice(0, 10)` remains on an instant passed to the cache
- [ ] `invalidateForWindow("2026-11-12T23:30:00Z", "2026-11-12T23:45:00Z", "Europe/Madrid")` deletes the `2026-11-13` keys
- [ ] A window 22:00Z–00:00Z (23:00–01:00 Madrid, winter) deletes both local dates
- [ ] File-top blocks carry `REFACTOR-R5-P3-01`

## Test plan

- **Existing:** `availability-cache.test.ts`, `AvailabilityService` tests, `BookingService.test.ts` (it mocks `@/lib/availability-cache`, so update the mocked name).
- **New (unit):** the two cases above, plus a summer-time case (UTC+2: 22:30Z → next local day).
- **New (service):** `createBooking` at 23:30Z with timezone Madrid → `invalidateForWindow` called with that timezone.

## Notes / gotchas

- `AccountService` needs the timezone. It already depends on `BookingService` (`getCancelWindowMs`), so
  add a tiny `BookingService.getTimezone()` or pass the `ScheduleService`. Don't read the ISR loader
  (`src/lib/schedule-config.ts`) from a service.
- `AvailabilityService.findSlots` walks days with `cursor.toISOString().slice(0, 10)` from a noon-UTC
  cursor. That's a *date* walk, not an instant, and it's correct. Leave it.

## Out of scope

- Changing TTLs or the cache key scheme.
- Invalidating on Google Calendar changes made outside the app (TTL covers them).
