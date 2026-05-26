# Refactor Status

> Living document. Update this when starting, completing, or blocking a task.
> See `PLAN.md` for context on the whole effort.

**Last updated:** 2026-05-26 (P1-05 complete)
**Current focus:** Phase 1 — Correctness
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
| ⬜ | 01 | [Define explicit RLS policies (deny-anon)](phase-2-hardening/01-rls-policies.md) | _tbd_ | _tbd_ | |
| ⬜ | 02 | [Move admin check to `users.role` column](phase-2-hardening/02-admin-role-from-db.md) | _tbd_ | _tbd_ | |
| ⬜ | 03 | [Gemini history server-side + token-budget + spend cap](phase-2-hardening/03-gemini-history-trust-boundary.md) | _tbd_ | _tbd_ | |
| ⬜ | 04 | [CSRF defense in depth (`Sec-Fetch-Site`)](phase-2-hardening/04-csrf-defense-in-depth.md) | _tbd_ | _tbd_ | |
| ⬜ | 05 | [Zoom JWT lifetime matches session duration](phase-2-hardening/05-zoom-jwt-lifetime.md) | _tbd_ | _tbd_ | |

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
| ⬜ | 01 | [Replace `/api/chat-session` SSE polling with Supabase Realtime](phase-3-performance/01-replace-sse-with-realtime.md) | _tbd_ | _tbd_ | |
| ⬜ | 02 | [Fix `SupabaseSessionRepository` N+1 on `zoom_session_id` resolution](phase-3-performance/02-session-repository-n1.md) | _tbd_ | _tbd_ | |
| ⬜ | 03 | [Availability cache: request coalescing + `decrement_credit` returns `pack_size`](phase-3-performance/03-availability-cache-coalescing.md) | _tbd_ | _tbd_ | |
| ⬜ | 04 | [Chat membership check in `SessionService.getChatMessages`](phase-3-performance/04-chat-membership-check.md) | _tbd_ | _tbd_ | |

**Phase 3 exit criteria:**
- [ ] All 4 tasks merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] DB query count per chat session connection ≤ 3 over the connection lifetime (verify via Supabase query log)
- [ ] Concurrent cache misses for same `(date, duration)` collapse to one Calendar API call (verify via instrumented log)
- [ ] Unauthorized user receives 403 (not chat messages) when calling `GET /api/chat-session?eventId=...` for a session they don't belong to

---

## Phase 4 — Observability

> Goal: catch silent failures earlier; correlate logs; tag releases.

| Status | # | Task | Owner | PR | Notes |
|--------|---|------|-------|----|----|
| ⬜ | 01 | [Stripe ↔ Supabase reconciliation cron](phase-4-observability/01-stripe-reconciliation-cron.md) | _tbd_ | _tbd_ | |
| ⬜ | 02 | [Request ID middleware + structured `pino` logger](phase-4-observability/02-request-id-tracing.md) | _tbd_ | _tbd_ | |
| ⬜ | 03 | [Sentry release tagging via `VERCEL_GIT_COMMIT_SHA`](phase-4-observability/03-sentry-release-tagging.md) | _tbd_ | _tbd_ | |

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
