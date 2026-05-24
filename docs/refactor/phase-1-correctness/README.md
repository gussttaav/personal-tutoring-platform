# Phase 1 — Correctness

> **Goal:** stop silent failures in payment and booking. Ship before anything else.

## Why this phase exists

Audit found three critical and two high-severity correctness bugs. None are exploitable by an attacker for direct theft, but each can cause **silent money or trust loss**:

- A user pays for a session that never gets booked, and your system thinks everything is fine.
- Two users book the same time slot; both get a Calendar invite; the tutor sees a conflict at the start of class.
- A QStash outage means a Zoom session token can be minted indefinitely after the class ends.

These cannot wait. The fixes are small, local, and well-bounded by the existing repository and service abstractions.

## Tasks in this phase

| # | Task | Severity | Files touched |
|---|------|----------|---------------|
| 01 | [Wire `acquireSlotLock` into `BookingService.createBooking`](01-wire-slot-locks.md) | 🔴 Critical | `BookingService.ts`, `IBookingRepository.ts` (already has the method), new SQL migration |
| 02 | [Stripe webhook returns 500 on retryable processing failures](02-webhook-error-handling.md) | 🔴 Critical | `api/stripe/webhook/route.ts`, `domain/errors.ts`, `PaymentService.ts` |
| 03 | [Booking saga: explicit compensation list](03-booking-saga-compensation.md) | 🔴 Critical | `BookingService.ts` |
| 04 | [QStash: propagate errors, add fallback row](04-qstash-error-propagation.md) | 🟠 High | `SchedulerClient.ts`, `BookingService.ts`, new SQL migration |
| 05 | [Stripe PaymentIntent idempotency key](05-stripe-idempotency-key.md) | 🟠 High | `StripeClient.ts`, `IStripeClient.ts`, `PaymentService.ts` |

## Dependency graph

```
01 (slot locks) ─┐
                 ├──► 03 (saga compensation)  [must come after 01]
                 │
02 (webhook 500) ─── independent
04 (QStash)      ─── independent
05 (Stripe idempotency) ─── independent
```

Tasks 01, 02, 04, 05 can be parallel PRs. Task 03 must come after 01 is merged because the compensation code wraps the slot-lock acquisition.

## Success criteria for the phase

The phase is complete when **all of these are true**:

- [ ] All 5 task PRs merged to `main`
- [ ] `pnpm test` green
- [ ] `pnpm test:e2e` green
- [ ] **Manual verification — concurrent booking race:**
  ```bash
  # Open two terminal sessions, each holding an auth cookie for a different test user
  # Both POST /api/book with identical startIso, endIso, sessionType
  # One should return 200, the other 409 (SlotUnavailableError mapped)
  ```
- [ ] **Manual verification — webhook retry:**
  ```bash
  # Use Stripe CLI to forward webhooks locally
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  # Set SUPABASE_URL to a deliberately broken value so the insert fails
  stripe trigger payment_intent.succeeded
  # Expect: 500 response; Stripe automatically retries up to 3 days
  ```
- [ ] **Manual verification — dead-letter UI:**
  - Trigger a failed booking via the steps above
  - Confirm an entry appears at `/admin/failed-bookings`
  - Reset SUPABASE_URL, click "Retry" — confirm the entry is processed and cleared

## What NOT to do in this phase

- Do not refactor `ZoomRoomSession.tsx` ("while you're there" — explicitly forbidden by CLAUDE.md)
- Do not migrate to `pino` yet — that's Phase 4
- Do not add new Stripe webhook event types — out of scope
- Do not change the database schema except for the two migrations explicitly listed in tasks 01 and 04

## After this phase

Move to Phase 2 (hardening) or start Phase 3 (performance) in parallel — they don't conflict.
