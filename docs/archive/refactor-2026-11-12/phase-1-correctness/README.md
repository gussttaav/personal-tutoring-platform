# Phase 1 — Correctness

Four gaps in the booking and payment paths, in `BookingService.createBooking`,
`PaymentService.processSingleSession` and the checkout. Each one comes from a check the server
assumes rather than makes.

- **P1-01 (🟠):** a reschedule token is HMAC-bound to its owner's email, but `createBooking` never
  compares that email with the signed-in user's. Opening a reschedule link while signed in with
  another account moves the class to that account. A pack class's credit goes with it.
- **P1-02 (🟠):** `markProcessed` runs inside the same `try` as `createBooking`. If it throws after
  the booking committed, the webhook dead-letters a booked class, emails the admin a failure and
  tells the student's screen `failed`. *(Deferred from R4.)*
- **P1-03 (🟢):** the one-free-call cap is a read followed by a write. Two concurrent requests for
  different slots both pass it. There are now two entry points: the wizard and the chat card.
- **P1-04 (🟢):** paid checkout still accepts `rescheduleToken`, though no client sends it. A crafted
  request pays for a "reschedule" that the webhook's freebusy re-check then refunds, because it sees
  the original's own event.

**Recommended landing order:** P1-02 → P1-01 → P1-04 → P1-03.
- P1-02 is isolated (one method in `PaymentService`).
- P1-01 adds the owner check that P1-04's tests can then assume.
- P1-03 carries migration `0029`. Doing it last keeps the test-DB migration step to one point.

## Tasks

1. [02-mark-processed-after-commit.md](02-mark-processed-after-commit.md): `REFACTOR-R5-P1-02` (🟠, S)
2. [01-reschedule-token-owner.md](01-reschedule-token-owner.md): `REFACTOR-R5-P1-01` (🟠, S)
3. [04-checkout-refuses-reschedule-token.md](04-checkout-refuses-reschedule-token.md): `REFACTOR-R5-P1-04` (🟢, S)
4. [03-free-call-unique-index.md](03-free-call-unique-index.md): `REFACTOR-R5-P1-03` (🟢, S)

## Exit criteria

- [ ] `POST /api/book` with another account's reschedule token → 403 `RESCHEDULE_NOT_OWNER`; the token is not consumed, and the original booking, calendar event and Zoom session are intact
- [ ] Webhook: `markProcessed` rejecting after a committed `createBooking` → no dead-letter, no admin failure email, `payments` row recorded, `confirmed` broadcast, 200
- [ ] Two concurrent `free15min` bookings for one user → one 200, one 409 `FREE_SESSION_ALREADY_USED`, and the loser's calendar event compensated away
- [ ] A free-call **reschedule** still works with the index in place (the original is `cancelled` before the new row is inserted)
- [ ] `POST /api/stripe/checkout` with `rescheduleToken` set → 400 `INVALID_REQUEST`, and no PaymentIntent
- [ ] `0029` applied to the test DB and `types.ts` unchanged (an index adds no types)
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; e2e `booking-*` and `reschedule` specs green (ask before running: they truncate the test DB)

## Relation to prior cycles

Builds on `SEC-05` (cancel token = HMAC over `eventId:email:startsAt`), `REFACTOR-R4-P1-03` (the
reschedule claim and its compensation), `REFACTOR-R4-P1-01` (the free-call cap, confirmed by
Gustavo on 2026-10-01) and `REFACTOR-R3-P1-03` / `REFACTOR-R4-P1-02` (the booking-exists gate that
heals a missing processed marker). None of them is reverted.
