# Phase 1 — Correctness

Money-path fixes in `PaymentService.processSingleSession` and the email infrastructure.
All three defects were found in the post-payment webhook flow: the system can silently
fail to deliver join links (P1-01), book a student over the tutor's busy block during a
Google outage (P1-02), and refund a customer whose booking actually succeeded (P1-03).

**Recommended landing order:** P1-02 → P1-03 → P1-01. The first two are small, surgical
changes to the same function; P1-01 touches every email call site and should rebase on them.

## Tasks

1. [02-slot-recheck-fail-closed.md](02-slot-recheck-fail-closed.md) — `REFACTOR-R3-P1-02` (🟠, S)
2. [03-idempotency-booking-gate.md](03-idempotency-booking-gate.md) — `REFACTOR-R3-P1-03` (🟠, S)
3. [01-email-send-throws.md](01-email-send-throws.md) — `REFACTOR-R3-P1-01` (🟠, M)

## Exit criteria

- [ ] Forced Resend 4xx/5xx in a service test → `emailFailed: true` reaches the booking caller
- [ ] Forced `getAvailableSlots` throw in the webhook path → webhook returns 500, no booking, no refund
- [ ] Simulated `markProcessed` failure + Stripe redelivery → duplicate skipped, **no refund**
- [ ] `pnpm test` + `pnpm build` green

## Relation to prior cycles

Extends `REFACTOR-P1-02` (webhook 500-on-retryable, cycle 2) and `SINGLE-SESSION-CONFIRM-01`.
Does not touch the saga compensation list (`REFACTOR-P1-03`, cycle 2) or slot locking (`REFACTOR-P1-01`, cycle 2).
