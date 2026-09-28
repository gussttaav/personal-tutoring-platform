# P1-01 — Server-side slot validation + `/api/book` rate limit

**Tag:** `REFACTOR-R4-P1-01` · **Severity:** 🔴 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

The server books whatever `startIso`/`endIso` the client sends. `/api/book` (free call, pack class,
and every reschedule) never checks working hours, the tutor's Google Calendar, or that the window's
length matches the session type. The only guards are min-notice, a slot lock, and the bookings
exclusion constraint.

So any Google account can book a "15-minute free call" as an 8-hour event at 3 a.m. on top of the
tutor's own calendar blocks. A pack student can spend one credit on a 4-hour class. The paid path
checks that the *start* is free for the paid length, then books the metadata's `end_iso`, so a "1h"
payment can yield a 3-hour class.

Add one validator in `BookingService`, used by `createBooking`, by checkout (before any
PaymentIntent), and by the webhook re-check. Derive the paid session's end from its duration. Add
a rate limit to `/api/book`, and a per-user cap on the free call (policy decision below).

## Context

- `src/lib/schemas.ts:24-31` (`BookSchema`) and `:42-48` (`SingleCheckoutSchema`): `startIso` and
  `endIso` are two independent `z.string().datetime()`. Nothing relates them to `sessionType` /
  `duration`.
- `src/app/api/book/route.ts:17-41`: no rate limiter, and no validation beyond the schema.
  `...parsed.data` spreads the client window straight into `createBooking`.
- `src/services/BookingService.ts:106-121`: the only checks are min-notice (`:108-111`) and a slot lock
  whose length is **derived from the client's own window** (`:115-118`).
  ```ts
  const durationMinutes = Math.round(
    (new Date(input.endIso).getTime() - new Date(input.startIso).getTime()) / 60_000
  );
  const locked = await this.bookings.acquireSlotLock(input.startIso, durationMinutes);
  ```
- `src/services/PaymentService.ts:463-470` checks a `duration`-long slot *starting* at `startIso`.
  `:494-502` then books `endIso` from metadata. `:463` also uses the **UTC** date
  (`startIso.slice(0, 10)`) as the tutor-timezone day.
- `src/services/PaymentService.ts:150-186` (`createSingleSessionCheckout`): no validation. A
  PaymentIntent is created for any window.
- `src/components/SingleSessionBooking.tsx:188-189`: the client comment says "(adjusts endIso + label
  to the real session length; **the server validates it**)". It doesn't.
- `supabase/migrations/0005_booking_exclusion_constraint.sql`: rejects overlapping *confirmed bookings*
  only. It knows nothing about working hours or the tutor's manual calendar events.
- Session lengths the server already assumes: `src/infrastructure/zoom/jwt.ts:102-107`
  (free15min 15, session1h 60, session2h 120, pack "treat as 1h").
  The client agrees: `src/components/BookingModeView.tsx:39` (`PACK_SESSION_MINUTES = 60`) and `:474-476`.
- Start granularity offered by the UI: 15-min rows for the free call, 30-min hints elsewhere
  (`SingleSessionBooking.tsx:188`, `src/components/week-grid/helpers.ts:90-109`). A 15-minute
  alignment accepts every start the UI can produce.
- Copy that frames the free call as a one-off: `messages/es.json` → `home.hero.freeNote`,
  `mentoria.header.freeNote` ("*El encuentro inicial* de 15 minutos es gratis").

## Files affected

