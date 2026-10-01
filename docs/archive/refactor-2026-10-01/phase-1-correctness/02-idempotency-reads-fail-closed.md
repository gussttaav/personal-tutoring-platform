# P1-02 — Idempotency and eligibility reads fail closed

**Tag:** `REFACTOR-R4-P1-02` · **Severity:** 🟠 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

Several Supabase reads drop the `error` from the PostgREST result and return "not found"
(`false`, `null`, `[]`). Each of those answers **authorizes a side effect**:
- "not processed" lets the webhook re-run a payment
- "no booking for this PI" lets it re-check the slot and **refund**
- "no user / no credits / no bookings" lets `DELETE /api/account` erase an account

Stripe delivers some events twice. A duplicate that lands during a Postgres blip passes every gate,
sees our own calendar event as busy, and refunds a class that was delivered. Make these reads throw
on `error`, so the webhook returns 500 and Stripe retries. That is the same rule `REFACTOR-R3-P1-02`
applied to Google. While here, widen the webhook's booking-exists gate from confirmed-only to any
status, so a cancelled booking plus a redelivery can't re-book.

## Context

The reads (all destructure `data`/`count` and never look at `error`):

| Read | Where | Caller that acts on the false answer |
|------|-------|--------------------------------------|
| `isProcessed` | `SupabasePaymentRepository.ts:12-19` | `PaymentService.ts:434` idempotency gate |
| `hasFailedBooking` | `SupabasePaymentRepository.ts:72-79` | reconcile route; channel status (`PaymentService.ts:595`) |
| `wasRefunded` | `SupabasePaymentRepository.ts:94-100` | `PaymentService.ts:457` "already refunded" gate |
| `findByStripePaymentId` | `SupabaseBookingRepository.ts:406-416` (`if (error \|\| !data …) return null`) | `PaymentService.ts:444` booking-exists gate (`REFACTOR-R3-P1-03`) |
| `hasBookingForPayment` | `SupabaseBookingRepository.ts:394-401` (`.maybeSingle()`) | reconcile route |
| `hasProcessedPayment` | `SupabaseCreditsRepository.ts:98-104` | reconcile route; channel state (`PaymentService.ts:633`) |
| `findUserId` | `SupabaseCreditsRepository.ts:123-130` | `getCredits` → `AccountService.getDeletionEligibility` (`AccountService.ts:39`); `decrementCredit`; `restoreCredit` (silently "no pack") |
| `listByUser` user lookup | `SupabaseBookingRepository.ts:166-172` | `AccountService.partitionUpcoming` (`:136`); `/api/my-bookings` |
| `hasAnyBooking` user lookup | `SupabaseBookingRepository.ts:341-347` | `/api/credits` `hasBookings`, `LandingService` |

The failure sequence the audit traced (single session, duplicate delivery during a blip):

