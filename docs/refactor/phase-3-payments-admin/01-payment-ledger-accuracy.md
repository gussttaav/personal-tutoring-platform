# P3-01 — Payment ledger accuracy

**Tag:** `REFACTOR-R4-P3-01` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Two gaps in the bookkeeping around Stripe payments:

1. **The reconciliation cron cries wolf.** A single-session PaymentIntent refunded because its slot
   was taken is recorded in `single_session_refunds` (migration `0014`), but the cron doesn't count
   that as "handled". Every slot-taken refund logs a Sentry error on the next two daily runs, which
   trains everyone to ignore the alarm that exists to catch real losses. The cron is also the last
   place that calls the `stripe` singleton directly from a route handler, and it holds all its logic
   in the route.
2. **Dead-letter retries never record the payment.** `reprocessFailedBooking` builds its input
   without `amountCents`/`currency`, and `recordPaymentRow` skips when the amount is missing. A
   booking recovered from `/admin/failed-bookings` never appears in `/admin/payments`, in the 30-day
   revenue figure, or as a price in the student's history.

Move reconciliation into `PaymentService` behind `IStripeClient`, count refunds as proof, and carry
the charged amount through the retry.

## Context

- `src/app/api/internal/reconcile-stripe/route.ts:26-31`: imports `stripe` from
  `@/infrastructure/stripe/client-singleton` and three repositories directly. All logic is at
  `:47-143`, paging `stripe.paymentIntents.list` (`:60-64`).
- `:85-93`, single-session proof:
  ```ts
  const handled =
    (await supabaseBookingRepository.hasBookingForPayment(pi.id)) ||
    (await supabasePaymentRepository.hasFailedBooking(pi.id)) ||
    (await supabasePaymentRepository.isProcessed(pi.id));
  ```
  The slot-taken path (`PaymentService.ts:472-482`) refunds and calls `recordSlotTakenRefund` but
  never `markProcessed`, so none of the three is true for it. The PI's `status` stays `succeeded`
  after a refund, so the cron keeps checking it.
- `REFACTOR-R3-P3-03` moved the payment-channel route behind `IStripeClient`. The cron was out of its scope.
- `src/services/PaymentService.ts:317-339`, `reprocessFailedBooking` builds `SingleSessionInput`
  without `amountCents`/`currency` (compare the webhook branches at `:242-253` and `:287-298`, which
  pass `intent.amount` / `session.amount_total`).
- `src/services/PaymentService.ts:566-567`:
  ```ts
  // Legacy checkout.session events may lack amount_total; nothing to record then.
  if (params.amountCents == null) return;
  ```
- Readers of `payments`: `src/app/[locale]/admin/_data.ts:56-64` (`sumRevenueLast30Days`), `:247-268`
  (`fetchPayments`), and `src/infrastructure/supabase/booking-history.ts:58-80` (`deriveAmount`).

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/stripe/StripeClient.ts` | `IStripeClient.listPaymentIntents({ createdGte, startingAfter?, limit })` |
| `src/services/PaymentService.ts` | `reconcileRecentPayments()`; refund-aware single proof; `reprocessFailedBooking` passes amount + currency |
| `src/app/api/internal/reconcile-stripe/route.ts` | Thin: CRON_SECRET → service → log + JSON. No infrastructure imports |
| `src/__tests__/fixtures/FakeStripeClient.ts` | `listPaymentIntents` over a seeded array |
| `src/services/__tests__/PaymentService.test.ts` | Reconcile matrix; retry records the payment row |

## The change

```ts
// IStripeClient
listPaymentIntents(params: {
  createdGte:     number;          // unix seconds
  startingAfter?: string;
  limit:          number;
}): Promise<{ data: Stripe.PaymentIntent[]; hasMore: boolean }>;
```

```ts
// PaymentService
// REFACTOR-R4-P3-01: moved from the reconcile route (which called the stripe singleton and
// three repositories directly). A slot-taken refund is now proof of handling.
async reconcileRecentPayments(opts: { lookbackHours: number; pageSize: number; maxPages: number }):
  Promise<{ scanned: number; mismatches: ReconcileMismatch[]; hitPageCap: boolean }> {
  // …paging loop from route.ts:59-103, via this.stripeClient.listPaymentIntents…
  // single-session proof:
  const handled =
    (await this.bookings.hasBookingForPayment(pi.id)) ||      // P1-02 delegate
    (await this.paymentRepo.wasRefunded(pi.id))       ||      // NEW
    (await this.paymentRepo.hasFailedBooking(pi.id))  ||
    (await this.paymentRepo.isProcessed(pi.id));
}
```

```ts
// reprocessFailedBooking — both branches
input = {
  /* …existing fields… */
  amountCents: intent.amount,            // checkout branch: checkout.amount_total
  currency:    intent.currency,          // checkout branch: checkout.currency
};
```

The route keeps its auth header check, `LOOKBACK_HOURS`/`PAGE_SIZE`/`MAX_PAGES` constants, the
`error`-level Sentry log for mismatches, the page-cap `warn`, and its response body shape
(`{ scanned, mismatches, details }`). Only where the work happens changes.

## Acceptance criteria

- [ ] A succeeded single PI with a `single_session_refunds` row → **not** a mismatch
- [ ] Existing proofs unchanged: pack → `credit_packs` row; single → booking / dead-letter / processed marker; unknown type → processed marker
- [ ] `grep -rn "client-singleton\|@/infrastructure/supabase\"" src/app/api/internal/reconcile-stripe` → nothing
- [ ] Cron response body and log lines keep their current shape (cron-job.org monitors it)
- [ ] Retrying a dead-lettered PI booking writes a `payments` row with the PI's `amount` and `currency`; retrying a legacy Checkout Session uses `amount_total` (skipped only if Stripe has none)
- [ ] File-top comment blocks carry `REFACTOR-R4-P3-01`

## Test plan

- **Existing:** `PaymentService.test.ts` dead-letter retry cases green.
- **New (service):** reconcile matrix using `FakeStripeClient.listPaymentIntents` + in-memory repos:
  - pack with / without credit pack
  - single with booking / refund / dead-letter / marker / none
  - unknown type
  - pagination across two pages
  - page-cap flag
- **New (service):** `reprocessFailedBooking` for a `pi_…` id → `InMemoryPaymentRepository` holds a
  payments row with the fake intent's amount.
- **Manual:** call the cron locally with the `Authorization: Bearer $CRON_SECRET` header against the
  test Stripe account. Same body shape as before.

## Notes / gotchas

- **Backfill (optional, one-off).** Bookings already recovered through the admin retry have no
  `payments` row. To find them:
  `SELECT b.stripe_payment_id FROM bookings b LEFT JOIN payments p ON p.stripe_payment_id = b.stripe_payment_id WHERE b.stripe_payment_id IS NOT NULL AND p.stripe_payment_id IS NULL;`
  Backfilling means fetching each PI's amount from Stripe. That's a manual admin step. Record in the
  PR whether it was done.
- `recordPaymentRow` stays best-effort (`:554-583`). A failed insert must not fail the retry.
- After P1-02 the repository reads throw on error, so a Supabase blip fails the whole cron run (500)
  instead of producing false mismatches. The route's catch-all already logs and returns 500.
- Keep `LOOKBACK_HOURS = 48`. A refund reaching the cron after 48 h can't produce a false mismatch anyway.

## Out of scope

- Moving the session-cleanup cron's direct repository import (`session-cleanup/route.ts:13`) into a service. Same smell, no correctness issue.
- A reconciliation UI in the admin panel.
- Refund idempotency keys (P4-01).
