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
| [04 Checkout refuses a reschedule token](phase-1-correctness/04-checkout-refuses-reschedule-token.md) | `REFACTOR-R5-P1-04` | 🟢 | S | ✅ | Claude | local (staging) |
| [03 One free call per user, enforced by the database](phase-1-correctness/03-free-call-unique-index.md) | `REFACTOR-R5-P1-03` | 🟢 | S | ✅ | Claude | local (staging) |

**Exit criteria**
- [x] `POST /api/book` with another account's reschedule token → 403 `RESCHEDULE_NOT_OWNER`; the original booking is untouched and its token still works for its owner (P1-01: route + service + in-memory integration tests; e2e not run)
- [x] `markProcessed` rejecting after `createBooking` → booking kept, no dead-letter, `payments` row written, `confirmed` broadcast, webhook 200 (P1-02: service tests, webhook + admin retry)
- [x] Two concurrent free-call bookings for one user → exactly one succeeds, the other answers 409 `FREE_SESSION_ALREADY_USED`, and no calendar event is left behind (P1-03: in-memory integration + service + DB-gated repository tests)
- [x] `POST /api/stripe/checkout` with a non-empty `rescheduleToken` → 400, no PaymentIntent created (P1-04: route + schema + service tests; e2e not run)
- [ ] `0029` applied to the test DB; `pnpm test`, `pnpm lint`, `pnpm build` green; e2e booking/reschedule specs green (ask first: they truncate the test DB) — 0029 on the test DB, `pnpm test` (3251) and `pnpm lint` green on 2026-11-12; `pnpm build` and e2e not run

## Phase 2 — Honesty & Architecture

P2-02 after Phase 1. P2-01 and P2-03 are independent.

| Task | Tag | Sev | Effort | Status | Owner | PR |
|------|-----|-----|--------|--------|-------|----|
| [01 `/api/chat` becomes a thin route](phase-2-honesty-architecture/01-chat-route-to-service.md) | `REFACTOR-R5-P2-01` | 🟡 | M | ✅ | Claude | local (staging) |
| [02 Cancel and reschedule tell the truth about credits and payments](phase-2-honesty-architecture/02-cancel-reschedule-honesty.md) | `REFACTOR-R5-P2-02` | 🟡 | M | ✅ | Claude | local (staging) |
| [03 Session-cleanup sweep moves into `BookingService`](phase-2-honesty-architecture/03-session-cleanup-to-service.md) | `REFACTOR-R5-P2-03` | 🟢 | S | ✅ | Claude | local (staging) |

