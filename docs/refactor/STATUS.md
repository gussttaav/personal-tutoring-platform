# Refactor Cycle 3 — Status

**Started:** 2026-07-05
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task.

---

## Phase 1 — Correctness

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [02 Slot re-check fails closed](phase-1-correctness/02-slot-recheck-fail-closed.md) | `REFACTOR-R3-P1-02` | ✅ | Claude | local (`fix/p1-02-slot-recheck-fail-closed`) |
| [03 Booking-exists idempotency gate](phase-1-correctness/03-idempotency-booking-gate.md) | `REFACTOR-R3-P1-03` | ✅ | Claude | local (`fix/p1-03-idempotency-booking-gate`) |
| [01 Email send() throws on failure](phase-1-correctness/01-email-send-throws.md) | `REFACTOR-R3-P1-01` | ✅ | Claude | local (`refactor/p1-01-email-send-throws`) |

**Exit criteria**
- [x] Forced Resend 4xx/5xx in a service test → `emailFailed: true` surfaces to the booking caller
- [x] Forced `getAvailableSlots` throw in webhook path → route returns 500 (Stripe retries), no booking, no refund
- [ ] Simulated `markProcessed` failure + webhook redelivery → no refund issued; duplicate skipped via booking-exists gate
- [ ] `pnpm test` and `pnpm build` green

## Phase 2 — Hardening

| Task | Tag | Status | Owner | PR |
|------|-----|--------|-------|----|
| [01 Admin role hourly re-fetch](phase-2-hardening/01-admin-role-hourly-refresh.md) | `REFACTOR-R3-P2-01` | 🚫 | Gustavo | won't do — see Deviations |
| [02 Rate limits: /api/cancel + zoom/token](phase-2-hardening/02-rate-limit-cancel-zoom-token.md) | `REFACTOR-R3-P2-02` | ✅ | Gustavo | local |
| [03 Server console.* → log()](phase-2-hardening/03-server-console-to-log.md) | `REFACTOR-R3-P2-03` | ✅ | Claude | local (`refactor/p2-03-server-console-to-log`) |

**Exit criteria**
- ~~Demote a test admin in DB → admin APIs reject within ≤ 1h without re-login~~ (dropped with P2-01)
- [x] `POST /api/cancel` returns 429 under burst; zoom/token uses `getClientIp()` + dedicated limiter
- [x] `grep -rn "console\." src --include="*.ts"` (excluding client components/tests) returns nothing server-side
- [x] `pnpm test` and `pnpm build` green

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

- **P1-01:** `FakeEmailClient` did NOT gain a failure mode (task listed it conditionally). Service-level tests use `jest.Mocked<IEmailClient>` factories, and the dead-letter path imports `sendDeadLetterNotificationEmail` directly (bypasses `IEmailClient`), so failure injection uses jest mocks instead. Optional `AbortSignal.timeout` on the Resend fetch was not added.
- **P2-01: WON'T DO — the audit finding does not apply to this app.** It was implemented, then
  reverted at Gustavo's direction. The 🟠 severity assumed a multi-admin org where a hostile admin
  must be revoked quickly. This app has exactly **one admin (Gustavo, the tutor)** and **no
  role-management feature** — promotion/demotion is a manual `users.role` edit in Supabase and
  essentially never happens, so there is nobody to demote and no 30-day exposure window in practice.
  Meanwhile the hourly re-fetch would have cost one role query per hour for every *student*, none of
  whom benefit. If a leaked admin cookie ever needs revoking, the existing lever is rotating
  `AUTH_SECRET` (instant; logs everyone out).
  _Revisit only if the app ever gains multiple admins or in-app role management._
- **P1-03:** the `mockPaymentRepo` default for `markProcessed` was changed from `jest.fn()` to `jest.fn().mockResolvedValue(undefined)` so the mock matches the real async signature — the new gate calls `.catch()` on the return value (unawaited), which requires a Promise. No production behavior change.
- **P2-02:** the new rate-limit test lives at `src/app/api/cancel/__tests__/route.test.ts`, not in
  `src/__tests__/integration/` as the task md specified. That integration project holds only
  service-level tests built on in-memory repositories — it has no route/HTTP test setup — whereas
  route handlers are already tested colocated (`internal/reconcile-stripe/__tests__/route.test.ts`,
  `payment-confirmation/channel/__tests__/route.test.ts`). The task md explicitly allowed this
  fallback ("otherwise a unit test on handler ordering is enough"); the colocated test is a superset,
  covering the 6× burst → 429, per-IP keying, leftmost-hop parsing, and limiter-before-CSRF ordering.

- **P2-03:** the task's manual check (point `SUPABASE_SERVICE_ROLE_KEY` at garbage in dev, sign in,
  confirm both lines appear structured in Sentry) was **not performed** — it needs a live dev sign-in
  with real Google OAuth. Verified statically instead: `log()` is called with `service: "auth"` on both
  paths, and `src/lib/logger.ts` already routes every `"error"` level to `Sentry.captureMessage` with a
  `service` tag. No new test was added — `auth.ts` is NextAuth config with no service-layer seam, and
  the change is a like-for-like logger swap with no behavior change.

## Known regressions introduced

_(record here as they happen)_
