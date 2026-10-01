# Phase 4 — Cleanup

Two small tasks that close the cycle:

- **P4-01:** Stripe refunds get an idempotency key, so a retry after a failed refund-record write
  reuses the refund instead of erroring for three days. Checkout keys include the amount, so an admin
  price edit inside the 5-minute window stops producing a Stripe `idempotency_error`.
- **P4-02:** CLAUDE.md and a few code comments are brought in line with what shipped, including the
  conventions this cycle introduces. Without that, the next feature reintroduces what Phases 1–3
  removed.

**Order:** P4-01 after P3-01 (both touch `StripeClient`). P4-02 strictly last.

## Tasks

1. [01-stripe-idempotency-keys.md](01-stripe-idempotency-keys.md): `REFACTOR-R4-P4-01` (🟢, S)
2. [02-docs-drift.md](02-docs-drift.md): `REFACTOR-R4-P4-02` (🟢, S)

## Exit criteria

- [x] Every `refunds.create` call is keyed; checkout keys include amount + currency
- [x] CLAUDE.md describes the post-cycle-4 state (pricing overrides, 16-table deletion walk, slot validation, cancel RPC, commerce providers, icon subset, admin query layer)
- [x] No comment names QStash in the present tense, calls the crons "Vercel cron", or claims `content/` is untraced
- [x] `pnpm test`, `pnpm build` green
- [x] Ready for `/refactor-archive`

## Relation to prior cycles

- `REFACTOR-P1-05` (cycle 2) introduced the PaymentIntent keys that P4-01 extends.
- `REFACTOR-R3-P4-01` (cycle 3) was the last CLAUDE.md drift pass. P4-02 repeats it for this cycle.
