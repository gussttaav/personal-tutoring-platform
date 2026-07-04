# Refactor Cycle 3 — Status

**Started:** _not started_
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done

Update this file when starting, completing, or blocking a task.

---

## Phase 1 — Correctness

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [02 Slot re-check fails closed](phase-1-correctness/02-slot-recheck-fail-closed.md) | `REFACTOR-R3-P1-02` | ⬜ | _tbd_ | — |
| [03 Booking-exists idempotency gate](phase-1-correctness/03-idempotency-booking-gate.md) | `REFACTOR-R3-P1-03` | ⬜ | _tbd_ | — |
| [01 Email send() throws on failure](phase-1-correctness/01-email-send-throws.md) | `REFACTOR-R3-P1-01` | ⬜ | _tbd_ | — |

**Exit criteria**
- [ ] Forced Resend 4xx/5xx in a service test → `emailFailed: true` surfaces to the booking caller
- [ ] Forced `getAvailableSlots` throw in webhook path → route returns 500 (Stripe retries), no booking, no refund
- [ ] Simulated `markProcessed` failure + webhook redelivery → no refund issued; duplicate skipped via booking-exists gate
- [ ] `pnpm test` and `pnpm build` green

## Phase 2 — Hardening

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Admin role hourly re-fetch](phase-2-hardening/01-admin-role-hourly-refresh.md) | `REFACTOR-R3-P2-01` | ⬜ | _tbd_ | — |
| [02 Rate limits: /api/cancel + zoom/token](phase-2-hardening/02-rate-limit-cancel-zoom-token.md) | `REFACTOR-R3-P2-02` | ⬜ | _tbd_ | — |
| [03 Server console.* → log()](phase-2-hardening/03-server-console-to-log.md) | `REFACTOR-R3-P2-03` | ⬜ | _tbd_ | — |

**Exit criteria**
- [ ] Demote a test admin in DB → admin APIs reject within ≤ 1h without re-login
- [ ] `POST /api/cancel` returns 429 under burst; zoom/token uses `getClientIp()` + dedicated limiter
- [ ] `grep -rn "console\." src --include="*.ts"` (excluding client components/tests) returns nothing server-side
- [ ] `pnpm test` and `pnpm build` green

## Phase 3 — Architecture

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Extract shared week-grid module](phase-3-architecture/01-extract-week-grid.md) | `REFACTOR-R3-P3-01` | ⬜ | _tbd_ | — |
| [02 Cache ScheduleService.getConfig()](phase-3-architecture/02-schedule-config-cache.md) | `REFACTOR-R3-P3-02` | ⬜ | _tbd_ | — |
| [03 payment-confirmation/channel via service layer](phase-3-architecture/03-payment-channel-service-layer.md) | `REFACTOR-R3-P3-03` | ⬜ | _tbd_ | — |

**Exit criteria**
- [ ] Grid helpers exist exactly once; WeeklyCalendar + AvailabilityModal both consume the shared module; e2e booking flows pass
- [ ] Availability request performs ≤ 1 Supabase round-trip for schedule config on cache hit; admin edit still takes effect immediately
- [ ] No `new Stripe(` outside `src/infrastructure/stripe/` + `src/lib/stripe-client.ts`
- [ ] `pnpm test`, `pnpm test:e2e` (re-run once if a single unrelated test flakes — known issue), `pnpm build` green

## Phase 4 — Docs

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Fix CLAUDE.md drift + stale comments](phase-4-docs/01-claude-md-drift.md) | `REFACTOR-R3-P4-01` | ⬜ | _tbd_ | — |

**Exit criteria**
- [ ] CLAUDE.md matches shipped reality (users.locale, Postgres slot locks, current internal route names)
- [ ] `csrf.ts` exemption comment names only live routes

---

## Deviations from plan

_(record here as they happen)_

## Known regressions introduced

_(record here as they happen)_
