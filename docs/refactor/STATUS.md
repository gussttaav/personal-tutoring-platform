# Refactor Status

**Started:** _(fill in date)_
**Current Phase:** 1 — Security

---

## Phase 1 — Security (Week 1–2)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 1.1 | Atomic credit decrement | ⬜ Not started | - | Requires Upstash EVAL verification |
| 1.2 | Auth gate on `/api/stripe/session` | ⬜ Not started | - | - |
| 1.3 | Zoom token session-membership check | ⬜ Not started | - | Touches `calendar.ts` + `zoom.ts` + route |
| 1.4 | CSRF protection middleware | ⬜ Not started | - | Exempt the Stripe webhook route |
| 1.5 | Split join token from cancel token | ⬜ Not started | - | Requires email template update |
| 1.6 | Fix SSE duplicate Redis client | ✅ Done | - | Trivial one-line fix |

**Exit criteria:** All six tasks green, `npm run build` passes, no regressions in existing Jest suites.

---

## Phase 2 — Reliability (Week 3–4)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 2.1 | Replace `setTimeout` with QStash | ⬜ Not started | - | Requires QSTASH_TOKEN env var |
| 2.2 | Deduplicate webhook handlers | ⬜ Not started | - | Extract shared function |
| 2.3 | Dead-letter recovery endpoint | ⬜ Not started | - | Protected admin route |
| 2.4 | Chat route auth + tiered rate limiting | ⬜ Not started | - | Keep unauthenticated access |
| 2.5 | Webhook async processing via `waitUntil` | ⬜ Not started | - | Interim before QStash |

**Exit criteria:** No unreliable timers in production paths, dead-letter entries recoverable via API, Gemini spend capped per anonymous IP.

---

## Phase 3 — Architecture (Week 5–8)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 3.1 | Define repository interfaces | ⬜ Not started | - | Pure types, no implementation |
| 3.2 | Implement Redis repository adapters | ⬜ Not started | - | Wrap existing `kv.ts` |
| 3.3 | Extract `CreditService` | ⬜ Not started | - | Move logic out of routes |
| 3.4 | Extract `BookingService` | ⬜ Not started | - | Orchestrates 4+ external systems |
| 3.5 | Extract `PaymentService` | ⬜ Not started | - | Webhook processing lives here |
| 3.6 | Extract `SessionService` | ⬜ Not started | - | Zoom lifecycle management |
| 3.7 | Reorganize folder structure | ⬜ Not started | - | Move files into domain/services/infrastructure |

**Exit criteria:** Route handlers contain no business logic, services are unit-testable without HTTP mocking, all existing behavior preserved.

---

## Phase 4 — Polish (Week 9–12)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 4.1 | Supabase setup + schema migration | ⬜ Not started | - | Use SQL from PLAN.md §4 |
| 4.2 | Supabase repository implementations | ⬜ Not started | - | Same interfaces as Redis repos |
| 4.3 | Dual-write phase (Redis + Supabase) | ⬜ Not started | - | Run 2–4 weeks |
| 4.4 | Reconciliation script | ⬜ Not started | - | Daily cron to compare stores |
| 4.5 | Flip primary to Supabase | ⬜ Not started | - | After reconciliation is clean |
| 4.6 | Integration test suite | ⬜ Not started | - | Booking flow + payment flow |
| 4.7 | E2E test suite (Playwright) | ⬜ Not started | - | Critical user journeys |
| 4.8 | Sentry integration | ⬜ Not started | - | Error tracking + source maps |
| 4.9 | Admin dashboard | ⬜ Not started | - | Protected by TUTOR_EMAIL check |
| 4.10 | Availability caching | ⬜ Not started | - | Tiered TTLs by date distance |

**Exit criteria:** Supabase is primary source of truth for persistent data, Redis remains for rate limiting + ephemeral state, test coverage ≥ 70% on services layer.

---

## Completed Tasks Log

_(Move tasks here as they are completed, with PR link and date)_

---

## Discovered Issues (Backlog)

_(Add new issues found during refactor here — do NOT expand current phase to address them)_

---

## Legend

- ⬜ Not started
- 🟡 In progress
- 🔵 In review
- ✅ Done
- ❌ Blocked