1. `isProcessed` → error swallowed → `false`
2. `findByStripePaymentId` → error → `null` (it's also *confirmed-only*, so a legitimately cancelled booking also reads as "none")
3. `wasRefunded` → error → `false`
4. `getAvailableSlots` (or P1-01's `checkSlot`) sees **our own** calendar event → "slot taken"
5. `createRefund` → money back for a class that exists and stays booked

And for account deletion: `findUserId` error → `getCredits` returns `null` → `packCredits = 0`.
`listByUser` error → `[]`. The eligibility check passes, and `delete_user_account` erases a student
who still holds credits. It's irreversible.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/supabase/SupabasePaymentRepository.ts` | `isProcessed`, `hasFailedBooking`, `wasRefunded` throw on `error` |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `listByUser` + `hasAnyBooking` user lookups throw; `hasBookingForPayment` → `count` + throw; `findByStripePaymentId` throws on `error` (still `null` when absent) |
| `src/infrastructure/supabase/SupabaseCreditsRepository.ts` | `hasProcessedPayment`, `findUserId` throw on `error` |
| `src/services/PaymentService.ts` | Booking-exists gate uses `hasBookingForPayment` (any status) instead of confirmed-only `findByStripePaymentId` |
| `src/services/BookingService.ts` | Expose `hasBookingForPayment` (thin delegate), used by the gate |
| `src/domain/repositories/*` | Doc comments: "throws on a read error; `false`/`null` means *known absent*" |
| `src/infrastructure/supabase/__tests__/fail-closed.test.ts` (new, unit) | Mocked client returning `{ error }` → each read rejects |
| `src/services/__tests__/PaymentService.test.ts`, `AccountService.test.ts` | Gate/eligibility propagate repository errors |

## The change

The pattern, applied to each read in the table:

```ts
// REFACTOR-R4-P1-02: fail CLOSED. A read error must never read as "absent" — every
// caller of this method treats `false` as permission to act (process / refund / erase).
async isProcessed(idempotencyKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("idempotency_key")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
```

`hasBookingForPayment` becomes a count. `.maybeSingle()` **errors** when two rows match, and after
P1-03 a rescheduled paid class *does* leave two rows (old `cancelled` + new `confirmed`) sharing a
`stripe_payment_id`:

```ts
async hasBookingForPayment(stripePaymentId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("bookings")
    .select("id", { head: true, count: "exact" })
    .eq("stripe_payment_id", stripePaymentId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
```

`findByStripePaymentId` separates "error" from "absent":

```ts
if (error) throw error;
if (!data || !data.join_token || !data.calendar_event_id) return null;
```

The webhook gate (`PaymentService.ts:443-452`) switches to the status-agnostic check. A booking in
**any** state (confirmed, cancelled, completed, no_show) proves this PaymentIntent was fulfilled once:

```ts
// REFACTOR-R4-P1-02: status-agnostic. A cancelled booking for this PI is still proof of
// processing — re-running would re-book a slot the student already gave back.
if (paymentIntentId && await this.bookings.hasBookingForPayment(paymentIntentId)) {
  await this.paymentRepo.markProcessed(idempotencyKey).catch(() => {});
  log("info", "Duplicate single-session webhook skipped (booking already exists)", { service: "payment", idempotencyKey });
  return;
}
```

`getSingleSessionStatus` (`:589-598`) keeps `findByStripePaymentId`. The polling surface wants the
*confirmed* detail, and that's correct there.

## Acceptance criteria

- [ ] Each read in the Context table rejects when the Supabase client returns `{ error }`, and still returns `false`/`null`/`[]` when the row is genuinely absent
- [ ] Duplicate `payment_intent.succeeded` with `isProcessed` (or `wasRefunded`, or the booking lookup) rejecting → `processWebhookEvent` rejects → webhook 500; **no `createRefund`**, no `createBooking`
- [ ] Redelivery for a PI whose booking was **cancelled** → skipped (marker healed), not re-booked
- [ ] `DELETE /api/account` with `findUserId` / `listByUser` rejecting → 500; `users.deleteAccount` never called
- [ ] `hasBookingForPayment` returns `true` with two rows for one PI
- [ ] File-top comment blocks carry `REFACTOR-R4-P1-02`

## Test plan

- **Existing:** `src/infrastructure/supabase/__tests__/SupabasePaymentRepository.test.ts`,
  `SupabaseBookingRepository.test.ts` and `SupabaseCreditsRepository.test.ts` (DB-gated) keep passing.
  The happy-path semantics are unchanged.
- **New (unit, not DB-gated):** `src/infrastructure/supabase/__tests__/fail-closed.test.ts`.
  `jest.mock("../client")` with a chainable builder whose terminal call resolves
  `{ data: null, count: null, error: { code: "PGRST000", message: "boom" } }`. One `rejects.toThrow`
  per read. Confirm the file matches the **unit** project's `testMatch` in `jest.config` (`:93-100`),
  not the integration project.
- **New (service):** `PaymentService.test.ts`:
  - in-memory payment repo whose `isProcessed` rejects → `processWebhookEvent` rejects; `FakeStripeClient` recorded no refund
  - booking repo holding a `cancelled` booking for the PI → redelivery skipped, no second booking
- **New (service):** `AccountService.test.ts`: credits repo `getCredits` rejects → `deleteAccount` rejects, `users.deleteAccount` not called.
- **New (DB-gated):** `SupabaseBookingRepository.test.ts`: two bookings (one cancelled) sharing a `stripe_payment_id` → `hasBookingForPayment` is `true` (it errors today).

## Notes / gotchas

- **User-facing effect of failing closed:** during a Supabase blip, `/api/credits`,
  `/api/my-bookings`, the channel poll and the deletion preflight return 500 instead of a wrong
  answer. Their clients already handle errors: `useUserSession` falls back to browse mode, and the
  channel poll retries. The webhook's 500 is the point, since Stripe retries for 3 days.
- `findByCancelToken` / `findByJoinToken` also fold `error` into `null`, but "invalid token" is a
  *refusal*, which already fails closed. Leave them.
- The in-memory fixtures (`InMemoryPaymentRepository`, `InMemoryBookingRepository`,
  `InMemoryCreditsRepository`) need a way to make a read reject. Add `failNext(method)` or a
  per-method `shouldFail` flag, matching `FakeCalendarClient`'s `shouldFail` style.
- `restoreCredit`'s `findUserId` now throws instead of silently "no pack". The cancel flow then
  surfaces a 500 *after* the token was consumed. That non-atomicity is P1-04's to fix. Don't paper
  over it here.
- The reconcile route catches everything into a single 500 (`reconcile-stripe/route.ts:136-142`).
  A read error now fails the run instead of reporting a false mismatch. That's intended.

## Out of scope

- Display-only reads that also drop `error`: `SupabaseSessionRepository.ts:208,216`,
  `SupabaseAuditRepository.ts:26`, `getPackSize` (`SupabaseBookingRepository.ts:565`), the `name` read
  in `getCredits` (`SupabaseCreditsRepository.ts:27`), and `listHistoryByUser`'s user lookup (`:213`).
  Wrong-but-harmless on error; fix opportunistically.
- Stripe refund idempotency (P4-01).
- Moving the reconcile route behind the service layer (P3-01).
