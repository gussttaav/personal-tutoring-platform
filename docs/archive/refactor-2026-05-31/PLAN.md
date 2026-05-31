# Refactor Plan — gustavoai.dev

> Master audit document. Source of truth for what needs to change and why.
> See `STATUS.md` for live progress. Individual tasks live in `phase-*/` folders.

**Audit date:** 2026-05-23
**Codebase:** Next.js 16 · React 19 · TypeScript · NextAuth v5 · Supabase · Stripe · Zoom Video SDK · Upstash Redis · Gemini · Resend · QStash · Sentry
**Scope:** All 247 files in the production repo.

---

## Audit philosophy

The codebase is unusually disciplined for a solo-operator SaaS: clean domain/services/infrastructure split, repository pattern with in-memory fakes, Zod at boundaries, structured logging, atomic Postgres procedures, a thoughtful CSP, startup-checks gating env vars, and a `SEC-XX`/`ARCH-XX` audit-trail in code comments showing prior findings have been tracked and fixed.

This plan addresses the gaps that remain. **Most are concentrated in two places**:

1. **The booking saga is not atomic and has no compensation logic.** Steps 2–8 of `createBooking` can partial-fail, leaving inconsistent state across credits, Calendar, QStash, DB, and Zoom.
2. **The Stripe webhook treats all processing failures as success** (`waitUntil` + always-200). Stripe never retries; failures are only caught for one specific path (single-session booking).

Fix those two and you go from "good SaaS" to "trustworthy SaaS."

---

## Phase overview

| Phase | Goal | Tasks | Effort |
|-------|------|-------|--------|
| **1 — Correctness** | Stop silent failures in payment + booking | 5 | 1–2 days |
| **2 — Hardening** | Defense-in-depth: RLS, admin role, AI trust, idempotency | 5 | 3–5 days |
| **3 — Performance** | Kill N+1s, replace SSE polling, fix missing membership check | 4 | 1 week |
| **4 — Observability** | Reconciliation cron, request IDs, release tagging, real logger | 3 | 2–3 days |

Total: **17 tasks**. Each lives in its own numbered markdown file with context, exact code changes, acceptance criteria, and test plan.

---

## Top 10 issues (executive summary)

| # | Severity | Area | Issue | Fix in |
|---|----------|------|-------|--------|
| 1 | 🔴 Critical | Booking race | `acquireSlotLock` is implemented + tested but **never called** from `BookingService.createBooking`. Concurrent bookings for same slot both succeed. | [Phase 1 / Task 01](phase-1-correctness/01-wire-slot-locks.md) |
| 2 | 🔴 Critical | Stripe webhook | `waitUntil(processWebhookEvent)` always returns 200. Processing failures = silent payment-without-booking; Stripe never retries. | [Phase 1 / Task 02](phase-1-correctness/02-webhook-error-handling.md) |
| 3 | 🔴 Critical | Booking saga | `createBooking` runs 8 side effects with no compensation. A failure between step 3 (Calendar) and step 5 (DB) orphans Calendar events. | [Phase 1 / Task 03](phase-1-correctness/03-booking-saga-compensation.md) |
| 4 | 🟠 High | QStash | `SchedulerClient.scheduleAt` swallows errors with `.catch(log)`. If QStash is down, Zoom sessions never terminate; JWTs remain mintable. | [Phase 1 / Task 04](phase-1-correctness/04-qstash-error-propagation.md) |
| 5 | 🟠 High | Stripe idempotency | `createPaymentIntent` does not pass `idempotencyKey`. Client retry → duplicate PaymentIntents. | [Phase 1 / Task 05](phase-1-correctness/05-stripe-idempotency-key.md) |
| 6 | 🟠 High | Performance N+1 | `SupabaseSessionRepository` resolves `zoom_session_id` from `eventId` on every chat read/write — 2 queries each. SSE polling multiplies by ~10. | [Phase 3 / Task 02](phase-3-performance/02-session-repository-n1.md) |
| 7 | 🟠 High | SSE design | Both `/api/sse` and `/api/chat-session` GET poll every 1.5s for 20s = ~13 queries × N+1 = ~90 queries per connection. | [Phase 3 / Task 01](phase-3-performance/01-replace-sse-with-realtime.md) |
| 8 | 🟡 Medium | Admin auth | `isAdmin()` reads from `ADMIN_EMAILS` env. `users.role` column already exists in schema — use it. | [Phase 2 / Task 02](phase-2-hardening/02-admin-role-from-db.md) |
| 9 | 🟡 Medium | AI cost + trust | `CHAT_SYSTEM_PROMPT` (~6KB) sent every request; `history` is client-trusted (user can inject fake "model" turns). | [Phase 2 / Task 03](phase-2-hardening/03-gemini-history-trust-boundary.md) |
| 10 | 🟡 Medium | RLS | Every table has `ENABLE ROW LEVEL SECURITY` but **zero policies defined**. Safe only because service-role key bypasses RLS. | [Phase 2 / Task 01](phase-2-hardening/01-rls-policies.md) |

---

## Detailed findings by category

### Security

