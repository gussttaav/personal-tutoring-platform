# P4-01 — Stripe idempotency keys: refunds keyed, checkout keys carry the amount

**Tag:** `REFACTOR-R4-P4-01` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Two small gaps in how the app talks to Stripe:

1. **Refunds have no idempotency key**, and the refund and its database record are separate steps.
   If `recordSlotTakenRefund` fails after Stripe issued the refund, every redelivery tries to refund
   again. Stripe answers `charge_already_refunded`, the webhook returns 500 for up to three days, and
   the student's app sits on "confirming payment" the whole time. With a key, the retry gets the
   *same* refund back and proceeds to record it.
2. **Checkout keys ignore the amount.** The 5-minute key is `pack:<email>:<size>:<window>` /
   `single:<email>:<duration>:<start>:<window>`. Stripe rejects a reused key whose parameters differ
   (`idempotency_error`). Since `PRICING-STUDENT-01`, the admin can change a student's price, and any
   price edit inside the window makes that student's checkout fail with a 500 until the window rolls
   over.

## Context

- `src/infrastructure/stripe/StripeClient.ts:22`, `:48-50`:
  ```ts
  async createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void> {
    await stripe.refunds.create(params as Parameters<typeof stripe.refunds.create>[0]);
  }
  ```
- `src/services/PaymentService.ts:472-482`: refund (`:474`), then `recordSlotTakenRefund` (`:479`),
  then broadcast. A throw at `:479` → webhook 500 → redelivery → `wasRefunded` false → refund again.
- `src/services/PaymentService.ts:133` (pack) and `:167-168` (single): keys without the amount.
  The amount comes from `pricing.getAmount(…, user?.id)` just above (`:127-130`, `:161-164`).
  `REFACTOR-P1-05` (cycle 2) introduced the keys; `PRICING-STUDENT-01` made the amount per-student
  and admin-editable.
- The checkout route turns any throw into a 500 (`src/app/api/stripe/checkout/route.ts:63-66`). After
  P1-01, domain errors are mapped, but a Stripe `idempotency_error` is still a 500.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/stripe/StripeClient.ts` | `createRefund(params, { idempotencyKey })` |
| `src/services/PaymentService.ts` | Refund key `refund:slot_taken:<pi>`; checkout keys include `amount` + `currency` |
| `src/__tests__/fixtures/FakeStripeClient.ts` | Record the refund options; emulate idempotent replay (same key → same result) |
| `src/services/__tests__/PaymentService.test.ts` | New cases |

## The change

```ts
// StripeClient
// REFACTOR-R4-P4-01: refunds are keyed like PaymentIntents (REFACTOR-P1-05), so a webhook
// retry after a failed refund-record write gets the SAME refund back instead of an error.
async createRefund(
  params: { payment_intent?: string; charge?: string; reason: "duplicate" },
  options?: { idempotencyKey?: string },
): Promise<void> {
  await stripe.refunds.create(
    params as Parameters<typeof stripe.refunds.create>[0],
    options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
  );
}
```

```ts
// PaymentService — slot-taken refund
await this.stripeClient.createRefund(
  { ...input.refundTarget, reason: "duplicate" },
  { idempotencyKey: `refund:slot_taken:${input.refundTarget.payment_intent ?? input.refundTarget.charge}` },
);
```

```ts
// PaymentService — checkout keys
// REFACTOR-R4-P4-01: the amount is part of the key. Since PRICING-STUDENT-01 it can change
// between two clicks (admin edit); an unchanged key with a changed amount is a Stripe error.
const bucket = Math.floor(Date.now() / 300_000);
const idempotencyKey = `pack:${email}:${packSize}:${amount}${currency}:${bucket}`;
// single:
const idempotencyKey = `single:${email}:${duration}:${startIso}:${amount}${currency}:${bucket}`;
```

## Acceptance criteria

- [ ] Every `stripe.refunds.create` call passes an idempotency key (`grep -rn "refunds.create" src` → one call, keyed)
- [ ] A forced `recordSlotTakenRefund` failure followed by a redelivery → the second attempt reuses the refund (fake sees the same key), records it, and the webhook returns 200
- [ ] Two checkouts inside one 5-min window with a price change between them → two distinct keys, no error
- [ ] Two checkouts inside one window with no price change → same key (double-click dedup preserved)
- [ ] File-top comment blocks carry `REFACTOR-R4-P4-01`

## Test plan

- **Existing:** `PaymentService.test.ts` refund and checkout cases green. Some assert the exact key
  string, so update them.
- **New:** `InMemoryPaymentRepository.recordSlotTakenRefund` throws once. The first
  `processWebhookEvent` rejects, the second resolves. `FakeStripeClient` saw two `createRefund` calls
  with the **same** `idempotencyKey`.
- **New:** `InMemoryPricingRepository` price changed between two `createPackCheckout` calls in the same window → the fake Stripe saw two different keys.

## Notes / gotchas

- Stripe keeps idempotency keys for 24 hours. A refund retried after that would create a **second**
  refund attempt, which Stripe rejects anyway (`charge_already_refunded`). The key fixes the
  common case (retries within minutes to hours). It isn't a substitute for recording the refund.
- Don't put the amount in the refund key. The refund amount is implicit (full) and the PI identifies it.
- `reprocessFailedBooking` can also reach the refund path. It shares `processSingleSession`, so it gets the key for free.

## Out of scope

- The 5-minute window itself (a second genuine pack purchase inside it still returns the first PI; PLAN.md → Deferred).
- Mapping Stripe errors to specific HTTP codes in the checkout route.
