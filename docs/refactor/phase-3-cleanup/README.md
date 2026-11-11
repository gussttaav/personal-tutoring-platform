# Phase 3 — Cleanup

Four small items, three of them carried over from cycle 4's deferred list, plus the cycle's docs pass.
None of them is user-visible most of the time. Each one is wrong in one specific situation.

- **P3-01 (🟢):** availability-cache invalidation uses the UTC date of the booking's start. The cache is
  keyed by the tutor's local date, so a booking between 00:00 and 01:00/02:00 Madrid clears the
  previous day's entry and leaves its own day stale for up to 15 minutes. *(Deferred from R4.)*
- **P3-02 (🟢):** `listByUser` and `findByCancelToken` read `credit_packs.pack_size` once per booking
  instead of joining it in the main query, and the helper ignores errors. *(Deferred from R4.)*
- **P3-03 (🟢):** buying the same pack twice inside the 5-minute dedup window returns the first,
  already-paid PaymentIntent, and the second purchase fails confusingly. *(Deferred from R4.)*
- **P3-04 (🟢):** CLAUDE.md drift after this cycle.

**Order:** P3-01, P3-02 and P3-03 are independent of each other. P3-01 rebases on P2-02
(same `BookingService` neighbourhood), and P3-03 on P1-04 (same checkout method). P3-04 last.

## Tasks

1. [01-availability-invalidation-tutor-date.md](01-availability-invalidation-tutor-date.md): `REFACTOR-R5-P3-01` (🟢, S)
2. [02-pack-size-join.md](02-pack-size-join.md): `REFACTOR-R5-P3-02` (🟢, S)
3. [03-checkout-replay-succeeded-intent.md](03-checkout-replay-succeeded-intent.md): `REFACTOR-R5-P3-03` (🟢, S)
4. [04-claude-md-drift.md](04-claude-md-drift.md): `REFACTOR-R5-P3-04` (🟢, S)

## Exit criteria

- [ ] A booking, cancel or reschedule at 00:30 Madrid invalidates the Madrid date's entries (and the end's date if different)
- [ ] `listByUser` with N pack bookings: 2 queries; a pack-size read error throws instead of reading as "no pack"
- [ ] Same pack bought twice inside 5 minutes → two PaymentIntents, both payable; a double-click still → one
- [ ] CLAUDE.md matches the post-cycle code
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green

## Relation to prior cycles

P3-01 fixes the invalidation side of `REFACTOR-P3-03` (cycle 2's coalescing cache). P3-03 adds an
escape to `REFACTOR-P1-05` / `REFACTOR-R4-P4-01`'s idempotency keys without weakening their dedup.
