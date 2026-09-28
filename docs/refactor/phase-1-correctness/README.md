# Phase 1 — Correctness

Booking and money-path defects in `BookingService`, `PaymentService` and the Supabase repositories
behind them. All four were found by following what the server actually checks versus what it trusts.

- **P1-01:** the server books whatever time window the client sends. It never checks working hours,
  the tutor's calendar, or that the window matches the session type. The paid path checks the start,
  then books the metadata's end.
- **P1-02:** the webhook's duplicate-detection reads, and the account-deletion eligibility reads,
  swallow Supabase errors and answer "nothing there". A duplicate Stripe delivery during a Postgres
  blip can refund a class that was delivered. A blip during a deletion request can erase an account
  that still holds credits.
- **P1-03:** a reschedule cancels the original booking and deletes its calendar event before the new
  booking exists. Any later failure leaves the student with neither, and the retry is refused
  because the token is spent.
- **P1-04:** cancelling a pack class restores the credit to whichever pack expires first, not the
  one it came from, in a separate write from the cancel. It reports a restore even when none
  happened.

**Recommended landing order:** P1-02 → P1-01 → P1-03 → P1-04.
- P1-02 is the smallest. It also converts `hasBookingForPayment` to a count, which P1-03 needs once
  two bookings can share a `stripe_payment_id`.
- P1-03 reuses P1-01's validator with its `ignoreEventId` option.
- P1-04 rebases on P1-03, which removes the reschedule's own credit shuffle.

## Tasks

1. [02-idempotency-reads-fail-closed.md](02-idempotency-reads-fail-closed.md): `REFACTOR-R4-P1-02` (🟠, S)
2. [01-server-side-slot-validation.md](01-server-side-slot-validation.md): `REFACTOR-R4-P1-01` (🔴, M)
3. [03-reschedule-keeps-original.md](03-reschedule-keeps-original.md): `REFACTOR-R4-P1-03` (🟠, M)
4. [04-atomic-cancel-restore-pack.md](04-atomic-cancel-restore-pack.md): `REFACTOR-R4-P1-04` (🟡, M)

## Exit criteria

- [ ] `POST /api/book` rejects an off-hours start, a busy slot, a misaligned start, and a window whose length ≠ the session type's; nothing is created and no credit is spent
- [ ] `POST /api/stripe/checkout` rejects a mismatched duration before creating a PaymentIntent; the webhook books `startIso + duration`
- [ ] `/api/book` returns 429 under burst
- [ ] Forced Supabase error in `isProcessed` / `wasRefunded` / booking-by-PI lookups during a duplicate webhook → 500, no refund
- [ ] Forced Supabase error in the user lookup during `DELETE /api/account` → 500, nothing deleted
- [ ] Forced failure after the reschedule claims the old token → old booking `confirmed` again, cancel link works, calendar event intact
- [ ] Pack class cancel: credit returns to `bookings.credit_pack_id`'s pack atomically with the status change; `creditsRestored` truthful
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; e2e `booking-*`, `cancellation`, `reschedule` specs green

## Relation to prior cycles

Builds on cycle 2's slot locks (`REFACTOR-P1-01`) and saga (`REFACTOR-P1-03`), and on cycle 3's
fail-closed re-check (`REFACTOR-R3-P1-02`) and booking-exists gate (`REFACTOR-R3-P1-03`). None of those
is reverted. P1-03 reverses one explicitly *accepted* limitation of cycle 2's saga (partial
reschedule rollback), because the premise it was accepted on doesn't hold.
