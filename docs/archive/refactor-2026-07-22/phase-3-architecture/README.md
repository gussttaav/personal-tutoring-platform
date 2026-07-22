# Phase 3 — Architecture

Structural debt introduced by this half-year's feature growth: the availability-modal branch
duplicated the week-grid implementation wholesale (P3-01), the admin-editable schedule made
`getConfig()` a hot-path double-query with no cache (P3-02), and the single-session
confirmation surface put Stripe calls + business logic directly in a route handler (P3-03).

P3-01 is the big one (L effort) and is pure frontend; it can run in parallel with Phases 1–2.
P3-02 and P3-03 are backend and independent of each other.

## Tasks

1. [01-extract-week-grid.md](01-extract-week-grid.md) — `REFACTOR-R3-P3-01` (🟠, L)
2. [02-schedule-config-cache.md](02-schedule-config-cache.md) — `REFACTOR-R3-P3-02` (🟡, M)
3. [03-payment-channel-service-layer.md](03-payment-channel-service-layer.md) — `REFACTOR-R3-P3-03` (🟡, M)

## Exit criteria

- [ ] Every week-grid helper exists exactly once; `WeeklyCalendar.tsx` and `AvailabilityModal.tsx` both consume the shared module; both e2e booking paths pass
- [ ] Availability request costs ≤ 1 Supabase round-trip for schedule config on a warm cache; admin schedule edits still take effect immediately
- [ ] `grep -rn "new Stripe(" src` matches only `src/infrastructure/stripe/` and `src/lib/stripe-client.ts`
- [ ] `pnpm test`, `pnpm test:e2e`, `pnpm build` green

## Relation to prior cycles

P3-02 builds on cycle 2's `REFACTOR-P3-03` availability-cache versioning (`bumpScheduleVersion`).
P3-03 finishes what `ARCH-14` (route handlers as thin adapters) started but the
`SINGLE-SESSION-CONFIRM-01` channel route skipped.