| File | Change |
|------|--------|
| `src/lib/booking-config.ts` | `SESSION_DURATION_MINUTES`, `SLOT_ALIGNMENT_MINUTES` (pure, client-importable) |
| `src/infrastructure/google/ICalendarClient.ts` | `listBusy(timeMin, timeMax, { ignoreEventId? })` |
| `src/infrastructure/google/CalendarClient.ts` | Implement `listBusy` (events.list, opaque + non-declined + not ignored) |
| `src/services/BookingService.ts` | `checkSlot()` / `assertSlotBookable()`; `createBooking` calls it first; free-call cap |
| `src/services/PaymentService.ts` | Checkout validates before creating the PI; webhook re-check uses `checkSlot` with a derived end; drop the standalone `getAvailableSlots` import |
| `src/domain/errors.ts` | `InvalidSlotError` (`INVALID_SLOT`), `FreeSessionAlreadyUsedError` (`FREE_SESSION_ALREADY_USED`) |
| `src/domain/repositories/IBookingRepository.ts` + `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `hasActiveFreeSession(email)` |
| `src/lib/http-errors.ts` | `INVALID_SLOT: 400`, `FREE_SESSION_ALREADY_USED: 409` |
| `src/constants/errors.ts`, `messages/es.json`, `messages/en.json` | `errors.domain.invalidSlot`, `errors.domain.freeSessionAlreadyUsed` (both files) |
| `src/lib/ratelimit.ts`, `src/app/api/book/route.ts` | `bookRatelimit` (10/min per email) |
| `src/app/api/stripe/checkout/route.ts` | Map `DomainError` via `mapDomainErrorToResponse` instead of a blanket 500 |
| `src/__tests__/fixtures/FakeCalendarClient.ts`, `InMemoryBookingRepository.ts`, new `src/__tests__/fixtures/slots.ts` | Fake `listBusy`; `hasActiveFreeSession`; aligned in-hours slot helper |
| `src/services/__tests__/BookingService.test.ts`, `PaymentService.test.ts`, `src/__tests__/integration/*.test.ts` | New cases; fixture churn (see Test plan) |
| `e2e/reschedule.spec.ts`, `e2e/cancellation.spec.ts` | Seed from `/api/availability`, not "tomorrow 11:00 runner-local" |

## The change

### 1. The single definition of a session's length (`src/lib/booking-config.ts`)

```ts
// REFACTOR-R4-P1-01: the server-side source of truth for how long each session type
// lasts. The Zoom grace table (infrastructure/zoom/jwt.ts) and the booking UI already
// assume these values; the validator now enforces them.
export const SESSION_DURATION_MINUTES: Record<SessionType, number> = {
  free15min: 15,
  session1h: 60,
  session2h: 120,
  pack:      60,
};

/** Every bookable start sits on this grid in the tutor's timezone. */
export const SLOT_ALIGNMENT_MINUTES = 15;
```

### 2. Calendar conflicts that can ignore one event (`ICalendarClient` / `CalendarClient`)

`freebusy` can't exclude an event, and P1-03 needs to validate a reschedule while the old booking's
event still exists. Use `events.list`:

```ts
// ICalendarClient
/** REFACTOR-R4-P1-01: busy intervals overlapping [timeMin, timeMax). Throws on API error
 *  (callers fail closed). `ignoreEventId` excludes a reschedule's own original event. */
listBusy(
  timeMinIso: string,
  timeMaxIso: string,
  opts?: { ignoreEventId?: string },
): Promise<Array<{ start: string; end: string }>>;
```

```ts
// CalendarClient
async listBusy(timeMinIso: string, timeMaxIso: string, opts: { ignoreEventId?: string } = {}) {
  const res = await getCalendar().events.list({
    calendarId:   CALENDAR_ID,
    timeMin:      timeMinIso,
    timeMax:      timeMaxIso,
    singleEvents: true,
    maxResults:   50,
    fields:       "items(id,status,transparency,start,end,attendees(self,responseStatus))",
  });
  return (res.data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => e.transparency !== "transparent")          // "Show as: free"
    .filter((e) => !e.attendees?.some((a) => a.self && a.responseStatus === "declined"))
    .filter((e) => e.id !== opts.ignoreEventId)
    .map((e) => ({
      start: e.start?.dateTime ?? zonedMidnightIso(e.start?.date!),
      end:   e.end?.dateTime   ?? zonedMidnightIso(e.end?.date!),
    }));
}
```

(`zonedMidnightIso(date)`: `fromZonedTime(\`${date}T00:00:00\`, tz).toISOString()`. All-day
events carry `date`, not `dateTime`. Pass the schedule timezone in, or read it from
`CreateEventParams`-style config. Keep `getAvailableSlots` on `freebusy`; it serves the grid.)