- Booking race condition (issue #1)
- Webhook silent-failure (issue #2)
- Booking compensation missing (issue #3)
- RLS policies missing (issue #10)
- Origin-based CSRF should also check `Sec-Fetch-Site` (defense in depth) — [Phase 2 / Task 04](phase-2-hardening/04-csrf-defense-in-depth.md)
- `SessionService.getChatMessages` lacks membership check (admitted in code comment) — [Phase 3 / Task 04](phase-3-performance/04-chat-membership-check.md)
- Gemini history client-trusted (issue #9)
- `findByCancelToken` does redundant HMAC check after unique-token lookup — documented in PLAN but not addressed (low priority; pick one or the other)

### Architecture & code quality

- Booking saga missing compensation (issue #3)
- `ZoomRoomSession.tsx` is ~1500 lines — split into hooks (deferred; tracked here, no task created)
- Admin role in env instead of DB (issue #8)
- `sessionId === sessionName` in Zoom credentials is confusing (deferred; documented)

### Redis usage

The team has correctly migrated transactional state to Postgres. Redis is now **ephemeral-only** (rate limits, slot locks, availability cache, in-flight chat). This is correct. No refactor needed except:

- Add Redis-backed coalescing around the availability cache miss path — [Phase 3 / Task 03](phase-3-performance/03-availability-cache-coalescing.md)

### Performance & scalability

- SSE polling → Realtime (issue #7)
- Session repository N+1 (issue #6)
- Availability cache stampede (no task — folded into Task 03)
- `useCredit` + `getBalance` make 2 roundtrips where 1 would do — [Phase 3 / Task 03](phase-3-performance/03-availability-cache-coalescing.md) (companion fix)

### Payments & business logic

- Stripe webhook (issue #2)
- Booking saga (issue #3)
- Idempotency key (issue #5)
- Reconciliation cron (Stripe ↔ Supabase) — [Phase 4 / Task 01](phase-4-observability/01-stripe-reconciliation-cron.md)

### Video classroom (Zoom)

- JWT lifetime hardcoded to 1h, < 2h session length — [Phase 2 / Task 05](phase-2-hardening/05-zoom-jwt-lifetime.md)
- No server-side hard-stop (mitigated by short JWT lifetime above)
- `tpc` collision space only 32 bits (low priority; folded into Task 05)
- Membership check missing in chat (issue #6 fix, also #4 below)

### UI/UX

- Tailwind dark-mode-only with no light tokens (documented; no task — would be a separate epic)
- `border-radius.DEFAULT: 0.125rem` overrides Tailwind defaults silently (documented; no task)
- `ZoomRoomSession.tsx` monolithic (documented; no task — defer)
- Spanish-only error messages (documented; no task — defer until needed)

### AI assistant (Gemini)

- Client-trusted history (issue #9)
- ~6KB system prompt every request (issue #9; folded into same task)
- No token-budgeted history truncation (folded into same task)
- No global Gemini spend cap (folded into same task)

### Observability & dev experience

- Stripe reconciliation cron — [Phase 4 / Task 01](phase-4-observability/01-stripe-reconciliation-cron.md)
- Request-scoped IDs — [Phase 4 / Task 02](phase-4-observability/02-request-id-tracing.md)
- Sentry release tagging — [Phase 4 / Task 03](phase-4-observability/03-sentry-release-tagging.md)
- Replace `console.log(JSON.stringify(...))` with `pino` (folded into Task 02)

---

## How to execute this plan with Claude Code

1. **Open `STATUS.md`** — pick the next unchecked task in the lowest-numbered phase.
2. **Open that task's markdown** — it contains:
   - Why this matters
   - Files affected (with line numbers from the audited code)
   - The exact change (code snippets)
   - Acceptance criteria (testable, measurable)
   - Test plan (which existing tests should still pass + new tests needed)
3. **Tell Claude Code:** "Implement the task described in `docs/refactor/phase-N-name/NN-task.md`. Run `pnpm test` after."
4. **Update `STATUS.md`** when done — check the box, fill in the PR link, note any deviations.

### Order of operations

- **Phase 1 is non-negotiable and ships first.** Each task in Phase 1 is independent — they can be parallel PRs.
- **Phase 2 depends on Phase 1 being merged** (the admin-role task touches code Phase 1 also touches).
- **Phase 3** can begin in parallel with Phase 2 once Phase 1 is in.
- **Phase 4** can be done any time after Phase 1, but is most valuable once Phase 1–3 are deployed.

### Rules

- **Each task = one PR.** Don't bundle.
- **Each task has tests.** If existing tests cover the change, run them; if not, write new ones in the same PR.
- **Follow the `SEC-XX`/`ARCH-XX` comment convention** already in the codebase. Every fix gets a comment block at the file head referencing the task ID (e.g. `REFACTOR-P1-01`).
- **Do not refactor adjacent code** (per CLAUDE.md). Each PR touches only the files listed in its task.

---

## Out of scope (intentionally)

These came up in audit but are *not* in this plan:

- **Light theme.** Tailwind config is dark-only. Adding light tokens is a separate epic.
- **i18n.** All user-facing text is Spanish literals. International expansion is a product decision.
- **`ZoomRoomSession.tsx` decomposition.** 1500-line file works correctly; splitting is style, not correctness.
- **Migration to `pino`.** Folded into Task 4-02 as an optional sub-task.
- **XState for room state machine.** Deferred — current reducer is adequate.
- **Stripe subscription model.** Out of scope unless the product moves to recurring billing.

If any of these become priorities later, add a phase-5 folder.
