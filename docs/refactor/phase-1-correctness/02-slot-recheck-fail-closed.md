# P1-02 — Webhook slot re-check must fail closed

**Tag:** `REFACTOR-R3-P1-02` · **Severity:** 🟠 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

In `processSingleSession`, a Google freebusy failure is treated as "slot is free"
(`.catch(() => null)` → `?? true`) and the paid booking proceeds unchecked. The DB
exclusion constraint (migration `0005_booking_exclusion_constraint.sql`) protects against
overlapping *bookings*, but not against the tutor's manual calendar events — so a Google
hiccup during webhook processing can double-book the tutor. Let the error propagate:
the webhook route already returns 500 on throw, and Stripe retries for up to 3 days.

## Context

- `src/services/PaymentService.ts:378-379`:
  ```ts
  const availableSlots  = await getAvailableSlots(slotDate, durationMinutes, scheduleConfig, 30).catch(() => null);
  const slotStillFree   = availableSlots?.some(s => s.start === startIso) ?? true;
  ```
- `src/app/api/stripe/webhook/route.ts:48-68` — non-`PermanentWebhookError` throws → 500 → Stripe retry (`REFACTOR-P1-02`, cycle 2). This is exactly the machinery a transient Google failure should ride.
- `src/infrastructure/google/CalendarClient.ts:64-115` — `getAvailableSlots` filters by freebusy + min-notice.

## Files affected

| File | Change |
|------|--------|
| `src/services/PaymentService.ts` | Remove `.catch(() => null)` and `?? true`; let the throw propagate |
| `src/services/__tests__/PaymentService.test.ts` | New test: calendar fake throws → `processWebhookEvent` rejects, no booking, no refund |

## The change

```ts
// PaymentService.processSingleSession — slot re-check
// REFACTOR-R3-P1-02: fail CLOSED. A freebusy failure is retryable (webhook 500 →
// Stripe redelivers), never "assume free": the exclusion constraint doesn't cover
// the tutor's manual calendar blocks.
const availableSlots = await getAvailableSlots(slotDate, durationMinutes, scheduleConfig, 30);
const slotStillFree  = availableSlots.some(s => s.start === startIso);
```

## Acceptance criteria

- [ ] Calendar client throwing during the re-check → `processSingleSession` rejects with a non-permanent error → webhook route returns 500
- [ ] No booking row, no calendar event, no refund is produced in that case
- [ ] Happy path (slot free / slot taken → refund) unchanged
- [ ] `reprocessFailedBooking` still returns `{ ok: false, error }` (not an unhandled rejection) when the re-check throws
- [ ] File-top comment block updated with `REFACTOR-R3-P1-02`

## Test plan

- **Existing:** `PaymentService.test.ts` slot-taken-refund and happy-path tests stay green.
- **New:** mock `getAvailableSlots` to reject → assert `processWebhookEvent` rejects, and the stripe fake saw **no** `createRefund`, the booking service fake saw **no** `createBooking`.
- **New:** same mock via `reprocessFailedBooking` → resolves `{ ok: false }`.

## Notes / gotchas

- `getAvailableSlots` here is the **standalone import** from `@/infrastructure/google`, not the injected `ICalendarClient` — mocking in tests goes through the module mock the existing tests already use. (Making PaymentService take the calendar via constructor injection would be nicer, but that's a separate layering cleanup — don't expand scope.)
- ISO-format equality: `s.start === startIso` compares two JS `toISOString()` outputs (both produced by our code), so the Supabase `+00:00` normalization gotcha does not apply here. Don't "fix" it.
- Stripe redelivery cadence means a prolonged Google outage delays the booking rather than failing it — that's the intended trade.

## Out of scope

- Injecting `ICalendarClient` into PaymentService (layering cleanup, some other cycle).
- The refund-idempotency gate (P1-03).
