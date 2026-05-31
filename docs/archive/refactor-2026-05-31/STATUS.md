# Refactor Status

> Living document. Update this when starting, completing, or blocking a task.
> See `PLAN.md` for context on the whole effort.

**Last updated:** 2026-05-29 (P3-02 complete)
**Current focus:** Phase 3 — Performance
**Blocking:** _(none)_

---

## Legend

- ⬜ Not started
- 🟦 In progress
- ✅ Done (merged to main)
- ⏸ Blocked (see notes)
- ❌ Cancelled / superseded

---

## Phase 1 — Correctness

> Goal: stop silent failures in payment and booking. **Ship these first.**

| Status | # | Task | Owner | PR | Notes |
|--------|---|------|-------|----|----|
| ✅ | 01 | [Wire `acquireSlotLock` into `BookingService.createBooking`](phase-1-correctness/01-wire-slot-locks.md) | gussttaav | local | All 45 tests pass; migration 0005 created |
| ✅ | 02 | [Stripe webhook returns 500 on retryable processing failures](phase-1-correctness/02-webhook-error-handling.md) | gussttaav | local | Removed waitUntil; added PermanentWebhookError; all silent returns replaced with throws; writeDeadLetter rethrows; 25 new/updated tests pass |
| ✅ | 03 | [Booking saga: explicit compensation list](phase-1-correctness/03-booking-saga-compensation.md) | gussttaav | local | Removed `recordRescheduleFailure` dead-letter (compensation framework replaces it); booking insert now before QStash |
| ✅ | 04 | [QStash: propagate errors, add fallback row](phase-1-correctness/04-qstash-error-propagation.md) | gussttaav | local | SchedulerClient propagates errors; BookingService catches and writes pending_terminations; fallback cron at /api/internal/zoom-terminate-fallback; vercel.json cron registered; 4 new tests; 222 total pass. **Deviation:** QStash removed entirely post-merge — scheduler abstraction deleted, `pending_terminations` written on every booking (not only on failure), zoom-terminate endpoint deleted, fallback renamed to `/api/internal/session-cleanup`; update cron-job.org URL manually. 220 tests pass. |
| ✅ | 05 | [Stripe PaymentIntent idempotency key](phase-1-correctness/05-stripe-idempotency-key.md) | gussttaav | local | `CreatePaymentIntentOptions` added to interface; 5-min window keys in both checkout methods; FakeStripeClient deduplicates; 3 new tests; 223 total pass |

**Phase 1 exit criteria:**
- [ ] All 5 tasks merged
- [ ] `pnpm test` and `pnpm test:e2e` green on main
- [ ] Manually verified: two concurrent `POST /api/book` for same slot — only one succeeds (other gets 409)
- [ ] Manually verified: Stripe CLI `stripe trigger payment_intent.succeeded` with a forced DB error returns 500, retried by Stripe
- [ ] Dead-letter queue (`failed_bookings`) has at least 1 test entry that can be replayed via admin UI

---

## Phase 2 — Hardening

> Goal: defense in depth — RLS, admin via DB, AI trust boundary, idempotency hardening.

| Status | # | Task | Owner | PR | Notes |
|--------|---|------|-------|----|----|
| ✅ | 01 | [Define explicit RLS policies (deny-anon)](phase-2-hardening/01-rls-policies.md) | gussttaav | local | Migration 0007 created; supabase/README.md updated with RLS strategy; 223 tests pass. Manual anon-key verification required after `supabase db push`. |
| ✅ | 02 | [Move admin check to `users.role` column](phase-2-hardening/02-admin-role-from-db.md) | gussttaav | local | `users.role` is source of truth; ADMIN_EMAILS bootstrap only; JWT refreshes role hourly; 225 tests pass. |
| ✅ | 03 | [Gemini history server-side + token-budget + spend cap](phase-2-hardening/03-gemini-history-trust-boundary.md) | gussttaav | local | History moved to Redis (chat:hist:{sessionId}); daily spend cap (20k req/day); client updated to localStorage sessionId; Gemini context caching implemented in api.ts (300 s TTL, fallback to inline). 235 tests pass. |
| ✅ | 04 | [CSRF defense in depth (`Sec-Fetch-Site`)](phase-2-hardening/04-csrf-defense-in-depth.md) | gussttaav | local | `Sec-Fetch-Site: cross-site` denied before Origin check; 6 new tests; 11 total pass in csrf.test.ts. |
| ✅ | 05 | [Zoom JWT lifetime matches session duration](phase-2-hardening/05-zoom-jwt-lifetime.md) | gussttaav | local | `durationSeconds` computed from session end + 30-min buffer, capped 4 h / floored 10 min; `expiresAt` aligned with JWT exp; 3 new tests, 12 total pass in SessionService.test.ts. |