### 3. The validator (`BookingService`)

```ts
// REFACTOR-R4-P1-01: the server decides what is bookable. Returns null when the slot is
// bookable, otherwise the error to throw. Calendar errors PROPAGATE (fail closed,
// same rule as REFACTOR-R3-P1-02).
async checkSlot(
  slot: { startIso: string; endIso: string; sessionType: SessionType },
  opts: { ignoreEventId?: string } = {},
): Promise<DomainError | null> {
  const start = new Date(slot.startIso);
  const end   = new Date(slot.endIso);
  const lenMs = SESSION_DURATION_MINUTES[slot.sessionType] * 60_000;
  if (Number.isNaN(start.getTime()) || end.getTime() - start.getTime() !== lenMs) {
    return new InvalidSlotError();
  }

  const config = await this.schedule.getConfig();
  const zoned  = toZonedTime(start, config.timezone);           // date-fns-tz
  const minute = zoned.getHours() * 60 + zoned.getMinutes();
  if (minute % SLOT_ALIGNMENT_MINUTES !== 0 || zoned.getSeconds() !== 0 || zoned.getMilliseconds() !== 0) {
    return new InvalidSlotError();
  }

  const now = Date.now();
  if (start.getTime() < now + config.minNoticeHours * 3_600_000)                 return new SlotUnavailableError();
  if (start.getTime() > now + config.bookingWindowWeeks * 7 * 86_400_000)         return new SlotUnavailableError();
  if (!isWithinBlocks(config.weeklyHours[zoned.getDay()] ?? [], minute, lenMs / 60_000)) {
    return new SlotUnavailableError();
  }

  const busy = await this.calendar.listBusy(slot.startIso, slot.endIso, opts);
  return busy.length > 0 ? new SlotUnavailableError() : null;
}

async assertSlotBookable(
  slot: { startIso: string; endIso: string; sessionType: SessionType },
  opts: { ignoreEventId?: string } = {},
): Promise<void> {
  const err = await this.checkSlot(slot, opts);
  if (err) throw err;
}
```

In `createBooking`, replace the min-notice block (`:107-111`) with the validator. Resolve the old
booking first when rescheduling, so its own event doesn't count as a conflict. P1-03 restructures
this further.

```ts
const config = await this.schedule.getConfig();   // still needed below (timezone, cancel window)
const oldForReschedule = input.rescheduleToken
  ? await this.bookings.findByCancelToken(input.rescheduleToken)
  : null;
await this.assertSlotBookable(input, { ignoreEventId: oldForReschedule?.eventId });

if (input.sessionType === "free15min" && !input.rescheduleToken
    && await this.bookings.hasActiveFreeSession(input.email)) {
  throw new FreeSessionAlreadyUsedError();
}
```

The slot-lock duration (`:115-118`) is now guaranteed to equal the session length. Keep computing it
from the window, or switch it to `SESSION_DURATION_MINUTES[input.sessionType]`, which reads better.

### 4. Paid path (`PaymentService`)

```ts
// createSingleSessionCheckout — before pricing/PI creation
const sessionType = duration === "1h" ? "session1h" : "session2h";
await this.bookings.assertSlotBookable({ startIso, endIso, sessionType });
```

