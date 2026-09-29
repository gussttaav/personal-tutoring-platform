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
| [03 Reschedule keeps the original booking until the new one commits](phase-1-correctness/03-reschedule-keeps-original.md) | `REFACTOR-R4-P1-03` | 🟠 | ✅ | Claude | local (`claude/reschedule-keeps-original-f9db78`) — teardown moved after the emails, see Deviations; build + e2e not run |
| [04 Atomic cancel, credit back to the originating pack](phase-1-correctness/04-atomic-cancel-restore-pack.md) | `REFACTOR-R4-P1-04` | 🟡 | ✅ | Claude | local (`claude/atomic-cancel-restore-pack-f65329`). `0023` applied to the TEST DB only, see Deviations; e2e not run |

**Exit criteria**
- [x] `POST /api/book` with an off-hours start ~~, a busy slot,~~ or `endIso − startIso` ≠ the session type's length → 4xx, no calendar event, no credit spent _(P1-01; service + integration + route tests. "Busy slot" dropped with the trimmed scope)_
- [x] Paid checkout for a mismatched duration → 4xx before any PaymentIntent exists; the webhook books `startIso + duration`, never the metadata `end_iso` _(P1-01; service + integration + route tests)_
- [x] Forced Supabase error in any idempotency read during a duplicate webhook → 500 (Stripe retries), no refund, no second booking _(P1-02; mocked-client repository test + in-memory PaymentService tests)_
- [x] Forced failure after the reschedule's old-token claim → the original booking is `confirmed` again with a working cancel link _(P1-03; service (mock) + integration (in-memory: calendar, booking insert, Zoom session insert) + DB-gated `reinstateBooking` tests; e2e not run)_
- [x] Cancelling a pack class returns the credit to `bookings.credit_pack_id`'s pack in the same transaction; `creditsRestored` is false whenever nothing was restored _(P1-04; DB-gated RPC tests against the test DB + service (mock) + integration (in-memory) tests. `0023` is NOT on production yet)_
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
- **P1-04 expired originating pack — DEFAULT ASSUMED, awaiting Gustavo's confirmation (2026-09-29).**
  `cancel_booking` (migration `0023`) restores to the originating pack if it is still
  redeemable and not full, else to the earliest-expiring active pack with room (the pre-0023
  rule), else restores nothing. It reports `restored: false`, the API / `/cancelar` / email say
  so, and `BookingService` logs an `error` naming the event for manual follow-up. The
  alternatives (extend the originating pack's `expires_at`, or restore into the expired pack
  anyway) would each be a change to the `ELSE` branch of `cancel_booking` only.

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

- **P1-03 — teardown runs after step 9 (emails), not at the task's "8b".** Step 9 starts with
  `users.getLocale()`, a DB read that can throw and trigger compensation. Had the original
  already been torn down, the reinstate would bring back a `confirmed` row whose calendar
  event, Zoom session and pending termination were gone. After step 9 nothing can throw
  (`sendWithRetry` swallows), so the teardown is now step 10, right before `return`.
- **P1-03 — fixture fix: `InMemoryBookingRepository.findByStripePaymentId`** returned `null` on
  the first *cancelled* row carrying the PaymentIntent instead of skipping it (the Supabase impl
  filters `status = 'confirmed'`). With a rescheduled paid class the cancelled original comes
  first, so the fake hid the new booking; it now `continue`s.
- **P1-03 — fixture additions.** `InMemoryBookingRepository` remembers each consumed token pair
  per eventId (standing in for the recomputed HMACs), so `reinstateBooking` restores the
  ORIGINAL tokens; `createBookingShouldFail` simulates the insert failing. It does not model the
  exclusion constraint: the reinstate-returns-`false` path is covered by the mock-based service
  test and the DB-gated repository test (a second confirmed booking on the freed slot → `23P01`).
  The Zoom-session-insert failure in the integration suite uses `jest.spyOn` on the in-memory
  session repo rather than a new flag.
- **P1-03 — `BookingService.test.ts` now mocks `@/lib/logger`** (file-wide) to assert the
  "manual intervention" error log on a failed reinstate.
- **P1-03 — tests beyond the plan.** Mock suite: the new booking is cancelled *before* the
  reinstate (reverse compensation order — needed for an overlapping original to come back);
  teardown calls come after the Zoom session insert; a failing teardown step does not fail the
  reschedule; a claim that never happened (`RESCHEDULE_TOKEN_CONSUMED`) reinstates nothing; a
  failed pack reschedule touches no credits. DB-gated: `reinstateBooking` on a non-cancelled row
  → `false`; `findByCancelToken` returns `stripePaymentId`. (`creditPackId` is not DB-tested — it
  needs a `credit_packs` row for the FK; the in-memory integration test covers the transfer.)
- **P1-03 — legacy pack bookings.** A pack class booked before BOOKING-PACKLINK-01 has a null
  `credit_pack_id`; rescheduling it now carries the null over (the old restore + decrement
  re-linked it to whichever pack `decrement_credit` picked). Only affects display of `packSize`
  for such rows, and only if any are still upcoming.
- **P1-03 — checks.** `pnpm test` 157/157 suites, 2052 tests (DB-gated suites ran against the test
  DB: `SupabaseBookingRepository.test.ts` 19/19, none skipped). `pnpm lint` 0 errors (8
  pre-existing warnings, none in touched files). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error. `pnpm build` NOT run.