**Exit criteria**
- [x] `src/app/api/chat/route.ts` imports neither `kv` nor `pricingService` / `userService`; the existing chat route tests pass unchanged in behaviour (P2-01: the ToolContext / contextNote / kill-switch cases moved to `ChatService.test.ts` with the logic)
- [x] A signed-in student with private prices: exactly one `user_pricing` read per chat turn (today: two) (P2-01: `ChatService` + `PricingService` tests)
- [x] A pack class cancelled with no credit restored: email shows the "no credit returned" line, history shows «crédito no devuelto» (P2-02: RPC writes `credit_restored`, DB-gated + in-memory + `paymentLabel` table tests; email rendered once with the scratch `tsx` renderer, ES + EN)
- [x] A rescheduled pack class's original row reads «crédito pasado a la nueva clase»; a rescheduled paid class shows its price once (P2-02: `claimForReschedule` / `reinstateBooking` DB-gated tests, `deriveAmount` unit + DB-gated history test)
- [x] `src/app/api/internal/session-cleanup/route.ts` imports nothing from `@/infrastructure` (P2-03: sweep in `BookingService.sweepPendingTerminations`; service + route tests)
- [ ] `0030` applied to the test DB; `pnpm check:messages`, `pnpm test`, `pnpm lint`, `pnpm build` green — 0030 on the test DB, `check:messages`, `pnpm test` (3296) and `pnpm lint` green on 2026-11-12; after P2-03, `pnpm test` (3302) and `pnpm lint` green; `pnpm build` not run

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
- **P1-04 (2026-11-11):** committed straight on `staging` at Gustavo's choice. `z.never().optional()` also refuses an empty string (`rescheduleToken: ""` → 400), not just a non-empty one; a schema test pins that. The route test asserts `createSingleSessionCheckout` isn't called (the route-level stand-in for "`createPaymentIntent` not called"). There was no webhook test with a non-empty `reschedule_token`, so one was added to pin the legacy read; P1-01's owner check on that token is covered by its own `BookingService` tests and wasn't re-tested here. The new metadata test passes against the old code too (an absent token already wrote `""`), so it's a regression guard; the schema and route tests fail against it. `tsc` reports one error, in the generated `.next/dev/types/validator.ts`, which shows up without this change too; `src` is clean. e2e (`booking-single`, `reschedule`) not run.
- **P1-03 (2026-11-12):** committed straight on `staging` at Gustavo's choice. The in-memory fixture first checked the cap with `await this.hasActiveFreeSession(...)` before inserting, which yielded between check and write: both concurrent calls passed it and the new integration test saw two bookings. The check is now a synchronous private `holdsFreeCall` (shared by `hasActiveFreeSession`), atomic with the write like the index; the concurrency test fails without the fixture's constraint and passes with it. The repository also checks `details` for the index name, not only `message` (the task allowed it). Added two integration cases (a free-call reschedule still books; a failed one reinstates the original) and a DB-gated reinstate-returns-`false` case beyond the plan. Test DB: pre-check found no duplicates; the DO block was run against a scratch pair of `free15min` rows and aborted with its message (rows deleted, verified), then 0029 was pushed with `--project-ref lgfntdmrbzlvepngucyo` and the DB-gated suite ran 28/28. Mobile app: no contract change (it already handles 409 `FREE_SESSION_ALREADY_USED` in `confirm-free.tsx`). `pnpm build` and e2e not run.
- **P2-01 (2026-11-12):** committed straight on `staging` at Gustavo's choice. **Price-read choice:** every signed-in turn calls `getEffectivePriceCents(user.id)`, i.e. one `resolve()` (one `pricing` + one `user_pricing` read), including students without overrides, who used to get the cached display prices with no DB read. Kept that way so `resolve()` stays the one merge point; anonymous visitors still read no DB. **Order change:** the kill-switch pre-check now runs inside `reply()`, after the body parse and the cached ISR reads, so an over-cap request with a malformed body answers 400 (was 503), and a throw from a cached loader answers 502 without counting a model call (it used to count 1). Response shape and the 503/502 bodies are unchanged. `ChatService` takes narrow ports (`ChatUserLookup`, `ChatPriceSource`) that `UserService` / `PricingService` satisfy; its constructor's `tools` is no longer defaulted, so the 12 existing `new ChatService(...)` test calls pass stub ports. The route test's ToolContext, contextNote and counter cases moved to `ChatService.test.ts` (the logic moved), and the route test now pins what it hands `reply()` plus the 503/502 mapping. `ChatCapacityError` → `CHAT_CAPACITY` 503 is in `http-errors.ts`, but the route maps it itself to keep the old Spanish body. `hasUserOverrides` kept (still used by `GET /api/pricing`). Mobile app: calls `POST /api/chat`; no contract change. `pnpm test` (3259) and `pnpm lint` green; `tsc` shows only the pre-existing `.next/dev/types/validator.ts` error. Manual dev check (signed out / signed in with a private price) and `pnpm build` not run.

