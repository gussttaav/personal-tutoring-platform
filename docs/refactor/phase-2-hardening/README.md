# Phase 2 — Hardening

Security-freshness and consistency fixes: make admin role revocation actually propagate,
close the rate-limiting gaps on the two odd-one-out routes, and finish the structured-logging
migration in server code. All three are small, independent tasks.

## Tasks

1. [01-admin-role-hourly-refresh.md](01-admin-role-hourly-refresh.md) — `REFACTOR-R3-P2-01` (🟠, S)
2. [02-rate-limit-cancel-zoom-token.md](02-rate-limit-cancel-zoom-token.md) — `REFACTOR-R3-P2-02` (🟡, S)
3. [03-server-console-to-log.md](03-server-console-to-log.md) — `REFACTOR-R3-P2-03` (🟡, S)

## Exit criteria

- [ ] Demoting an admin in the DB locks them out of `/admin/*` and admin APIs within ≤ 1 hour, no re-login needed
- [ ] `POST /api/cancel` 429s under burst; `zoom/token` uses `getClientIp()` + a dedicated limiter
- [ ] No server-side `console.*` outside client components and tests
- [ ] `pnpm test` + `pnpm build` green

## Relation to prior cycles

P2-01 completes cycle 2's `REFACTOR-P2-02` (admin role from DB) — the task doc
(`docs/archive/refactor-2026-05-31/phase-2-hardening/02-admin-role-from-db.md:339`)
specified an hourly re-fetch that was never shipped. P2-03 extends cycle 1's `OBS-01`.