**Phase 2 exit criteria:**
- [ ] All 5 tasks merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] RLS policies tested: an unprivileged JWT against Supabase REST is rejected on every table
- [ ] Toggling a user's `role` to `'admin'` in the DB grants access within 1 hour without re-login
- [ ] Chat: client-supplied history is ignored — verified by sending fake `{role: "model"}` turns

---

## Phase 3 — Performance

> Goal: kill N+1 queries, replace SSE polling with Realtime, fix the missing membership check.

| Status | # | Task | Owner | PR | Notes |
|--------|---|------|-------|----|----|
| ✅ | 01 | [Replace `/api/chat-session` SSE polling with Supabase Realtime](phase-3-performance/01-replace-sse-with-realtime.md) | gussttaav | local | SSE GET handler removed; new `/api/chat-session/channel` returns `{ channelName, initialMessages }`; `SessionService.postChatMessage` broadcasts after persistence (best-effort); `useSessionChatStream` rewritten to subscribe via `supabase-browser` while preserving the existing public API (so `ZoomRoomSession.tsx` is untouched); `REALTIME_CHANNEL_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` added to startup-checks and `.env.example`; CSP `connect-src` extended with `wss://*.supabase.co`. 257 tests pass. **Deviations:** (1) task doc's `pnpm test:e2e e2e/chat.spec.ts` line is misleading — that file tests the AI chat widget, not session chat; e2e coverage for session chat is manual. (2) `pnpm build` blocked locally by Node 18 (Next 16 requires ≥20); typecheck (`tsc --noEmit`) is clean. |
| ✅ | 02 | [Fix `SupabaseSessionRepository` N+1 on `zoom_session_id` resolution](phase-3-performance/02-session-repository-n1.md) | gussttaav | local | Added `resolveZoomSessionId` (single PostgREST embedded join) + `appendChatMessageById`/`listChatMessagesById`/`countChatMessagesById`; eventId-based chat methods kept as thin wrappers (resolve once → delegate). `SessionService.postChatMessage`/`getChatMessages` resolve once and thread the id. `findZoomSessionId` left in place (still used by `deleteByEventId`/`markStudentJoined`, out of scope). Query-count tests: post ≤4, get ≤3, old re-resolving methods asserted not-called. 259 tests pass; `tsc --noEmit` + lint clean (`pnpm build` blocked by Node 18 per P3-01). |
| ✅ | 03 | [Availability cache: request coalescing + `decrement_credit` returns `pack_size`](phase-3-performance/03-availability-cache-coalescing.md) | gussttaav | local | `getOrCompute(key, compute, ttlSec)` added to `availability-cache.ts` (first caller takes a 10s Redis `SET NX` lock; losers wait 250ms and re-read; falls through to compute if lock fails; ttl 0 short-circuits to bare compute — preserves the near-term no-cache window). `/api/availability` GET now builds key+ttl from existing `cacheKey()`/`cacheTTLSeconds()` and calls `getOrCompute` (the "cache miss" log moved into the compute closure). `decrement_credit` SQL now returns `pack_size`; `DecrementResult` added to `ICreditsRepository`; Supabase impl + in-memory fixture map it through; `CreditService.useCredit` returns `{ remaining, packSize }`; `BookingService.createBooking` reads `packSize` from `useCredit` and drops the extra `getBalance` (−1 DB query per pack booking). 255 unit + 24 integration tests pass (4 new coalescing tests + packSize assertions); `tsc --noEmit` + lint clean (`pnpm build` blocked by Node 18 per P3-01). **Deviations:** (1) migration is `0009_decrement_credit_pack_size.sql`, not the task's `0008` — `0008_zoom_sessions_student_joined_at.sql` already exists. (2) `getOrCompute` uses the existing bare-key namespace (`avail:{date}:{duration}`) + `cacheTTLSeconds`, not the md's generic `cache:{key}` wrapper (md said to harmonize). (3) the old explicit "cache hit" log line and the `cached: true` response flag were dropped (no consumer reads `.cached`). |
| ✅ | 04 | [Chat membership check in `SessionService.getChatMessages`](phase-3-performance/04-chat-membership-check.md) | gussttaav | local | `getChatMessages` now runs the same participant check as `postChatMessage`/`issueJoinToken` (tutor or assigned student; legacy null-`studentEmail` records = tutor only; emails compared case-insensitively): throws `BookingNotFoundError` for unknown eventId, `UnauthorizedError` otherwise (logged). Route `/api/chat-session/channel` already maps these to 404/403 (from P3-01). 5 new tests; 264 total pass; `tsc --noEmit` + lint clean (`pnpm build` blocked by Node 18 per P3-01). **Deviations:** (1) inline check kept rather than extracting the optional `assertParticipant` helper — avoids refactoring `issueJoinToken`/`postChatMessage` (out of scope). (2) membership check adds one `findByEventId` call, so `getChatMessages` is now 4 DB queries, not 3 (P3-02's query-count test updated from ≤3 to ≤4; N+1 guarantee — single `resolveZoomSessionId`, no old eventId-based methods — still asserted). The phase exit criterion "≤ 3 over the connection lifetime" should account for this membership read. |

| ✅ | 05 | [Replace `/api/sse` payment-confirmation SSE polling with Supabase Realtime](phase-3-performance/05-replace-payment-sse-with-realtime.md) | gussttaav | local | `paymentChannelName` added to `realtime-channel.ts` (reuses `REALTIME_CHANNEL_SECRET`, `pay:` prefix). `broadcastPaymentConfirmed` added to `ICreditsRepository` (Supabase impl mirrors `broadcastChatMessage`; in-memory fixture is a spy-able no-op) + thin `CreditService` pass-through. `PaymentService.handlePackPayment` fires the broadcast best-effort after `addCredits` (reads `getBalance` once; failure logs `warn`, never fails the webhook). New `GET /api/payment-confirmation/channel` returns `{ channelName, confirmed, credits, name, packSize }` behind the same auth + Stripe-ownership gate the old `/api/sse` used. `useSSECredits` rewritten to subscribe via `supabase-browser` (public API unchanged → `pago-exitoso/page.tsx` untouched); webhook-before-subscribe race resolved by the endpoint's `confirmed` state + re-check on every `SUBSCRIBED`. `/api/sse` deleted (only `useSSECredits` referenced it). 246 unit tests pass; lint clean (1 pre-existing Chat.tsx warning); `pnpm build` green on Node 22. **Deviations:** (1) repo is `ICreditsRepository` (plural) and `PaymentService` holds a `CreditService` instance (not the repo directly), so the chain is `handlePackPayment → CreditService.broadcastPaymentConfirmed → repo` (task md used idealized `ICreditRepository`/`creditRepo` names). (2) Broadcast tests added to the existing `PaymentService.test.ts` inline-mock structure (extended `mockCredits` with `getBalance`/`broadcastPaymentConfirmed`) rather than the task's `buildTestServices()`/`creditRepo` snippet. (3) e2e (`booking-pack.spec.ts`) comment updated to describe the Realtime flow; the existing 60s confirmation assertion needs no logic change and e2e requires `E2E_BASE_URL`. |

**Phase 3 exit criteria:**
- [ ] All 5 tasks merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] DB query count per chat session connection ≤ 3 over the connection lifetime (verify via Supabase query log)
- [ ] Concurrent cache misses for same `(date, duration)` collapse to one Calendar API call (verify via instrumented log)
- [ ] Unauthorized user receives 403 (not chat messages) when calling `GET /api/chat-session?eventId=...` for a session they don't belong to

