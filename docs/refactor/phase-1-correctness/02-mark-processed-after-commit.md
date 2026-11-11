# P1-02 — `markProcessed` after the commit is best-effort

**Tag:** `REFACTOR-R5-P1-02` · **Severity:** 🟠 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

In `PaymentService.processSingleSession`, `markProcessed` sits inside the same `try` as
`createBooking`. If the booking commits and then `markProcessed` throws (a Postgres blip), the
`catch` treats it as a failed booking. It writes a dead-letter entry, emails the admin «booking
failed after payment», skips the `payments` audit row, and broadcasts `failed` to the student's
confirmation screen. All of that for a class that exists and was emailed to the student a moment
earlier. Narrow the `try` to `createBooking` alone, and make `markProcessed` best-effort after it.
The booking-exists gate (`REFACTOR-R3-P1-03`, made status-agnostic by `REFACTOR-R4-P1-02`) already
treats "a booking for this PI" as proof of processing, so a missing marker is harmless.
*(Deferred from R4: SUMMARY → "markProcessed failing after a successful createBooking writes a false dead-letter".)*

## Context

`src/services/PaymentService.ts:681-728`:

```ts
try {
  const booking = await this.bookings.createBooking({ … });   // :684 — commits, emails sent
  await this.paymentRepo.markProcessed(idempotencyKey);        // :694 — can throw
  log("info", "Single session booked", …);
  await this.recordPaymentRow({ … });                          // :700 — best-effort already
  if (paymentIntentId) await this.broadcastResolved(…);        // :707 — best-effort already
  return { status: "booked" };
} catch (err) {
  await this.writeDeadLetter(idempotencyKey, userId, startIso, err, email);  // :721
  if (paymentIntentId) await this.broadcastResolved(paymentIntentId, { status: "failed" });
  return { status: "dead_lettered", error: String(err) };
}
```

- `recordPaymentRow` (`:751-776`) and `broadcastResolved` (`:734-745`) catch their own errors, so
  `markProcessed` is the only post-commit step that can reach the `catch`.
- The heal path: `:621-627`. A redelivery sees `hasBookingForPayment` → `markProcessed(...).catch(() => {})` → `already_handled`.
- The reconcile cron (`:514-518`) counts `hasBookingForPayment` as handled, so a missing marker raises no mismatch.
- `reprocessFailedBooking` (`:443-459`) clears the entry only on a non-`dead_lettered` outcome. After
  this change a false dead-letter can't be created, so nothing to clean there.

## Files affected

| File | Change |
|------|--------|
| `src/services/PaymentService.ts` | `try` wraps `createBooking` only; `markProcessed` best-effort after; header note |
| `src/services/__tests__/PaymentService.test.ts` | New: `markProcessed` rejects after a committed booking |
| `src/__tests__/integration/payment.test.ts` | Optional: same scenario through the in-memory repos |

## The change

```ts
// REFACTOR-R5-P1-02: only createBooking can fail the booking. Everything after it is
// post-commit and best-effort — a throw there used to dead-letter a class that existed.
let booking: CreateBookingOutput;
try {
  booking = await this.bookings.createBooking({ … });
} catch (err) {
  log("error", "Booking failed after payment — writing dead-letter", { … });
  await this.writeDeadLetter(idempotencyKey, userId, startIso, err, email);
  if (paymentIntentId) await this.broadcastResolved(paymentIntentId, { status: "failed" });
  return { status: "dead_lettered", error: String(err) };
}

// The booking is committed. A missing marker is healed by the booking-exists gate on
// any redelivery (REFACTOR-R3-P1-03), and the reconcile cron counts the booking as proof.
await this.paymentRepo.markProcessed(idempotencyKey).catch((err) =>
  log("warn", "markProcessed failed after a committed booking (gate will heal it)", {
    service: "payment", idempotencyKey, error: String(err),
  }),
);
log("info", "Single session booked", { service: "payment", email, startIso });
await this.recordPaymentRow({ … });
if (paymentIntentId) await this.broadcastResolved(paymentIntentId, { status: "confirmed", … });
return { status: "booked" };
```

Import `CreateBookingOutput` as a type from `./BookingService` (it's already exported).

## Acceptance criteria

- [ ] `markProcessed` rejecting after `createBooking` resolves → outcome `booked`, `recordFailedBooking` not called, `sendDeadLetterNotificationEmail` not called, `recordPayment` called, `confirmed` broadcast
- [ ] `processWebhookEvent` resolves (webhook 200) in that case
- [ ] `createBooking` rejecting → unchanged: dead-letter written, `failed` broadcast, outcome `dead_lettered`
- [ ] A later redelivery for the same PI → `already_handled` via the booking-exists gate, which writes the marker
- [ ] `PaymentService.ts` file-top block carries `REFACTOR-R5-P1-02`

## Test plan

- **Existing:** every `PaymentService.test.ts` webhook case (booked, slot-taken refund, dead-letter, duplicate, healed marker) and `src/__tests__/integration/payment.test.ts`.
- **New (service):** payment repo whose `markProcessed` rejects once → assert the outcome and the four "not called / called" points above. Then redeliver the same event with `markProcessed` healthy → `already_handled`, and `markProcessed` called.
- **New (admin retry):** `reprocessFailedBooking` where `createBooking` now succeeds but `markProcessed` rejects → `{ ok: true, outcome: "booked" }`, entry cleared.

## Notes / gotchas

- Keep the `log("error", …)` in the `catch`. Sentry alerting on genuine failures depends on it.
- The legacy `checkout.session.completed` path uses the session id as `idempotencyKey` and may lack a
  `payment_intent`. There the booking-exists gate can't heal (it keys on the PI), so a redelivery
  falls through to the slot re-check, which sees our own event and refunds. That path has had no
  traffic since the embedded PaymentElement shipped. Note it in the header comment and leave it alone.
- Don't reorder `recordPaymentRow` before the broadcast. The mobile S08 screen reads the booking via
  polling, not the `payments` row, so the order doesn't matter, and moving it is churn.

## Out of scope

- Making `createBooking` + `markProcessed` one transaction (the booking saga spans Google, Zoom and email; there's no single DB transaction to join).
- The legacy Checkout Session path described above.