```ts
// processSingleSession — replaces :462-470. The end is DERIVED, never read from metadata.
const sessionType = duration === "2h" ? "session2h" as const : "session1h" as const;
const endIsoSafe  = new Date(
  new Date(startIso).getTime() + SESSION_DURATION_MINUTES[sessionType] * 60_000,
).toISOString();
const verdict = await this.bookings.checkSlot({ startIso, endIso: endIsoSafe, sessionType });
if (verdict) { /* existing refund path, unchanged */ }
// ...and createBooking({ ..., endIso: endIsoSafe, ... })
```

Remove `import { getAvailableSlots } from "@/infrastructure/google"` and the
`const scheduleConfig = await this.schedule.getConfig()` that only fed it. If nothing else in
`PaymentService` reads `this.schedule`, leave the constructor alone anyway: changing the injection
list is out of scope.

`/api/stripe/checkout` currently catches everything as a 500 (`route.ts:63-66`). Route
`DomainError` through `mapDomainErrorToResponse` so the client gets `INVALID_SLOT` /
`SLOT_UNAVAILABLE`, and keep the 500 + log for everything else.

### 5. `/api/book` rate limit

```ts
// src/lib/ratelimit.ts
// REFACTOR-R4-P1-01: /api/book was the last booking route with no limiter, and the
// costliest one (Calendar insert + Zoom creds + 2 emails per call).
export const bookRatelimit = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:book",
});
```

In the route: after the session check, `bookRatelimit.limit(session.user.email)` → 429. Keyed by
email, like the account and course-progress limiters, because the route is authenticated.

### 6. Free-call cap (policy: see Notes)

```ts
// IBookingRepository
/** REFACTOR-R4-P1-01: true if the user holds a free15min booking that was not cancelled
 *  (confirmed, completed or no_show). */
hasActiveFreeSession(email: string): Promise<boolean>;
```

Implement as a `count` with `head: true` on `bookings` where `session_type = 'free15min'` and
`status <> 'cancelled'`. Throw on `error`, per P1-02.

## Acceptance criteria

- [ ] `POST /api/book` → `400 INVALID_SLOT` when `endIso − startIso` ≠ the session type's length, or the start is off the 15-min grid in the tutor's timezone
- [ ] `POST /api/book` → `409 SLOT_UNAVAILABLE` for: before min-notice, beyond the booking window, outside that weekday's working blocks, overlapping any opaque non-declined calendar event
- [ ] None of the rejections above creates a calendar event, a booking row, or decrements a credit (validation runs before the saga)
- [ ] A second non-cancelled `free15min` for the same user → `409 FREE_SESSION_ALREADY_USED`; after cancelling the first, booking again succeeds (unless the decision says otherwise)
- [ ] Rescheduling to a slot overlapping the booking's *own* original event is accepted (`ignoreEventId`)
- [ ] `POST /api/stripe/checkout` with a mismatched window → 4xx, **no PaymentIntent created** (fake Stripe saw no call)
- [ ] Webhook books `startIso + duration`, ignoring metadata `end_iso`; a busy/off-hours slot still goes down the refund path; a Calendar error still rejects (500, no refund)
- [ ] `/api/book` returns 429 after 10 requests/min for one user
- [ ] `errors.domain.invalidSlot` / `freeSessionAlreadyUsed` exist in both message files; `pnpm check:messages` green
- [ ] File-top comment blocks carry `REFACTOR-R4-P1-01`

## Test plan

- **Existing, expect churn.** `BookingService.test.ts` builds its config with an **empty** weekly
  schedule (`:125`) and unaligned `hoursFromNow(10)` starts (`:160`, `:665`, `:692`, `:781`). After this
  task, all of those fail validation. Add `src/__tests__/fixtures/slots.ts` with:
  - `allDaySchedule()`: every weekday `[{ startMinute: 0, endMinute: 1440 }]`
  - `alignedSlot(sessionType, hoursAhead)`: rounds up to 15 min, correct length

  Switch the suite to those helpers. Same for `src/__tests__/integration/{booking,reschedule,cancellation,payment}.test.ts`.
