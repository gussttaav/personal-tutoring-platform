# Refactor Cycle 5 — Status

**Started:** 2026-11-10 (audit + plan)
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task. Record decisions taken on the
[open questions](PLAN.md#decisions-needed-gustavo-with-the-default-each-task-assumes) under
**Decisions** below.

---

## Phase 1 — Correctness

Landing order: P1-02 → P1-01 → P1-04 → P1-03.

| Task | Tag | Sev | Effort | Status | Owner | PR |
|------|-----|-----|--------|--------|-------|----|
| [02 `markProcessed` after the commit is best-effort](phase-1-correctness/02-mark-processed-after-commit.md) | `REFACTOR-R5-P1-02` | 🟠 | S | ✅ | Claude | local (staging) |
| [01 A reschedule token only works for its owner](phase-1-correctness/01-reschedule-token-owner.md) | `REFACTOR-R5-P1-01` | 🟠 | S | ✅ | Claude | local (staging) |
| [04 Checkout refuses a reschedule token](phase-1-correctness/04-checkout-refuses-reschedule-token.md) | `REFACTOR-R5-P1-04` | 🟢 | S | ⬜ | _tbd_ | |
| [03 One free call per user, enforced by the database](phase-1-correctness/03-free-call-unique-index.md) | `REFACTOR-R5-P1-03` | 🟢 | S | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `POST /api/book` with another account's reschedule token → 403 `RESCHEDULE_NOT_OWNER`; the original booking is untouched and its token still works for its owner (P1-01: route + service + in-memory integration tests; e2e not run)
- [x] `markProcessed` rejecting after `createBooking` → booking kept, no dead-letter, `payments` row written, `confirmed` broadcast, webhook 200 (P1-02: service tests, webhook + admin retry)
- [ ] Two concurrent free-call bookings for one user → exactly one succeeds, the other answers 409 `FREE_SESSION_ALREADY_USED`, and no calendar event is left behind
- [ ] `POST /api/stripe/checkout` with a non-empty `rescheduleToken` → 400, no PaymentIntent created
- [ ] `0029` applied to the test DB; `pnpm test`, `pnpm lint`, `pnpm build` green; e2e booking/reschedule specs green (ask first: they truncate the test DB)

## Phase 2 — Honesty & Architecture

P2-02 after Phase 1. P2-01 and P2-03 are independent.

| Task | Tag | Sev | Effort | Status | Owner | PR |
|------|-----|-----|--------|--------|-------|----|
| [01 `/api/chat` becomes a thin route](phase-2-honesty-architecture/01-chat-route-to-service.md) | `REFACTOR-R5-P2-01` | 🟡 | M | ⬜ | _tbd_ | |
| [02 Cancel and reschedule tell the truth about credits and payments](phase-2-honesty-architecture/02-cancel-reschedule-honesty.md) | `REFACTOR-R5-P2-02` | 🟡 | M | ⬜ | _tbd_ | |
| [03 Session-cleanup sweep moves into `BookingService`](phase-2-honesty-architecture/03-session-cleanup-to-service.md) | `REFACTOR-R5-P2-03` | 🟢 | S | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `src/app/api/chat/route.ts` imports neither `kv` nor `pricingService` / `userService`; the existing chat route tests pass unchanged in behaviour
- [ ] A signed-in student with private prices: exactly one `user_pricing` read per chat turn (today: two)
- [ ] A pack class cancelled with no credit restored: email shows the "no credit returned" line, history shows «crédito no devuelto»
- [ ] A rescheduled pack class's original row reads «crédito pasado a la nueva clase»; a rescheduled paid class shows its price once
- [ ] `src/app/api/internal/session-cleanup/route.ts` imports nothing from `@/infrastructure`
- [ ] `0030` applied to the test DB; `pnpm check:messages`, `pnpm test`, `pnpm lint`, `pnpm build` green

## Phase 3 — Cleanup

P3-04 last.

| Task | Tag | Sev | Effort | Status | Owner | PR |
|------|-----|-----|--------|--------|-------|----|
| [01 Availability invalidation on the tutor's date](phase-3-cleanup/01-availability-invalidation-tutor-date.md) | `REFACTOR-R5-P3-01` | 🟢 | S | ⬜ | _tbd_ | |
| [02 Pack size by join, not per row](phase-3-cleanup/02-pack-size-join.md) | `REFACTOR-R5-P3-02` | 🟢 | S | ⬜ | _tbd_ | |
| [03 Checkout never hands back a paid PaymentIntent](phase-3-cleanup/03-checkout-replay-succeeded-intent.md) | `REFACTOR-R5-P3-03` | 🟢 | S | ⬜ | _tbd_ | |
| [04 CLAUDE.md drift](phase-3-cleanup/04-claude-md-drift.md) | `REFACTOR-R5-P3-04` | 🟢 | S | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] A booking at 00:30 Madrid invalidates the Madrid date's cache entries, not the previous UTC day's
- [ ] `listByUser` for a user with N pack bookings issues 2 queries, not N + 2
- [ ] Buying the same pack twice inside 5 minutes yields two PaymentIntents and two charges; a double-click still yields one
- [ ] CLAUDE.md describes the post-cycle state; `pnpm test`, `pnpm lint`, `pnpm build` green

---

## Decisions

_None recorded yet. Record each answer to PLAN.md's open questions here, with the date._

## Deviations from plan

- **P1-01 (2026-11-11):** landed before P1-02, against the suggested order (they are independent). Committed straight on `staging` at Gustavo's choice, no task branch. No shared `normalizeEmail` exists in `src/lib`, so `BookingService` got a module-local one (same as `BookingPaymentAuditService`). `BookingService.test.ts`'s `baseCancelRecord` fixture defaulted to `s@t.com` while every input used `student@test.com`, so all 16 existing reschedule tests were cross-account reschedules and failed under the new check, as the task's test plan anticipated. The fixture now defaults to `student@test.com`, and the two cancel assertions that read that email back were updated to match. `InMemoryBookingRepository` needed nothing (it returns the stored owner's email). Optional manual e2e not run.
- **P1-02 (2026-11-11):** committed straight on `staging` at Gustavo's choice. The webhook path's outcome isn't returned by `processWebhookEvent`, so the "booked" case is asserted through its effects (no `recordFailedBooking`, no dead-letter email, `recordPayment` called, only `confirmed` broadcast); the admin-retry test asserts `{ ok: true, outcome: "booked" }` directly. Both new tests fail against the previous `PaymentService.ts`. The optional in-memory integration case in `payment.test.ts` was not added: the service suite covers every acceptance point, and the integration suite passes unchanged.

## Production steps (Gustavo)

- [ ] `0029_free_call_unique.sql` applied to production (run the task's pre-check query first)
- [ ] `0030_booking_cancel_outcome.sql` applied to production
- [ ] Mobile app confirmed not to send `rescheduleToken` on checkout (P1-04)
