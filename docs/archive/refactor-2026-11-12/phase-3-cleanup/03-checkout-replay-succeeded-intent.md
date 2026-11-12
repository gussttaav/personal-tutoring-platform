# P3-03 — Checkout never hands back a paid PaymentIntent

**Tag:** `REFACTOR-R5-P3-03` · **Severity:** 🟢 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

Both checkout methods create the PaymentIntent under an idempotency key bucketed by 5 minutes
(`REFACTOR-P1-05`, extended by `REFACTOR-R4-P4-01`), so a double-click doesn't mint two. The side
effect: a student who completes a 5-class pack purchase and then, inside the same 5-minute bucket,
buys **another** 5-class pack gets the first, already `succeeded` PaymentIntent back. The
PaymentElement can't confirm it, the purchase fails with a generic error, and nothing is charged.
Same for a second single-session checkout of the same slot and duration (rarer). Fix it
server-side: if the idempotent create returns an intent that is no longer payable, create a fresh
one under a suffixed key. Double-click dedup is untouched, because an in-flight intent is still
`requires_payment_method`. *(Deferred from R4.)*

## Context

- `src/services/PaymentService.ts:195-226`: `createPackCheckout`, key `pack:${email}:${packSize}:${amount}${currency}:${bucket}` (`:210-211`).
- `src/services/PaymentService.ts:228-272`: `createSingleSessionCheckout`, key `single:${email}:${duration}:${startIso}:${amount}${currency}:${bucket}${sourceKey}` (`:247-253`).
- `src/infrastructure/stripe/StripeClient.ts:43-46`: `createPaymentIntent` returns the full `Stripe.PaymentIntent`, so `status` is available.
- `src/__tests__/fixtures/FakeStripeClient.ts:59-80`: replays by key, and **creates intents as `succeeded`** (`:71`). That fixture default matters for the tests below.
- Clients: `src/components/PackModal.tsx:58` and `src/features/booking/InteractiveShell.tsx:271-274` (pack); `SingleSessionBooking.tsx:377` (single). The mobile app hits the same route.

## Files affected

| File | Change |
|------|--------|
| `src/services/PaymentService.ts` | Private `createPayableIntent(params, key)` used by both checkouts |
| `src/__tests__/fixtures/FakeStripeClient.ts` | New intents start `requires_payment_method`; a `succeed(id)` helper (or keep `succeeded` and add an option, see Gotchas) |
| `src/services/__tests__/PaymentService.test.ts` | Replay of a succeeded intent → a new one; a pending replay → the same one |

## The change

```ts
// REFACTOR-R5-P3-03: the 5-min idempotency bucket dedups a double-click, but it also replays
// a PaymentIntent the student already PAID — a second purchase inside the window got the
// first, unconfirmable intent back. Only a still-payable intent is reused.
const PAYABLE = new Set(["requires_payment_method", "requires_confirmation", "requires_action"]);

private async createPayableIntent(
  params: Stripe.PaymentIntentCreateParams,
  idempotencyKey: string,
): Promise<Stripe.PaymentIntent> {
  const intent = await this.stripeClient.createPaymentIntent(params, { idempotencyKey });
  if (PAYABLE.has(intent.status)) return intent;
  log("info", "Idempotent checkout replayed a non-payable intent; creating a fresh one", {
    service: "payment", paymentIntentId: intent.id, status: intent.status,
  });
  return this.stripeClient.createPaymentIntent(params, { idempotencyKey: `${idempotencyKey}:after:${intent.id}` });
}
```

The suffix keys on the replayed intent's id, so a third purchase in the same window replays the
*second* key, gets the second (now succeeded) intent, and suffixes again from it. Every purchase
gets its own key, and a double-click on any of them still dedups.

## Acceptance criteria

- [x] Pack: key replays a `succeeded` intent → a second, distinct, payable intent is returned
- [x] Pack: key replays a `requires_payment_method` intent → the same intent (double-click dedup kept)
- [x] Single session: same two behaviours
- [x] `processing` and `canceled` count as non-payable (fresh intent); `requires_capture` can't occur (automatic capture) and is treated as non-payable
- [x] File-top block carries `REFACTOR-R5-P3-03`

## Test plan

- **Existing:** `PaymentService.test.ts` checkout cases (dedup inside the window, new key after the window, amount in key), `src/__tests__/integration/payment.test.ts`.
- **New (service):** the four acceptance cases using `FakeStripeClient`.
- **Manual (Stripe test mode, optional):** buy pack 5 with `4242…`, then buy pack 5 again straight away → the second payment completes, and two `credit_packs` rows exist on the test DB.

## Notes / gotchas

- **FakeStripeClient creates `succeeded` intents today.** Flipping the default to `requires_payment_method`
  can break tests that assume an intent is already paid (the webhook, `getConfirmedPayment`, the
  channel state). Grep `FakeStripeClient` usages first. If the blast radius is large, add a
  constructor option `{ initialStatus }` instead, and use it only in the new tests.
- Stripe keeps idempotency keys 24 h. A suffixed key is a new key, with no conflict with the
  original's parameters.
- A failed card attempt leaves the intent `requires_payment_method`, which is payable, so it's
  reused. That's correct: a retry with another card should confirm the same intent.

## Out of scope

- Client-side purchase nonces.
- Changing the 5-minute window.