- **Existing.** `PaymentService.test.ts` mocks `@/infrastructure/google`'s `getAvailableSlots` (`:10-13`,
  `:333`). Replace that module mock with `FakeCalendarClient.busy` driving `checkSlot`. Keep the
  "Calendar throws → rejects, no refund" test (`:333`), now as `listBusy` rejecting.
- **New (service):** one case per rejection reason (length, alignment, min-notice, window, off-hours,
  busy). Add:
  - busy-but-ignored (reschedule)
  - the free-call cap, including cancelled-doesn't-count
  - checkout rejects before `createPaymentIntent`
  - webhook ignores a lying `end_iso` (metadata end = start + 3h → booking end = start + 1h)
- **New (fake):** `FakeCalendarClient.listBusy` filters by overlap and `ignoreEventId`. A unit test
  in `src/__tests__/fixtures` keeps the fake honest.
- **e2e.** `reschedule.spec.ts:28-52` and `cancellation.spec.ts:32-56` seed a free call "tomorrow
  10:00/11:00 in the runner's timezone" and **`test.skip` if the POST fails**. After this task that silently
  skips on weekends, off-hours, or busy mornings. Seed from `GET /api/availability?duration=15`'s
  first slot instead (add an `e2e/helpers/slots.ts`), and turn the `skip` into a failure. With the
  free-call cap, check that `e2e/fixtures/cleanup.ts` (`resetTestState`) removes the E2E user's
  bookings between specs. Otherwise `booking-free.spec.ts` and these two specs 409 each other.

## Notes / gotchas

- **Decision (Gustavo): free-call policy.** The default here is "one non-cancelled `free15min` per
  user". Alternatives:
  - "one ever", which `hasAnyBooking`'s doc comment already describes (`IBookingRepository.ts:67-73`)
  - no cap, relying only on the rate limit and validation

  Record the choice in STATUS.md → Decisions.
- **Why `events.list` and not `freebusy`:** the reschedule must not collide with its own original
  event (P1-03 keeps it alive until the new booking commits), and `freebusy` can't exclude an event.
  The filters (cancelled, transparent, self-declined) mirror what `freebusy` treats as free. Before
  merging, compare `listBusy` with the grid on a real week of the tutor's calendar. A slot the grid
  offers must pass `checkSlot`.
- **Fail closed.** `listBusy` and `getConfig` errors propagate. In the webhook that means 500 and a
  Stripe retry, as `REFACTOR-R3-P1-02` established. Don't catch them into "free".
- **UTC-vs-tutor date.** The old re-check used `startIso.slice(0, 10)` as the tutor's day. The
  validator works in `config.timezone` via `toZonedTime`, so this bug disappears on the booking path.
  The availability-cache invalidation keeps the UTC-date quirk (deferred in PLAN.md).
- **Two Calendar reads on a paid booking** (webhook `checkSlot` + `createBooking`'s own validation).
  Accepted: it's one extra API call per paid class. Don't turn `createBooking`'s `SlotUnavailableError`
  into the refund trigger instead. That error is also thrown on **slot-lock contention**, which is
  what a *concurrent duplicate delivery* of the same PaymentIntent hits. Refunding there would refund
  a booked class.
- Min-notice now lives in `checkSlot`. `getAvailableSlots` still filters by it for the grid, so the
  two agree.
- `SESSION_DURATION_MINUTES` duplicates `BookingModeView`'s `SESSION_CONFIGS.durationMinutes` and
  `PACK_SESSION_MINUTES`. Pointing the UI at the new constant is a nice follow-up, not required here.

## Out of scope

- Reschedule ordering and rollback (P1-03). This task only makes the validator ignore the old event.
- The `hasBookingForPayment` / idempotency reads (P1-02).
- Replacing `getAvailableSlots`' `freebusy` with `events.list` for the grid.
- Pointing the booking UI's duration constants at `SESSION_DURATION_MINUTES`.
- The availability cache's UTC-date invalidation key.