- **P1-03 — `pnpm test:e2e` NOT run.** `:3000` is held by the main checkout's dev server, and
  `.env.e2e.local` points at the SAME Supabase project and Google calendar as `.env.local` —
  `resetTestState` truncates every table there and clears the calendar's future events, i.e.
  the data that dev server is using. Left for Gustavo to run once `:3000` is free
  (`reschedule.spec.ts`, plus `cancellation.spec.ts` and the booking specs for the phase exit).

- **P1-04 — `0023` applied to the TEST project only** (`lgfntdmrbzlvepngucyo`, via
  `supabase db push --project-ref …` from the worktree: 0023 was the only pending migration there,
  confirmed with `--dry-run`. The main checkout's CLI link to production was not touched.)
  **Production must get `0023` BEFORE this code deploys:** `/api/cancel` calls the new
  `cancel_booking` RPC, and without it every cancellation would 500.
- **P1-04 — `types.ts` regenerated from the test project.** Besides the two new RPCs, the
  generator re-sorted three tables alphabetically (`booking_settings`, `user_pricing`,
  `working_hours`, content unchanged) and parenthesised its helper generics (newer CLI). No hand edits.
- **P1-04 — SQL: `fromOriginating` uses `IS NOT DISTINCT FROM`**, not the task's `=`. For a legacy
  booking with no `credit_pack_id`, `v_target = NULL` yields SQL NULL, which would have put a JSON
  `null` in the result instead of `false`.
- **P1-04 — saga compensation throws when `restoreCreditToPack` returns false** (pack full/expired
  between the decrement and the failure). The task snippet ignored the boolean; throwing makes
  `compensate()` log it as "Compensation failed (manual intervention may be needed)", the same
  pattern as P1-03's reinstate. With no `packId` it still calls `restoreCredit(email)`.
- **P1-04 — the restore's audit entry is best-effort on the cancel path.** `recordRestore` runs
  after the RPC has committed; a failing audit insert is caught and logged (`warn`) rather than
  turning a finished cancel into a 500 whose retry would hit a dead link.
- **P1-04 — fixtures.** `InMemoryBookingRepository` takes an optional `InMemoryCreditsRepository`.
  Cancelling a pack class without it THROWS (loud, not a silent "not restored"). Non-pack
  cancels don't need it. `cancelByTokenShouldFail` simulates the RPC failing. The credits fake
  gained `restoreCreditToPack` (expiry-checked, no pack_size cap, like its `restoreCredit`) and
  fixture-only `packIdOf` / `setExpiresAt`. It keeps one pack per user, so the "fallback to
  another pack" branch is covered only by the DB-gated test.
- **P1-04 — tests beyond the plan.** DB-gated: a legacy (unlinked) pack booking falls back to the
  earliest-expiring pack; a non-pack cancel leaves packs alone; malformed / unknown tokens;
  `restoreCreditToPack` in `SupabaseCreditsRepository.test.ts` (restores, refuses full, refuses
  expired). Service: audit entry shape, audit failure doesn't fail the cancel, an RPC failure
  runs no teardown, a stray `restored: true` on a non-pack class is ignored, compensation fallback
  and failure logging. Integration: failed RPC → booking still confirmed and the retry works;
  two concurrent service-level cancels → one `CANCEL_TOKEN_CONSUMED`, one credit.
- **P1-04 — atomicity is shown, not forced, at the DB level.** The "forced RPC failure leaves the
  booking confirmed" criterion is tested in-memory (`cancelByTokenShouldFail`) and with mocks. On
  Postgres it holds because one plpgsql function is one transaction; nothing in the schema lets a
  test make the restore UPDATE fail mid-function.
- **P1-04 — checks.** `pnpm test` 157/157 suites, 2072 tests (DB-gated suites ran against the test
  DB, none skipped: `SupabaseBookingRepository.test.ts` 24, `SupabaseCreditsRepository.test.ts` 7).
  `pnpm lint` 0 errors (the same 8 pre-existing warnings). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error. `pnpm build` green.
- **P1-04 — `pnpm test:e2e` NOT run**, for the same reason as P1-03: `.env.e2e.local` targets the
  test DB your `:3000` dev server uses, and `resetTestState` truncates it. `cancellation.spec.ts`
  is the one to run (plus the booking/reschedule specs for the phase exit).
- **P1-04 — follow-ups noticed, not done (out of scope):**
  - `cancelByToken` still awaits `users.getLocale()` AFTER the cancel commits, and that read throws
    on a DB error. The credit is now safe, but the student would get a 500 for a completed cancel,
    no email, and a dead link on retry.
  - When a pack class's credit can't be restored, the email falls through to `refundMsg` ("if you
    paid for this session individually…"), which doesn't fit a pack class. `history-stats.ts` also
    still assumes a cancelled pack class always got its credit back ("crédito devuelto").

## Known regressions introduced

- **P1-02 — cancelling a pack class during a Supabase read error now answers 500 after the
  cancel token is consumed** (`restoreCredit`'s user lookup throws instead of silently reporting
  "no pack"). Expected per the task's gotchas: the booking is cancelled either way, and the old
  behaviour lost the credit without telling anyone. Closes with **P1-04** (atomic cancel).
  _Closed by P1-04: the restore is inside `cancel_booking` (no separate user lookup), and an RPC
  error leaves the booking confirmed with a working link._
- **P1-03 — a rescheduled paid class shows its price twice in booking history.** The cancelled
  original and the new booking now share the PaymentIntent, and `deriveAmount`
  (`booking-history.ts`) resolves it for both rows regardless of status. Accepted in the task's
  gotchas (pack reschedules already behaved like this); deduplication is out of scope.
