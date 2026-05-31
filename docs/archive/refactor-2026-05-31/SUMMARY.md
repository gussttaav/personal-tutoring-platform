# Refactor Summary — Correctness, Hardening, Performance, Observability

**Date range:** 2026-04-16 → 2026-05-31
**Tasks completed:** 18 / 18 (Phase 1: 5, Phase 2: 5, Phase 3: 5, Phase 4: 3)
**Archived by:** `/refactor-archive` (exit criteria checkboxes left unchecked at archive time — archived by explicit override).

> ⚠️ **Archive note:** This refactor was archived with all task statuses ✅ but with the
> per-phase **exit-criteria checkboxes still unchecked** in `STATUS.md`. Several criteria
> are manual verification steps (concurrent-booking 409, Stripe forced-error 500, RLS anon
> rejection, query-count via Supabase log, post-deploy Sentry release dashboard) that were
> not formally signed off in the tracker. Treat them as **not independently verified here.**
> The PR column reads `local` for every task, so PRs could not be linked by number.

---

## Tasks completed

### Phase 1 — Correctness
| # | Task | Tag |
|---|------|-----|
| 01 | Wire `acquireSlotLock` into `BookingService.createBooking` | `REFACTOR-P1-01` |
| 02 | Stripe webhook returns 500 on retryable processing failures | `REFACTOR-P1-02` |
| 03 | Booking saga: explicit compensation list | `REFACTOR-P1-03` |
| 04 | QStash: propagate errors, add fallback row | `REFACTOR-P1-04` |
| 05 | Stripe PaymentIntent idempotency key | `REFACTOR-P1-05` |

### Phase 2 — Hardening
| # | Task | Tag |
|---|------|-----|
| 01 | Define explicit RLS policies (deny-anon) | `REFACTOR-P2-01` |
| 02 | Move admin check to `users.role` column | `REFACTOR-P2-02` |
| 03 | Gemini history server-side + token-budget + spend cap | `REFACTOR-P2-03` |
| 04 | CSRF defense in depth (`Sec-Fetch-Site`) | `REFACTOR-P2-04` |
| 05 | Zoom JWT lifetime matches session duration | `REFACTOR-P2-05` |

### Phase 3 — Performance
| # | Task | Tag |
|---|------|-----|
| 01 | Replace `/api/chat-session` SSE polling with Supabase Realtime | `REFACTOR-P3-01` |
| 02 | Fix `SupabaseSessionRepository` N+1 on `zoom_session_id` resolution | `REFACTOR-P3-02` |
| 03 | Availability cache coalescing + `decrement_credit` returns `pack_size` | `REFACTOR-P3-03` |
| 04 | Chat membership check in `SessionService.getChatMessages` | `REFACTOR-P3-04` |
| 05 | Replace `/api/sse` payment-confirmation SSE polling with Supabase Realtime | `REFACTOR-P3-05` |

### Phase 4 — Observability
| # | Task | Tag |
|---|------|-----|
| 01 | Stripe ↔ Supabase reconciliation cron | `REFACTOR-P4-01` |
| 02 | Request ID middleware + structured logger | `REFACTOR-P4-02` |
| 03 | Sentry release tagging via `VERCEL_GIT_COMMIT_SHA` | `REFACTOR-P4-03` |

---

## Key wins

- **Payment & booking stopped failing silently.** Slot locks now serialize concurrent bookings, the Stripe webhook returns 500 (so Stripe retries) instead of swallowing processing errors, the booking saga has an explicit compensation list, and PaymentIntents carry idempotency keys. A daily Stripe↔Supabase reconciliation cron catches anything that still slips through.
- **Defense in depth on the security boundary.** Explicit deny-anon RLS policies, admin authority moved from an env allowlist to the `users.role` column (hourly JWT refresh), Gemini chat history moved server-side with a token budget and daily spend cap, CSRF hardened with `Sec-Fetch-Site`, and Zoom JWT lifetimes bound to session duration.
- **Real-time replaces polling, N+1s removed.** Both the session-chat and payment-confirmation SSE pollers were replaced with Supabase Realtime broadcasts; the session repository's `zoom_session_id` resolution collapsed to a single embedded join; availability-cache misses coalesce behind a Redis lock; and `decrement_credit` returns `pack_size` to drop a per-booking query. A previously missing chat-membership check now returns 403 for non-participants.
- **Observability groundwork.** Every request carries an `x-request-id` (Edge middleware + `AsyncLocalStorage`) stamped onto every log line and Sentry event, and Sentry events are tagged with the deploy's git commit SHA for per-release error rates.

---

## Notable deviations (from per-task notes)

The cross-phase Deviations / Known-regressions sections in `STATUS.md` were left empty, but
several tasks shipped materially different from their markdown spec:

- **P1-04:** QStash was removed entirely post-merge — the scheduler abstraction was deleted,
  `pending_terminations` is written on **every** booking, and the fallback endpoint was renamed
  to `/api/internal/session-cleanup`. The cron-job.org URL must be updated manually.
- **P3-03:** Migration landed as `0009_decrement_credit_pack_size.sql` (not `0008`); the old
  "cache hit" log line and `cached: true` response flag were dropped.
- **P3-04:** Membership check adds one `findByEventId`, so `getChatMessages` is 4 DB queries
  (not 3) — the phase exit criterion "≤3 over the connection lifetime" should account for this.
- **P4-01:** Type-aware proof-of-processing (packs check `credit_packs`, single PIs check
  `bookings`/`failed_bookings`/`webhook_events`) instead of a single `webhook_events` lookup,
  which would false-positive every pack sale. Runs via cron-job.org (Vercel Hobby), not `vercel.json`.
- **P4-02:** Only **Part A** shipped — the optional `pino` migration (Part B) was deferred.

---

## Deferred to a future refactor

Tracked in `PLAN.md` "Out of scope" / "After Phase 4":

- Split `ZoomRoomSession.tsx` into hooks (style, not correctness)
- Light theme
- i18n
- XState for the Zoom room state machine
- `pino` logger migration (P4-02 Part B)

---

## PRs

The `STATUS.md` PR column records `local` for all 18 tasks, so PRs cannot be linked by number
here. Code changes are traceable via the `REFACTOR-PN-NN` tags in the file-top comment blocks
and in `git log` (e.g. recent merges `REFACTOR-P4-01`…`P4-03` on `main`).