---

## Phase 4 — Observability

> Goal: catch silent failures earlier; correlate logs; tag releases.

| Status | # | Task | Owner | PR | Notes |
|--------|---|------|-------|----|----|
| ✅ | 01 | [Stripe ↔ Supabase reconciliation cron](phase-4-observability/01-stripe-reconciliation-cron.md) | gussttaav | local | New `GET /api/internal/reconcile-stripe` (cron-job.org, `CRON_SECRET` bearer) lists succeeded PaymentIntents from the last 48h and verifies each was processed. 7 new route tests; `tsc --noEmit` + lint clean (`pnpm build` blocked by Node 18 per P3-01). **Deviations:** (1) **type-aware** proof-of-processing instead of a single `webhook_events` check — packs never write `webhook_events` (idempotency is the `credit_packs.stripe_payment_id` UNIQUE constraint), so pack PIs check `credit_packs` (`hasProcessedPayment`) and single PIs check `bookings`/`failed_bookings`/`webhook_events`; the verbatim spec would false-positive every pack sale. (2) **No `vercel.json`** — Vercel Hobby plan, cron runs via cron-job.org like `session-cleanup`. (3) **Repository methods** (not direct `supabase.from()` in the route): reused `hasProcessedPayment`, added `hasBookingForPayment` + `hasFailedBooking`. |
| ✅ | 02 | [Request ID middleware + structured `pino` logger](phase-4-observability/02-request-id-tracing.md) | gussttaav | local | **Part A only** (the required half). New `src/middleware.ts` (Edge — generates/forwards `x-request-id`, echoes it on the response), `src/lib/request-context.ts` (`AsyncLocalStorage` wrapper), `src/lib/with-request-context.ts` (`tracedRoute` helper). `logger.ts` reads the request ID from ALS and stamps it onto every log line + Sentry `extra`. `tracedRoute` applied to `/api/book`, `/api/cancel`, `/api/stripe/webhook`, `/api/chat`, `/api/chat-session`, `/api/zoom/token`. 4 new logger tests (8 total in file); full unit suite 262 passing; lint + `pnpm build` (Node 22 via nvm) clean — middleware registers as `ƒ Proxy (Middleware)`. **Deviation:** **Part B (`pino` migration) deferred** — the task marks it optional/"do later if you want"; not bundled into this PR. |
| ✅ | 03 | [Sentry release tagging via `VERCEL_GIT_COMMIT_SHA`](phase-4-observability/03-sentry-release-tagging.md) | gussttaav | local | Added `release: VERCEL_GIT_COMMIT_SHA` to all three Sentry inits (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`); client uses `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, exposed via a new `env` block in `next.config.mjs`. `environment` was already wired in all three configs. Lint clean; `pnpm build` (Node 22 via nvm) clean. **No automated tests:** the task's Test plan is entirely manual post-deploy verification (deploy → trigger error → check Sentry Releases/Tags). |

**Phase 4 exit criteria:**
- [ ] All 3 tasks merged
- [ ] Reconciliation cron runs daily via Vercel cron, alerts via Sentry on any mismatch
- [ ] Every log line has a `requestId` field; same ID for all logs within one request
- [ ] Sentry release dashboard shows per-deploy error rate

---

## Cross-phase notes

### Deviations
_(record any task that ended up materially different from its markdown spec)_

### Known regressions
_(list anything that broke and was rolled back)_

### Decisions log
_(record judgment calls — e.g. "chose Realtime channel-per-session vs single channel because…")_

---

## After Phase 4

The next round of work (not yet planned) likely includes:
- Splitting `ZoomRoomSession.tsx` into hooks (style, not correctness)
- Light theme
- i18n
- XState for the Zoom room state machine

These are tracked in PLAN.md's "Out of scope" section. Promote them to a new phase folder when they become priorities.
