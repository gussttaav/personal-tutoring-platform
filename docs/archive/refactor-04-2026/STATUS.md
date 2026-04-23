# Refactor Status

**Started:** _(fill in date)_
**Current Phase:** 1 — Security

---

## Phase 1 — Security (Week 1–2)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 1.1 | Atomic credit decrement | ✅ Done | SEC-01 | kv.eval() Lua script; 26 tests pass |
| 1.2 | Auth gate on `/api/stripe/session` | ✅ Done | SEC-02 | Auth + ownership check added |
| 1.3 | Zoom token session-membership check | ✅ Done | SEC-03 | studentEmail in ZoomSessionRecord; membership check in token route |
| 1.4 | CSRF protection middleware | ✅ Done | SEC-04 | isValidOrigin helper; 5 tests pass; 6 routes protected |
| 1.5 | Split join token from cancel token | ✅ Done | SEC-05 | createBookingTokens + resolveJoinToken; join/cancel scoped; 32 tests pass |
| 1.6 | Fix SSE duplicate Redis client | ✅ Done | SEC-06 | Trivial one-line fix |

**Exit criteria:** All six tasks green, `npm run build` passes, no regressions in existing Jest suites.

---

## Phase 2 — Reliability (Week 3–4)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 2.1 | Replace `setTimeout` with QStash | ✅ Done | REL-01 | qstash singleton + zoom-terminate endpoint; verifySignatureAppRouter; book + webhook both schedule; 77 tests pass |
| 2.2 | Deduplicate webhook handlers | ✅ Done | REL-02 | SingleSessionInput + processSingleSession; issueRefund helper; ~100 duplicate lines removed |
| 2.3 | Dead-letter recovery endpoint | ✅ Done | REL-03 | isAdmin helper; GET list + POST retry; processSingleSession extracted to single-session.ts; ADMIN_EMAILS env var; 82 tests pass |
| 2.4 | Chat route auth + tiered rate limiting | ✅ Done | REL-04 | chatRatelimitAnon (5/min) + chatRatelimitAnonDaily (30/day); auth users keyed by email; requiresAuth flag on daily cap |
| 2.5 | Webhook async processing via `waitUntil` | ✅ Done | REL-05 | @vercel/functions waitUntil; emails deferred; KV + calendar still blocking |

**Exit criteria:** No unreliable timers in production paths, dead-letter entries recoverable via API, Gemini spend capped per anonymous IP.

---

## Phase 3 — Architecture (Week 5–8)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 3.1 | Define repository interfaces | ✅ Done | ARCH-10 | src/domain/types.ts + errors.ts + 5 repository interfaces; build + 84 tests pass |
| 3.2 | Implement Redis repository adapters | ✅ Done | ARCH-11 | 5 adapter classes under src/infrastructure/redis/; thin wrappers; 88 tests pass |
| 3.3 | Extract `CreditService` | ✅ Done | ARCH-12 | src/services/CreditService.ts; 4 routes migrated; 102 tests pass |
| 3.4 | Extract `BookingService` | ✅ Done | ARCH-13 | 3 infra adapters (google/qstash/resend); IBookingRepository extended; 3 routes thinned; 23 tests; 125 total pass |
| 3.5 | Extract `PaymentService` | ✅ Done | ARCH-14 | StripeClient abstraction; checkout/webhook/session/admin routes thinned; single-session.ts deleted; 135 tests pass |
| 3.6 | Extract `SessionService` | ✅ Done | ARCH-15 | ZoomClient abstraction; issueJoinToken/terminateSession/postChatMessage/getChatMessages; 3 routes migrated; 102 tests pass |
| 3.7 | Reorganize folder structure | ✅ Done | ARCH-16 | lib/ adapters → infrastructure/; types → domain/; ChatService + GeminiClient added; src/types/ deleted; 133 tests pass |

**Exit criteria:** Route handlers contain no business logic, services are unit-testable without HTTP mocking, all existing behavior preserved.

---

## Phase 4 — Polish (Week 9–12)

| ID | Task | Status | PR | Notes |
|----|------|--------|----|----|
| 4.1 | Supabase setup + schema migration | ✅ Done | - | migrations/0001_initial.sql; 6 tables + RLS + triggers |
| 4.2 | Supabase repository implementations | ✅ Done | DB-02 | 5 repos + client + types; migrations 0002+0003; 26 integration tests pass; 159 total |
| 4.3 | Dual-write phase (Redis + Supabase) | ✅ Done | DB-03 | 5 dual-write wrappers; ENABLE_DUAL_WRITE flag; startup check; 26 new tests; 185 total pass |
| 4.4 | Reconciliation script | ✅ Done | DB-04 | scripts/backfill.ts + scripts/reconcile.ts; tsx added; credits/bookings/audit covered |
| 4.5 | Flip primary to Supabase | ✅ Done | DB-05 | services/index.ts: 5 DualWrite args swapped; CalendarClient kv.set() → BookingService sessions.createSession(); build + 185 tests pass |
| 4.6 | Integration test suite | ✅ Done | TEST-01 | 4 integration test files; 11 fixtures (5 in-memory repos + 5 fake clients + services.ts); jest projects config; CI workflow; 24 integration + 187 unit = 211 total pass |
| 4.7 | E2E test suite (Playwright) | ✅ Done | TEST-02 | playwright.config.ts; 6 spec files; loginAs fixture via /api/test/auth bypass; chat mocked (no Gemini cost); E2E_MODE guard; e2e.yml CI workflow; build + 211 tests pass |
| 4.8 | Sentry integration | ✅ Not started | - | Error tracking + source maps |
| 4.9 | Admin dashboard | ✅ Done | ADMIN-01 | isAdmin gate; 7 pages + 4 API routes + 4 components; _data.ts for aggregate queries; 16 new tests; 231 total pass |
| 4.10 | Availability caching | ✅ Done | PERF-10 | availability-cache.ts; getCached/setCached/invalidate; tiered TTL 0/5min/15min; 5 tests; 236 total pass |

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
