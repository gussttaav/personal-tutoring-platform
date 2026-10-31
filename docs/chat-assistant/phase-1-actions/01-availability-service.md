# P1-01: Availability service

**Tag:** `CHAT-AGENT-P1-01` · **Effort:** S · **Owner:** Claude · **Status:** ⬜

## TL;DR

The chat tools need the same free slots the booking calendar shows. Today that logic (schedule
read, date guards, Redis cache with miss coalescing, Google freebusy) lives **inside the route
handler** `src/app/api/availability/route.ts`. Move it into `AvailabilityService.getSlots(date,
duration)` so the route and the chat tools share one implementation. The route keeps rate
limiting, parameter parsing and timezone localization. Behaviour of `GET /api/availability` must
not change.

## Context

- `src/app/api/availability/route.ts:36-91`: `GET` reads `scheduleService.getConfig()` fresh,
  validates `date` / `duration`, returns `[]` for past dates, dates beyond
  `bookingWindowWeeks`, and days with no working blocks, then
  `getOrCompute(resolveCacheKey(date, duration), () => getAvailableSlots(...), cacheTTLSeconds(date))`.
- `src/lib/availability-cache.ts`: `cacheTTLSeconds`, `resolveCacheKey`, `getOrCompute`
  (REFACTOR-P3-03 coalescing), `invalidate`, `bumpScheduleVersion`.
- `src/infrastructure/google/CalendarClient.ts:76-129`: `getAvailableSlots(dateStr, duration,
  config)` does the freebusy query and the min-notice filter; `TimeSlot = { start, end, label }`
  with the label in the **tutor's** timezone.
- `localizeSlots` (route, `:11-34`) stays in the route: it is presentation.
- Convention (CLAUDE.md): route handlers are thin; business logic goes in `src/services/`.

## Files affected

| File | Change |
|------|--------|
| `src/services/AvailabilityService.ts` (new) | `getSlots(date, durationMinutes): Promise<TimeSlot[]>` and `findSlots({ fromDate, days, durationMinutes, limit })` (walks up to 7 days, stops at `limit`) |
| `src/services/index.ts` | `export const availabilityService = new AvailabilityService(scheduleService, getAvailableSlots)` |
| `src/app/api/availability/route.ts` | Calls `availabilityService.getSlots`; keeps rate limit, parsing, `localizeSlots`, error mapping |
| `src/services/__tests__/AvailabilityService.test.ts` (new) | Fakes for schedule + slot source; mocks `@/lib/availability-cache` |

## The change

```ts
// CHAT-AGENT-P1-01: the availability lookup, shared by GET /api/availability and the chat
// tools (P1-03). Extracted from the route unchanged: same guards, same cache, same source.
export class AvailabilityService {
  constructor(
    private readonly schedule: Pick<ScheduleService, "getConfig">,
    private readonly source: typeof getAvailableSlots,
  ) {}

  async getSlots(date: string, durationMinutes: number): Promise<TimeSlot[]> { /* route body */ }

  async findSlots(opts: { fromDate: string; days: number; durationMinutes: number; limit: number })
    : Promise<TimeSlot[]> { /* sequential getSlots per day, early stop at limit */ }
}
```

- Inject the slot source (not a `CalendarClient` instance) so the test needs no Google mock.
- `findSlots` is sequential on purpose: most days are cache hits, and stopping early saves Google
  calls on a miss. Cap `days` at 7 inside the method, whatever the caller asks.
- Keep reading the schedule **fresh** (`scheduleService.getConfig()`, not the ISR loader), as the
  route does today; the comment at `route.ts:41-43` explains why.

## Acceptance criteria

- `GET /api/availability` returns byte-identical JSON for the same inputs (spot-check a working
  day, a weekend, a past date, a date past the window).
- No `getAvailableSlots` / `getOrCompute` import left in the route.
- `findSlots` never queries more than 7 days and returns at most `limit` slots.

## Test plan

- Unit: guards (past date, beyond window, no working blocks → `[]` with no source call);
  cache path delegates to `getOrCompute`; `findSlots` stops early and caps days.
- `pnpm test`, `pnpm lint`, `pnpm build`.
- Manual: the booking calendar on `/mentoria` still shows the same slots.

## Gotchas

- `getOrCompute` skips the cache for dates ≤ 1 day away (`cacheTTLSeconds` = 0), so «hoy» and
  «mañana» always hit Google. Fine for one request; the chat tool must not loop over them.
- Error handling: the route logs and answers 500. The service throws; the route keeps its catch.

## Out of scope

- Changing cache TTLs or keys. Moving `localizeSlots`.
