# P1-03 — Booking-exists check in the webhook idempotency gate

**Tag:** `REFACTOR-R3-P1-03` · **Severity:** 🟠 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

If `createBooking` succeeds but the subsequent `markProcessed` write fails, the webhook
500s and Stripe redelivers. On redelivery: `isProcessed` is false, `wasRefunded` is false,
and the slot re-check now sees the booking's **own** calendar event → the code concludes
"slot taken" and **refunds** a customer whose booking stands. Add a third short-circuit to
the idempotency gate: an existing confirmed booking for this PaymentIntent means "processed".

## Context

- `src/services/PaymentService.ts:400-412` — `createBooking` then `markProcessed`; the two writes are not atomic.
- `src/services/PaymentService.ts:361-372` — current gate: `isProcessed(idempotencyKey)` then `wasRefunded(paymentIntentId)`. Neither covers the booking-committed-but-unmarked state.
- `src/services/PaymentService.ts:381-392` — the refund branch that fires spuriously in this scenario (and broadcasts `slot_taken` for a confirmed booking).
- `src/services/BookingService.ts:471-473` — `findByStripePaymentId` already exists (built for `SINGLE-SESSION-CONFIRM-01` polling) and is **confirmed-status-scoped** per `getSingleSessionStatus`'s ordering comment (`PaymentService.ts:456-458`).

## Files affected

| File | Change |
|------|--------|
| `src/services/PaymentService.ts` | Add booking-exists short-circuit to the gate in `processSingleSession` |
| `src/services/__tests__/PaymentService.test.ts` | New redelivery-scenario tests |

## The change

```ts
// PaymentService.processSingleSession — after the isProcessed check:

// REFACTOR-R3-P1-03: createBooking and markProcessed are separate writes. If the
// booking committed but markProcessed failed, Stripe's redelivery must NOT reach the
// slot re-check (it would see our own calendar event and refund a fulfilled booking).
// A confirmed booking for this PI is proof of processing — heal the marker and stop.
if (paymentIntentId) {
  const existing = await this.bookings.findByStripePaymentId(paymentIntentId);
  if (existing) {
    await this.paymentRepo.markProcessed(idempotencyKey).catch(() => {});
    log("info", "Duplicate single-session webhook skipped (booking already exists)", {
      service: "payment", idempotencyKey,
    });
    return;
  }
}
```

Gate order becomes: `isProcessed` → **booking exists** → `wasRefunded` → slot re-check.
(`wasRefunded` stays third: a confirmed booking must win over a stale refund record, matching
`getSingleSessionStatus`'s documented ordering.)

## Acceptance criteria

- [ ] Redelivery after "booking committed, markProcessed failed" → no refund, no second booking, `markProcessed` healed
- [ ] Broadcast behavior: the duplicate-skip path emits **no** `slot_taken`/`failed` broadcast
- [ ] `checkout.session.completed` legacy path (idempotencyKey = `cs_...`, PI resolved from `session.payment_intent`) covered too
- [ ] Existing duplicate/refund/dead-letter tests stay green
- [ ] File-top comment block updated with `REFACTOR-R3-P1-03`

## Test plan

- **Existing:** all `PaymentService.test.ts` webhook tests.
- **New:**
  1. Seed booking fake with a booking for `pi_X`, `isProcessed` → false. Deliver `payment_intent.succeeded` for `pi_X` → resolves; stripe fake saw no `createRefund`; `markProcessed` called.
  2. Same but `markProcessed` healing also fails → still resolves (the `.catch(() => {})` — a later redelivery will retry the heal).
  3. Regression: no booking, slot genuinely taken → refund path still fires exactly once.

## Notes / gotchas

- **Cancelled-booking edge:** if the student books, then *cancels* before a delayed redelivery arrives, `findByStripePaymentId` (confirmed-scoped) returns null and the redelivery could re-book the now-free slot. This requires `markProcessed` to have failed AND a cancellation inside Stripe's retry window — accepted residual risk; the reconciliation cron (`REFACTOR-P4-01`, cycle 2) surfaces it. Document, don't chase.
- `paymentIntentId` can be `undefined` on malformed legacy events — the gate must stay inside the `if (paymentIntentId)` guard (the existing `wasRefunded` check has the same guard).
- Keep the heal-write `.catch(() => {})`: the gate itself is the protection; the marker is an optimization.

## Out of scope

- Making `createBooking` + `markProcessed` transactional (would require moving the marker into Supabase alongside the booking row — bigger change, revisit if the residual risk ever materializes).
- Touching `getSingleSessionStatus` (its ordering is already correct).
