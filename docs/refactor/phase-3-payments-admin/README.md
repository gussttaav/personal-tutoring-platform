# Phase 3 — Payments & Admin

Bookkeeping and admin tooling. Nothing here loses a student's money directly. It's about the
tutor's records being right and reachable:

- **P3-01:** the Stripe reconciliation cron reports every slot-taken refund as a Sentry error (it
  doesn't know about `single_session_refunds`), and it's the last route calling the `stripe` singleton
  directly. Separately, retrying a dead-lettered booking never writes its `payments` row, so revenue
  and history under-report.
- **P3-02:** `/admin/students` silently shows only the first 100 users by email. Since course
  sign-ins, that hides real students, and it's the only way into credit adjustments and per-student
  pricing. The low-credit metric counts every course reader. The admin reads live in a raw-Supabase
  module under `app/` that API routes import. Two admin POSTs skip the CSRF check, and the credit
  debit swallows its own failure.

**Order:** after Phase 1.
- P3-01 edits `PaymentService.reprocessFailedBooking`, next to Phase 1's webhook changes, and uses P1-02's `hasBookingForPayment` delegate.
- P3-02's credit adjust uses the `CreditService` shape after P1-04.
- P3-01 and P3-02 are independent of each other.

## Tasks

1. [01-payment-ledger-accuracy.md](01-payment-ledger-accuracy.md): `REFACTOR-R4-P3-01` (🟡, M)
2. [02-admin-students-area.md](02-admin-students-area.md): `REFACTOR-R4-P3-02` (🟡, L)

## Exit criteria

- [ ] Slot-taken refund in the lookback window → no reconcile mismatch; no route handler imports the `stripe` singleton
- [ ] Dead-letter retry of a PaymentIntent writes a `payments` row with the charged amount
- [ ] A student past #100 by email is findable in `/admin/students`; the low-credit count covers students only
- [ ] `src/app/[locale]/admin/_data.ts` removed; admin reads go through `AdminService` → `IAdminQueryRepository`
- [ ] Every admin POST/PATCH calls `isValidOrigin`; a debit larger than the balance reports what was applied
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; migrations `0024` applied to the test DB

## Relation to prior cycles

- `REFACTOR-P4-01` (cycle 2) created the reconciliation cron. P3-01 keeps its contract (auth header, response body, log levels) and fixes its proof rules.
- `REFACTOR-R3-P3-03` put the payment-channel route behind `IStripeClient`. P3-01 finishes the job for the cron.
- `PAYMENTS-AUDIT-01` introduced the `payments` rows. P3-01 closes the dead-letter gap in them.
- `ADMIN-01` built the admin panel and `_data.ts`. P3-02 moves it into the repository pattern CLAUDE.md prescribes.
- `REFACTOR-R3-P2-01` (admin role re-fetch, **won't do**) is not reopened. The CSRF work in P3-02 is convention and defence in depth.
