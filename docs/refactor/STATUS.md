# Refactor Cycle 4 — Status

**Started:** 2026-09-28 (audit + plan)
**Legend:** ⬜ not started · 🔄 in progress · ⛔ blocked · ✅ done · 🚫 won't do

Update this file when starting, completing, or blocking a task. Record decisions taken on the
[open questions](PLAN.md#decisions-needed-gustavo-with-the-default-each-task-assumes) under
**Decisions** below.

---

## Phase 1 — Correctness

Landing order: P1-02 → P1-01 → P1-03 → P1-04.

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [02 Idempotency + eligibility reads fail closed](phase-1-correctness/02-idempotency-reads-fail-closed.md) | `REFACTOR-R4-P1-02` | 🟠 | ✅ | Claude | local (`claude/idempotency-reads-fail-closed-da990f`) — see Deviations; build + e2e not run |
| [01 Server-side slot validation + `/api/book` rate limit](phase-1-correctness/01-server-side-slot-validation.md) | `REFACTOR-R4-P1-01` | 🔴 | ✅ (trimmed) | Claude | local (`refactorization`) — Calendar checks dropped at Gustavo's request, see Deviations; e2e pending |
| [03 Reschedule keeps the original booking until the new one commits](phase-1-correctness/03-reschedule-keeps-original.md) | `REFACTOR-R4-P1-03` | 🟠 | ⬜ | _tbd_ | |
| [04 Atomic cancel, credit back to the originating pack](phase-1-correctness/04-atomic-cancel-restore-pack.md) | `REFACTOR-R4-P1-04` | 🟡 | ⬜ | _tbd_ | |

**Exit criteria**
- [x] `POST /api/book` with an off-hours start ~~, a busy slot,~~ or `endIso − startIso` ≠ the session type's length → 4xx, no calendar event, no credit spent _(P1-01; service + integration + route tests. "Busy slot" dropped with the trimmed scope)_
- [x] Paid checkout for a mismatched duration → 4xx before any PaymentIntent exists; the webhook books `startIso + duration`, never the metadata `end_iso` _(P1-01; service + integration + route tests)_
- [x] Forced Supabase error in any idempotency read during a duplicate webhook → 500 (Stripe retries), no refund, no second booking _(P1-02; mocked-client repository test + in-memory PaymentService tests)_
- [ ] Forced failure after the reschedule's old-token claim → the original booking is `confirmed` again with a working cancel link
- [ ] Cancelling a pack class returns the credit to `bookings.credit_pack_id`'s pack in the same transaction; `creditsRestored` is false whenever nothing was restored
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green; `pnpm test:e2e` booking/cancel/reschedule specs green (re-run once for known flakes)

## Phase 2 — Performance

P2-03 before P2-04. P2-01 and P2-02 are independent.

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [01 `@googleapis/calendar` instead of `googleapis`](phase-2-performance/01-googleapis-calendar-only.md) | `REFACTOR-R4-P2-01` | 🟠 | ⬜ | _tbd_ | |
| [02 Shell weight: icon-font subset + Sentry Replay](phase-2-performance/02-shell-weight-font-sentry.md) | `REFACTOR-R4-P2-02` | 🟠 | ⬜ | _tbd_ | |
| [03 Commerce providers out of the root layout](phase-2-performance/03-commerce-providers-scope.md) | `REFACTOR-R4-P2-03` | 🟡 | ⬜ | _tbd_ | |
| [04 One user-session state for the whole page](phase-2-performance/04-single-user-session-state.md) | `REFACTOR-R4-P2-04` | 🟡 | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] No `route.js.nft.json` under `.next/server/app/api/` references a chunk containing the full `googleapis` catalog; the largest server chunk traced by `/api/courses/progress` is < 2 MB
- [ ] Icon font ≤ 150 KB; `pnpm check:icons` green; no icon renders as its ligature text on `/`, `/mentoria`, `/area-personal`, a lesson, a post
- [ ] First-load gzipped JS on a blog post down by ≥ 60 KB vs. the pre-task measurement (recorded in the PR)
- [ ] No `.meta` file for a blog post or lesson lists `pricing-all` or `schedule-config` in `x-next-cache-tags`
- [ ] A signed-in page load issues exactly one `/api/credits`; lessons and posts issue no `/api/pricing`
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:messages` green; e2e home + booking specs green

## Phase 3 — Payments & Admin

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [01 Payment ledger accuracy](phase-3-payments-admin/01-payment-ledger-accuracy.md) | `REFACTOR-R4-P3-01` | 🟡 | ⬜ | _tbd_ | |
| [02 Admin students area](phase-3-payments-admin/02-admin-students-area.md) | `REFACTOR-R4-P3-02` | 🟡 | ⬜ | _tbd_ | |
| [03 Daily audit: upcoming classes >15 min are paid](phase-3-payments-admin/03-booking-payment-audit.md) | `REFACTOR-R4-P3-03` | 🟡 | ⬜ | _tbd_ | — added 2026-09-28; after P1-03 |

**Exit criteria**
- [ ] A slot-taken refund within the lookback window produces no reconcile mismatch; `stripe` is imported by no route handler
- [ ] Dead-letter retry of a PaymentIntent writes a `payments` row with the charged amount
- [ ] A student past #100 by email is findable in `/admin/students`; the low-credit count excludes accounts that never booked or bought
- [ ] Every admin POST/PATCH route calls `isValidOrigin`; a `−N` adjustment larger than the balance reports what was actually applied
- [ ] The daily booking-payment audit (P3-03) flags a class whose payment was refunded in Stripe; a clean run emails nothing
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green

## Phase 4 — Cleanup

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [01 Stripe idempotency keys](phase-4-cleanup/01-stripe-idempotency-keys.md) | `REFACTOR-R4-P4-01` | 🟢 | ⬜ | _tbd_ | |
| [02 CLAUDE.md drift + stale comments](phase-4-cleanup/02-docs-drift.md) | `REFACTOR-R4-P4-02` | 🟢 | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] Every `refunds.create` call carries an idempotency key; checkout keys include the amount
- [ ] CLAUDE.md describes the post-cycle-4 state; no comment names QStash, "Vercel cron", or claims `content/` is untraced
- [ ] `pnpm test`, `pnpm build` green

---

## Decisions

_Record Gustavo's answers to the PLAN.md open questions here (task, decision, date)._

- **P1-01 free-call policy — DEFAULT ASSUMED, awaiting Gustavo's confirmation (2026-09-28).**
  Implemented as "at most one non-cancelled `free15min` per user" (confirmed, completed and
  no_show all count; cancelling frees it; a reschedule is exempt). The switch is one guard in
  `BookingService.createBooking` + `IBookingRepository.hasActiveFreeSession`; "one ever" would
  swap it for `hasAnyBooking`-style logic, "no cap" would delete the guard.

## Deviations from plan

- **P1-01 — TRIMMED at Gustavo's request (2026-09-28): no per-request Google Calendar read.**
  The first implementation also read the tutor's calendar (`events.list`) on every `/api/book`,
  on checkout, and twice on a paid confirmation — measured at 470–880 ms per call from a dev
  machine. Gustavo's position: the API is only called by our own web and mobile apps, which
  already offer free slots only; a dishonest signed-in caller could still book any *valid* free
  slot, so the calendar read buys little. What he needs is that **every booking longer than
  15 minutes is backed by a matching payment** — which the in-process length check guarantees.
  Shipped scope:
  - `BookingService.checkSlot` / `assertSlotBookable`: session length (`SESSION_DURATION_MINUTES`),
    15-min grid in the tutor's timezone, min-notice, booking window, working blocks. No network.
    Run by `createBooking` (before any side effect) and by checkout (before the PaymentIntent).
  - Webhook books `start + paid duration`, never the metadata `end_iso`. Its freebusy re-check is
    the one it already had, now asked for the tutor-timezone day (was `startIso.slice(0, 10)`,
    UTC) and matched by instant rather than ISO string.
  - Free-call cap and `/api/book` rate limit kept as specified.
  - Dropped: `ICalendarClient.listBusy` / `ignoreEventId`, the calendar check at booking and
    checkout, and the "compare listBusy with the grid on a real week" pre-merge step. P1-03 no
    longer depends on `ignoreEventId` (its task md is annotated).
  - Consequence to accept: a free-call or pack booking made through the API is not checked against
    the tutor's manual calendar events (the apps only offer free slots; the paid webhook still
    re-checks). Follow-up: **P3-03** (added 2026-09-28), a daily read-only cron auditing that every
    upcoming booking longer than 15 minutes has a matching, un-refunded payment.
- **P1-01 — landed before P1-02** (PLAN order is P1-02 → P1-01), at Gustavo's request. No
  dependency: `hasActiveFreeSession` throws on DB errors by itself.
- **P1-01 — base branch.** The worktree branched from local `staging` (where `docs/refactor/`
  lives, `1037a23`), not `main`.
- **P1-01 — webhook: unparseable `start_iso` → `PermanentWebhookError`.** Deriving the end from a
  garbage start would otherwise throw a `RangeError` → 500 → 3 days of Stripe retries. The
  success broadcast also carries the derived end, not the metadata one.
- **P1-01 — test fixtures.** `buildTestBookingService` now defaults to an all-day schedule
  (pass `schedule` to test real hours); new `fixtures/slots.ts` (`alignedSlot`, `allDaySchedule`,
  `slotAtLocal`). Route tests added for `/api/book` (limiter, error codes) and
  `/api/stripe/checkout` (DomainError → 4xx); DB-gated `hasActiveFreeSession` cases added to
  `SupabaseBookingRepository.test.ts`.
- **P1-02 — base branch / line refs.** Branched after P1-01 landed, so the task md's line refs
  had drifted (the gate was at `PaymentService.ts:447-460`). No behavioural difference.
- **P1-02 — existing `PaymentService.test.ts` gate tests re-stubbed.** The hand-rolled
  `BookingService` mock gained `hasBookingForPayment` (default `false`), and the three
  `REFACTOR-R3-P1-03` gate tests now stub it instead of `findByStripePaymentId`. Their assertions
  are unchanged; only the method that says "a booking exists" moved. The `R3-P1-03` file-header
  comment in `PaymentService.ts` was reworded ("confirmed booking" became any status).
- **P1-02 — fixture flags are per read, only where a test drives them:** `isProcessedShouldFail`
  and `wasRefundedShouldFail` (payment), `listByUserShouldFail` and
  `hasBookingForPaymentShouldFail` (booking), `getCreditsShouldFail` (credits).
- **P1-02 — tests beyond the plan.** `fail-closed.test.ts` also asserts the "genuinely absent"
  answer for every read, and covers `decrementCredit` / `restoreCredit` (the other `findUserId`
  paths). It mocks `@/lib/realtime-channel`, which throws at import without its secret.
  `AccountService.test.ts` adds a control case: both reads succeed, so the account IS erased.
  No route-level test for `DELETE /api/account` → 500: `mapDomainErrorToResponse` already maps
  any non-`DomainError` to 500.
- **P1-02 — checks.** `pnpm test` 157/157 suites, 2032 tests (DB-gated suites ran against the test
  DB). `pnpm lint` 0 errors. `tsc --noEmit` shows 1 error, in `src/lib/courses/__tests__/mdx.test.ts`
  (`RepoLink`), which predates this diff. `pnpm build` and `pnpm test:e2e` were NOT run.
- **P1-01 — `pnpm test:e2e` NOT run:** `:3000` was held by the main checkout's dev server, which
  Playwright would have reused (testing the wrong code). The reschedule/cancellation specs were
  changed (seed from `/api/availability`, fail instead of skip) but are unverified.

## Known regressions introduced

- **P1-02 — cancelling a pack class during a Supabase read error now answers 500 after the
  cancel token is consumed** (`restoreCredit`'s user lookup throws instead of silently reporting
  "no pack"). Expected per the task's gotchas: the booking is cancelled either way, and the old
  behaviour lost the credit without telling anyone. Closes with **P1-04** (atomic cancel).