- **P2-02 (2026-11-12):** made straight on `staging` at Gustavo's choice, no task branch. 0030 pushed to the test DB with `--project-ref lgfntdmrbzlvepngucyo` (with his OK) and `types.ts` regenerated from it (diff: the two columns only). **Repository:** a new `claimForReschedule(token)` rather than an option on `consumeCancelToken`; both go through one private `flipToCancelled`, the claim adding `rescheduled: true`. **`deriveAmount`:** a rescheduled original returns no amount for *any* type, not only paid singles: a pack original's per-credit share moved to the new booking as well (its label reads «crédito pasado…» either way). **`paymentLabel`:** `payRescheduled` is skipped for a rescheduled `free15min` original, which keeps «Gratis» (the spec's order would have labelled it «pagada en la clase reprogramada»). **Totals:** nothing in `history-stats` (or anywhere on the web) sums `amountCents`, so there was no double count to fix. **Email:** the money line is chosen in `sendCancellationConfirmationEmail` from `sessionType` (`CancellationConfirmationParams.sessionType`); the copy is the task's proposed text, ES + EN. Updating existing tests: `BookingService.test.ts`'s mock gained `claimForReschedule`, and the seven references (six assertions, one `mockResolvedValue(false)`) that pinned the reschedule *claim* to `consumeCancelToken` (owner-refusal, owner-reuse, reinstate, concurrent-claim, invalid-slot) now name `claimForReschedule`; the new booking's compensation still asserts `consumeCancelToken("ctkn")` (its call-order index moved from `[1]` to `[0]`). New: DB-gated RPC (`credit_restored` true / false / NULL) and repo (claim → true, reinstate → false, `consumeCancelToken` → unmarked) tests, a DB-gated history test (amount on the new row only, outcome columns returned), in-memory integration cases for cancel and reschedule (fixture gained `cancelOutcomeOf`), service tests, a `paymentLabel` table, `deriveAmount` cases and `cancellation-email.test.ts` (mocked `getTranslations` + `fetch`); the unit/email ones fail against the old code. Admin: no admin view reads `BookingHistoryEntry` (`/admin/students/<email>`'s «Historial» is the credit audit log), so nothing to fall back there. Mobile app: additive fields, no break; see Production steps for the follow-up. `pnpm build` and e2e not run.

- **P2-03 (2026-11-12):** made straight on `staging` at Gustavo's choice, no task branch. As specified: `BookingService.sweepPendingTerminations({ maxBatch, maxAttempts })` runs the loop through the existing `IBookingRepository` methods; the route keeps `MAX_BATCH` / `MAX_ATTEMPTS`, the `CRON_SECRET` check and the two logs, and imports only `@/services` + the logger. **One edge differs in path, not status:** a `recordPendingTerminationFailure` throw (DB down mid-run) used to escape the route uncaught (Next's own 500); it now propagates out of the service into the route's `try` and answers the route's 500 `{ error: "Query failed" }` with the `"pending_terminations query failed"` error log. Still a 500 that fails the run, as the task asked; a service test pins the propagation. Tests: `route.test.ts` now mocks only `bookingService.sweepPendingTerminations` (the three auth cases unchanged in intent, plus 200 passthrough and 500 on rejection, and the call's `{ maxBatch: 50, maxAttempts: 5 }`); `BookingService.test.ts` gained the in-memory three-row case (the middle row's `sessions.deleteByEventId` throws → `{ cleared: 2, failed: 1, examined: 3 }`, its attempts 2 → 3 with the error string, the other two deleted, the third still processed) plus listing-args, listing-error and record-failure-propagates cases. Mobile app: doesn't call this route. cron-job.org unchanged. Manual `curl` and `pnpm build` not run.

## Production steps (Gustavo)

- [x] `0029_free_call_unique.sql` applied to production (2026-11-12). The first push aborted on the pre-check: Gustavo's own account held four non-cancelled `free15min` bookings from May–July 2026 (before the cap). At his choice all four were set to `cancelled` (tokens cleared, as `consumeCancelToken` does), then the push succeeded and the index was verified.
- [x] `0030_booking_cancel_outcome.sql` applied to production (2026-11-12, `supabase db push --linked`, only 0030 pending). Verified: both columns (`credit_restored` nullable, `rescheduled` NOT NULL default false), `cancel_booking` carries the new UPDATE, EXECUTE still service_role only, no existing row touched. Additive, so the code running before the deploy is unaffected. Apply it **before** deploying the P2-02 code: `claimForReschedule`, `reinstateBooking` and `listHistoryByUser` read or write the new columns and fail without them.
- [ ] Mobile app follow-up (P2-02, optional, not a break): **committed on the app's `staging` as eb2b70e (2026-11-12), not published.** The history now reads `creditRestored` / `rescheduled` (`cancelOutcome()` in `lib/history.ts`): a cancelled pack row says «crédito devuelto», «crédito no devuelto» or «crédito pasado a la nueva clase», with the same line as a «Crédito» row on the detail screen, and a rescheduled paid original says «pagada en la clase reprogramada» instead of the generic payment line. Older rows read as before. `tsc`, `npm test` (165) and `npm run lint` green; contract doc updated. JS + docs only (OTA-safe paths). Remaining: Gustavo publishes (`update:*`), **after** 0030 and the P2-02 server code are in production (before that the fields are absent and the app shows the old labels, which is harmless).
- [x] Mobile app confirmed not to send `rescheduleToken` on checkout (P1-04): checked in its code on 2026-11-12 (`confirm.tsx` sends only type/duration/start/end; reschedules go to `/api/book`). The unused field was dropped from its `types/api.ts` and API contract in the mobile repo.
