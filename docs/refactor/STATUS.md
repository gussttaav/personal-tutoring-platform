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
| [01 `@googleapis/calendar` instead of `googleapis`](phase-2-performance/01-googleapis-calendar-only.md) | `REFACTOR-R4-P2-01` | 🟠 | ✅ | Claude | local (`claude/googleapis-calendar-refactor-116297`). Largest chunk traced by `/api/courses/progress`: 10,126 KB → 1,313 KB. See Deviations; e2e + Vercel cold-start not run |
| [02 Shell weight: icon-font subset + Sentry Replay](phase-2-performance/02-shell-weight-font-sentry.md) | `REFACTOR-R4-P2-02` | 🟠 | ✅ (JS target missed) | Claude | local (`claude/shell-weight-font-sentry-ae2679`). Icon font 3,943,736 → 14,840 bytes; LCP 25.3 s → 6.7 s (`/`). Blog-post JS −38.5 KB gz, short of the ≥ 60 KB target; see Deviations. Replay drop confirmed by Gustavo |
| [03 Commerce providers out of the root layout](phase-2-performance/03-commerce-providers-scope.md) | `REFACTOR-R4-P2-03` | 🟡 | ✅ | Claude | local (`claude/commerce-providers-scope-refactor-d2bdb8`). `.meta` files tagged `pricing-all`/`schedule-config`: 124 of 124 → 8 of 124 (+ `/api/policy`), no blog/course page among them. Also mounted on `/sesion/[token]` (a consumer the task md missed); see Deviations. Footer-modal source = lazy `/api/policy` (confirmed by Gustavo, see Decisions) |
| [04 One user-session state for the whole page](phase-2-performance/04-single-user-session-state.md) | `REFACTOR-R4-P2-04` | 🟡 | ✅ | Claude | local (`claude/single-user-session-state-da819a`). Signed-in `/api/credits` per full load: 1 on `/`, `/mentoria`, `/area-personal` and a lesson; tab focus +1, then +0 inside the cooldown. The context lives in the hook file (no circular import), see Deviations; e2e not run |

**Exit criteria**
- [x] No `route.js.nft.json` under `.next/server/app/api/` references a chunk containing the full `googleapis` catalog; the largest server chunk traced by `/api/courses/progress` is < 2 MB _(P2-01; 0 of 41 routes, largest 1,313 KB, which is the Stripe chunk)_
- [x] Icon font ≤ 150 KB; `pnpm check:icons` green; no icon renders as its ligature text on `/`, `/mentoria`, `/area-personal`, a lesson, a post _(P2-02; 14,840 bytes, 107 icons; width audit on every page in the task's acceptance list, desktop + mobile)_
- [ ] First-load gzipped JS on a blog post down by ≥ 60 KB vs. the pre-task measurement (recorded in the PR) _(P2-02 got −38.5 KB: 352.5 → 314.0 KB. Replay was smaller than the audit assumed; see Deviations)_
- [x] No `.meta` file for a blog post or lesson lists `pricing-all` or `schedule-config` in `x-next-cache-tags` _(P2-03; 0 of the 104 blog/course `.meta` files. Still tagged: `es`/`en` home, `mentoria`, `pago-exitoso`, `sesion-confirmada`, `terminos`, and `/api/policy`)_
- [x] A signed-in page load issues exactly one `/api/credits`; lessons and posts issue no `/api/pricing` _(P2-03 closes the `/api/pricing` half: a signed-in lesson load requested only `/api/auth/session`; `/mentoria` requests `/api/pricing` once. P2-04 closes the `/api/credits` half: 1 per full load on `/`, `/mentoria`, `/area-personal` and a lesson)_
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:messages` green; e2e home + booking specs green

## Phase 3 — Payments & Admin

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [01 Payment ledger accuracy](phase-3-payments-admin/01-payment-ledger-accuracy.md) | `REFACTOR-R4-P3-01` | 🟡 | ✅ | Claude | local (`claude/payment-ledger-accuracy-3648e9`). Route test rewritten (not in the file list), see Deviations; backfill + manual cron call not done |
| [02 Admin students area](phase-3-payments-admin/02-admin-students-area.md) | `REFACTOR-R4-P3-02` | 🟡 | ✅ | Claude | local (`claude/admin-students-area-refactor-b832e2`), Parts A + B in one change. `0024` applied to the TEST DB only; **apply to production before deploying** (the students page and dashboard call the new RPC). `admin-api-routes.test.ts` updated (not in the file list), see Deviations; e2e not run |
| [03 Daily audit: upcoming classes >15 min are paid](phase-3-payments-admin/03-booking-payment-audit.md) | `REFACTOR-R4-P3-03` | 🟡 | ✅ | Claude | local (`claude/booking-payment-audit-refactor-247fd4`). Own `BookingPaymentAuditService` (not `PaymentService`). Review-only runs log `warn`, not `error`, see Deviations. **cron-job.org job not created yet** (daily 07:00 Europe/Madrid); staging run not done |

**Exit criteria**
- [x] A slot-taken refund within the lookback window produces no reconcile mismatch; `stripe` is imported by no route handler _(P3-01; in-memory test drives a real slot-taken webhook, then reconciles. Only `import type Stripe` remains, in the webhook route)_
- [x] Dead-letter retry of a PaymentIntent writes a `payments` row with the charged amount _(P3-01; in-memory test for a `pi_…` retry, mock tests for the legacy `amount_total` branch)_
- [x] A student past #100 by email is findable in `/admin/students`; the low-credit count excludes accounts that never booked or bought _(P3-02; service test with 120 students, DB-gated RPC test, and a manual check on the test DB: 111 seeded students, `?q=` found #107, page 3 = 101–111, 5 course-only users absent)_
- [x] Every admin POST/PATCH route calls `isValidOrigin`; a `−N` adjustment larger than the balance reports what was actually applied _(P3-02; all 7 admin mutation routes checked by grep. Route tests with the real `isValidOrigin`; `−3` on 1 credit → `{ requested: -3, applied: -1 }` in service tests and by curl)_
- [x] The daily booking-payment audit (P3-03) flags a class whose payment was refunded in Stripe; a clean run emails nothing _(P3-03; service tests over the fakes (a refunded single and a refunded pack) + route tests (no email on a clean run). The real-Stripe refund mapping is unit-tested with a mocked SDK only: the staging run with a dashboard refund is still to do)_
- [x] `pnpm test`, `pnpm lint`, `pnpm build` green _(on the P3-03 branch, which carries P3-01 and P3-02: 169/169 suites, 2235 tests; lint 0 errors; build green)_

## Phase 4 — Cleanup

| Task | Tag | Sev | Status | Owner | PR |
|------|-----|-----|--------|-------|----|
| [01 Stripe idempotency keys](phase-4-cleanup/01-stripe-idempotency-keys.md) | `REFACTOR-R4-P4-01` | 🟢 | ✅ | Claude | local (`claude/stripe-idempotency-keys-65b776`). The task's refund cast did not typecheck with a second argument and was dropped; two existing refund assertions updated for the new argument, see Deviations; e2e not run (no UI change) |
| [02 CLAUDE.md drift + stale comments](phase-4-cleanup/02-docs-drift.md) | `REFACTOR-R4-P4-02` | 🟢 | ✅ | Claude | local (`claude/docs-drift-cleanup-8a5a93`). Also documents P3-03 + P4-01 (shipped after the task was written) and fixes four older CLAUDE.md drifts found in the review, see Deviations |

**Exit criteria**
- [x] Every `refunds.create` call carries an idempotency key; checkout keys include the amount _(P4-01; `grep -rn "refunds.create" src` → one call, keyed `refund:slot_taken:<pi>`. Service tests over the fake: a failed refund record + redelivery replays one refund and records it; a price edit inside one window → two keys; no edit → one key)_
- [x] CLAUDE.md describes the post-cycle-4 state; no comment names QStash, "Vercel cron", or claims `content/` is untraced _(P4-02; one gotcha per cycle-4 convention, each naming its file. `grep -rn QStash src` → only `csrf.ts`'s historical `REFACTOR-R3-P4-01` note; the "Vercel cron" hits all say "not Vercel crons". Every path CLAUDE.md names exists)_
- [x] `pnpm test`, `pnpm build` green _(P4-02 branch, which carries the whole cycle: 169/169 suites, 2239 tests; build green, 192/192 static pages. Lint on the three touched code files clean)_

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

- **P2-02 Session Replay — DROP, confirmed by Gustavo (2026-09-29).** Replay is removed from the
  client `Sentry.init`; `next.config.mjs` (CSP) is untouched. Re-adding it later: prefer the
  lazy-load variant in the task md (it needs `https://browser.sentry-cdn.com` in both CSP
  `script-src` branches; `lazyLoadIntegration` is exported by `@sentry/nextjs` 10.53).
- **P2-03 footer modal source: lazy fetch, confirmed by Gustavo (2026-09-29).**
  Lazy fetch of the static `/api/policy` on the first open of the cancellation or terms modal, on
  pages without CommerceProviders. The alternative (footer entries become plain links to
  `/terminos` on non-commerce pages) would replace `usePolicyNumbers` in `FooterModals.tsx` and
  make `src/app/api/policy/` deletable.

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

- **P2-01 — version: `@googleapis/calendar@^9.8.0`, not the latest (20.x).** 9.x is the last major
  on `googleapis-common@^7`, which accepts `google-auth-library@^9.7.0`. From 10.x on it is
  `googleapis-common@8`, which needs `google-auth-library@10`. `pnpm why google-auth-library` →
  one copy (9.15.1), shared by the direct dep, `googleapis-common` and `GoogleIdTokenVerifier`.
  Lockfile: `googleapis@144.0.0` out, `@googleapis/calendar@9.8.0` in, nothing else moved.
- **P2-01 — the baseline counted 37 of 41 route traces, not the task's 32 of 43.** Measured on a
  build of this worktree at `b9917ac` (before the change) with a scratch script that walks every
  `route.js.nft.json`. The file-top comment quotes 37 of 41.

  | | before | after |
  |---|---|---|
  | routes tracing the googleapis catalog (a chunk with `drive_v3` / `youtube_v3` / …) | 37 / 41 | 0 / 41 |
  | largest chunk traced by `/api/courses/progress` | 10,126 KB (googleapis, ~19.3k refs) | 1,313 KB (Stripe, unchanged) |
  | all chunks traced by `/api/courses/progress` | 12,525 KB | 3,167 KB |
  | same, `/api/auth/[...nextauth]` | 12,483 KB | 3,125 KB |
  | chunk holding the Calendar client (`calendar_v3` + auth + gaxios) | inside the 10 MB one | 768 KB |

- **P2-01 — `__resetCalendarClient()` exported as a test hook** (the task offered it or
  `jest.resetModules()`). `CalendarClient.test.ts` calls it in `beforeEach`. Two new cases:
  two `getAvailableSlots` calls → `GoogleAuth` and `calendar()` built once, freebusy queried
  twice; after a reset the next call builds a fresh client.
- **P2-01 — real-calendar check was a scripted smoke test, not the UI flow.** A scratch `tsx`
  script loaded the env the way `pnpm dev` does (`@next/env`), refused to run unless
  `GOOGLE_CALENDAR_ID` was the test calendar (the one in `.env.local` / `.env.e2e.local`, not
  `.env`'s), and drove the real `CalendarClient`: freebusy (slot free) → `events.insert` of one
  event at 05:00 Madrid on 2027-06-15, outside working hours and past the booking window
  → freebusy (slot busy) → `events.delete` → freebusy (slot free). It also ran
  `cleanup.ts`'s construction pattern for a read-only `events.list`. **1 service-account token
  exchange across the client's 6 calls** (counted on `JWT.prototype.refreshTokenNoCache`). The
  webhook re-check is the same `getAvailableSlots` → freebusy path.
- **P2-01 — checks.** `pnpm test` 157/157 suites, 2074 tests. `pnpm lint` 0 errors (the same 8
  pre-existing warnings, none in touched files). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error; the project config includes `e2e/**`, so `cleanup.ts` is
  typechecked. `pnpm build` green, before and after.
- **P2-01 — NOT done:** `pnpm test:e2e` (same reason as P1-03/P1-04: `resetTestState` truncates
  the test DB and clears the future events of the calendar your dev server uses; the calendar
  had one future event at the time), the manual book/cancel/reschedule in the UI, and the Vercel
  cold-start comparison on `/api/courses/progress` (no preview deploy from here; the Vercel MCP
  isn't authorized in this session). For the phase exit, run one booking spec to confirm
  `clearTestCalendar` still wipes events.

- **P2-02 — measurements** (both builds made from this worktree's tree: baseline = a detached
  worktree at `11d76e2`, after = this branch; gzip -9 of every `/_next/static/chunks/*.js` the
  prerendered HTML references; Lighthouse 13.5 mobile, 3 runs, median, `pnpm start`):

  | | before | after |
  |---|---|---|
  | icon font (`material-symbols-outlined.woff2`) | 3,943,736 B (full variable, 4 axes) | **14,840 B** (107 glyphs, `FILL` axis only) |
  | first-load JS gz, `es/blog/de-newton-a-adamw` | 352.5 KB | **314.0 KB (−38.5)** |
  | same, `es` (home) / `es/mentoria` / lesson `adios-recurrencia` | 402.7 / 405.3 / 371.6 KB | 364.2 / 366.8 / 333.1 KB |
  | Sentry's big shared chunk | 168.2 KB gz (135 `replay` refs) | 129.7 KB gz (6 `replay` refs) |
  | Lighthouse `/`: perf / LCP / TBT / bytes | 42 / 25.3 s / 1,709 ms / 4,604 KB | 45 / **6.7 s** / 1,935 ms / 729 KB |
  | Lighthouse blog post: perf / LCP / TBT / bytes | 37 / 25.9 s / 4,803 ms / 4,921 KB | 38 / **7.7 s** / 2,258 ms / 1,045 KB |

- **P2-02 — the ≥ 60 KB JS criterion is NOT met (−38.5 KB).** The audit estimated Replay at about
  half of Sentry's ~186 KB; it was 38.5 KB gz. What remains in the 129.7 KB chunk is the core
  browser SDK plus browser tracing (`tracesSampleRate: 0.1`, out of scope for this task). One more
  lever was tried and reverted: `compiler.define: { __SENTRY_DEBUG__: "false" }`. The existing
  `webpack.treeshake.removeDebugLogging: true` is a webpack `DefinePlugin` and does nothing under
  Turbopack, but defining the flag saved 0.1 KB (the published SDK build already strips debug
  code). The next lever is `__SENTRY_TRACING__: false` / dropping client tracing. That's a product
  decision for Gustavo, so it is not in this change.
- **P2-02 — 107 icons, not "< 100".** `src/components/ui/feedback.tsx` (`IconHalo`, `InfoRow`,
  `Steps`, `MiniIcon`) takes its icon through a `glyph` prop, not `icon`, so the guard treats
  `icon` AND `glyph` props / keys / variables / destructuring defaults as icon sources. Without
  `glyph`, eight names (`task_alt`, `link_off`, `manage_accounts`, `calendar_today`, `tag`, …) would
  have been missing from the subset.
- **P2-02 — extra file: `src/app/[locale]/fonts/material-symbols-outlined.json`** (written by
  `build:icons`: the names the woff2 was built from + its sha256). `check:icons` compares it with
  `ICON_NAMES` and the woff2 on disk, so adding a name without re-running `build:icons` fails CI.
  The task's guard alone would pass in that case and ship the ligature text.
- **P2-02 — guard shape.** The extractor lives in `src/lib/icons/check-icons.ts` (pure, TypeScript
  compiler API; `scripts/check-icons.ts` only walks `src/` and reports), mirroring
  `check-messages`. Rules beyond the task's three patterns: an icon element's expression child that
  is neither a literal nor a read of `icon`/`glyph` (`{symbol}`, `{iconFor(x)}`) fails with "route
  it through an `icon`/`glyph` prop" (there are none today). "Unused" is lenient: a listed name that
  appears as ANY string literal in `src/` counts as used, so a hand-added runtime name only needs a
  literal somewhere. Test files are skipped. Unit test: `src/lib/icons/__tests__/check-icons.test.ts`
  (17 cases). Verified by hand that the guard fails on an unknown text-child icon, an unknown
  `icon:` key, a stale entry, and a list edit without `build:icons`.
- **P2-02 — build script.** Google's woff2 URL has no `.woff2` suffix (`fonts.gstatic.com/l/font?kit=…`),
  so the sketch's `/url\((https:[^)]+\.woff2)\)/` would not match; the script reads the
  `src: url(…) format('woff2')` pair and checks the `wOF2` magic. Output checked with fontTools:
  `fvar` axes = `FILL 0..1` only, all 107 ligatures present.
- **P2-02 — `admin.css` untouched.** `.admin-shell .material-symbols-outlined` still sets
  `"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24`. The subset has no wght/GRAD/opsz axes, so browsers
  ignore those three. It's harmless, and the file isn't in the task's list.
- **P2-02 — visual pass method.** The Browser pane returned blank screenshots after scrolling, so
  pages were driven with the project's Playwright Chromium against `pnpm start` of this build: every
  `.material-symbols-outlined` element's width must be ≤ 1.35 em (a missing ligature renders as
  the word: `rocket_launch` measured 192 px vs. 24 px for a subset glyph). Covered at 1280 and 390 px:
  `/`, `/en`, `/mentoria`, `/cursos`, lesson `dl-nlp/adios-recurrencia`, post `de-newton-a-adamw`,
  the mobile nav panel, both booking overlays (`open-smart-book` → sign-in gate,
  `open-availability-modal` → weekly calendar), `/area-personal` (all three tabs, e2e-test student),
  `/admin` + all 12 admin nav pages (desktop), and `/sesion/<token>` pre-join (fake media devices).
  Signed-in pages used locally minted `authjs.session-token` cookies (project `AUTH_SECRET`, test
  DB) with a temporary `.env.production.local` (`AUTH_TRUST_HOST=true`), both removed afterwards.
  `FILL`: the pressed feedback thumb computes `"FILL" 1` and renders filled; a sheet of all 107
  glyphs at FILL 0 / FILL 1 renders every one. `CourseProgressCard` wasn't reachable (the test
  student has no course in progress); it uses the same inline `'FILL' 1` the sheet exercises.
- **P2-02 — checks.** `pnpm test` 158/158 suites, 2091 tests. `pnpm lint` 0 errors (the same 8
  pre-existing warnings, none in touched files). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error. `pnpm build` green. `check:messages` ✓, `check:icons` ✓.
  `check:bundle` red on the known `gt:pyodide-loaded` false positive only (one hit, lesson route).
- **P2-02 — NOT done:** `pnpm test:e2e` (`e2e/global-setup.ts` truncates the whole test DB, wipes
  the test calendar and pushes migrations on every run, and that DB holds the data your dev server
  uses; `home.spec.ts` + one booking spec are the ones to run). Also not done: "client errors still
  reach Sentry" (needs a preview deploy with a throwing test button; the client `Sentry.init` keeps
  the same DSN/tunnel/`enabled`, only `integrations` and the replay rates went away).
- **P2-03 — a sixth commerce page: `/sesion/[token]`.** The task md's consumer list missed it:
  `PreJoinSetup` mounts `PackBookingOverlay`, whose `BookingModeView` (→ `WeeklyCalendar`,
  `BookingSidebar`) calls `useScheduleConfig()`, which would throw once a pack student opened the
  pack booking from the pre-join screen. Its signed-in branch is wrapped in `CommerceProviders`
  (the page is dynamic, so this adds no build-time read). The sign-in prompt branch isn't wrapped;
  its footer modal falls back to `/api/policy`. `/inicio` needs no change: it renders `HomePage`,
  which wraps itself.
- **P2-03 — `/pago-exitoso` and `/sesion-confirmada` are wrapped in their `layout.tsx`, not
  `page.tsx`.** Both pages are client components and can't render an async server component.
  Their pass-through layouts (SEO-02) now take `params` and mount `CommerceProviders`.
- **P2-03 — `FooterModals` details beyond the sketch.** It fetches only when the cancellation or
  terms modal opens (privacy quotes no numbers). The fetch checks `r.ok` (the sketch's
  `r.json()` would have stored a 5xx error body as the numbers). A ref guards against a second
  request while one is in flight, and a failure clears it: the skeleton stays, and the next open
  retries. The response type reuses `PolicyNumbers` from `PolicyContent.tsx` rather than
  declaring a second copy.
- **P2-03 — new dev dependencies for the component tests:** `jest-environment-jsdom@^30.4.1`
  (matches the installed Jest 30.4), `@testing-library/react@^16.3.3`, `@testing-library/dom@^10.4.2`.
  The repo had no DOM test tooling. Only the two new `.test.tsx` files opt in, through a
  `@jest-environment jsdom` docblock, so the rest of the suite stays on `node`. The lockfile
  diff is additions only (417 lines); no existing resolution changed.
- **P2-03 — tests beyond the plan.** `src/components/commerce/__tests__/CommerceProviders.test.tsx`
  also checks that `CommerceProviders` feeds every hook from the three loaders, with prices in the
  page's locale and `UserPricingSync` inside (an anonymous viewer is never "syncing").
  `src/app/api/policy/__tests__/route.test.ts` checks the JSON shape and `force-static`.
- **P2-03 — comments corrected, outside the task's file list, because this change made them
  false.** `pricing-display.ts` and `schedule-config.ts` (the PERF-11 note said the layout reads
  these caches on every route; the 30-day window is left alone, as the task says),
  `StructuredData.tsx` ("already loaded in the root layout"), `UserPricingSync.tsx` ("baked into
  the static layout"). CLAUDE.md is left for P4-02, whose task already lists the P2-03 update.
- **P2-03 — middleware wording.** The matcher does NOT exclude `/api/*`
  (`/((?!_next/static|_next/image|favicon.ico|monitoring).*)`). The middleware *function* skips
  next-intl for `/api` (`isUiPath`), so the route is locale-free all the same.
  `GET /api/policy` → 200 unprefixed, verified.
- **P2-03 — measurements.** Before: the main checkout's build of 2026-09-29 21:32 had 124 of 124
  `es`/`en` `.meta` files tagged, 104 of them blog/course pages. After (this worktree's build): 8 of
  124 (`es`, `en`, `{es,en}/mentoria`, `{es,en}/pago-exitoso`, `{es,en}/sesion-confirmada`,
  `{es,en}/terminos`) plus `api/policy.meta`. Blog and course routes no longer carry a revalidate
  window in the build's route table (they showed 30d before). `/area-personal`, `/inicio` and
  `/sesion/[token]` are dynamic, so they have no `.meta`. `/api/policy` is `○` static, 30d,
  body `{"packValidityDays":180,"cancelHours":2}`. Build-check one-liner (must print nothing):
  `grep -lE 'pricing-all|schedule-config' $(find .next/server/app/es .next/server/app/en \( -path '*/blog/*' -o -path '*/cursos/*' \) -name '*.meta') .next/server/app/{es,en}/{blog,cursos}.meta`
- **P2-03 — manual checks** (worktree `pnpm dev` on :3100 against the test DB, `E2E_MODE`, the
  e2e student signed in through `/api/test/auth`). Every route in `src/app/[locale]` answered
  200 or its auth redirect. Blog post, signed out: opening «Política de cancelación» requested
  `/api/policy` once and rendered «2 horas de antelación» / «180 días». Lesson
  `dl-nlp/adios-recurrencia`, signed in: the page load requested only `/api/auth/session`, with no
  `/api/pricing` and no `/api/policy`. `/mentoria`, signed in: one `/api/pricing`; the modal
  rendered the same numbers with no `/api/policy` request. `/pago-exitoso` (whose page calls
  `usePackValidityDays` at the top) and `/sesion-confirmada` render with no console errors.
- **P2-03 — "an admin price edit…" criterion checked structurally, not live.** Blog/lesson
  `.meta` files carry neither tag, so `revalidateTag` can't reach them. `/mentoria` and
  `/api/policy` carry both, so it regenerates them. A live edit needs an admin session on
  `pnpm start` and a write to the `pricing` table; not done.
- **P2-03 — checks.** `pnpm test`: unit 155/155 suites, 2059 tests (+18 new); integration 6/6, 50
  tests. `pnpm lint`: 0 errors (the same 8 pre-existing warnings, none in touched files).
  `tsc --noEmit`: only the pre-existing `mdx.test.ts` (`RepoLink`) error. `pnpm build` green.
  `check:messages` ✓.
- **P2-03 — e2e: 25 of 28 passed on the first run, 26 after one warm re-run; 2 not re-run.**
  Ran the task's specs (`home`, `booking-free`, `booking-pack`, `booking-single`,
  `booking-personal-area`, `courses-navigation`) with `E2E_BASE_URL=http://localhost:3100` against
  a worktree `pnpm dev` on the test DB (a temporary `e2e-worktree` launch config: `.env.e2e.local`
  sourced, `E2E_MODE=true`, `NEXT_PUBLIC_BASE_URL` → :3100; :3000 was held by the main checkout's
  dev server). **The booking specs' `resetTestState()` truncated the whole test DB and wiped the
  test calendar**, as `pnpm test:e2e` always does. The three failures were all the first hit on a
  route in a brand-new `.next/dev` cache, not a provider error. (1) `booking-pack [es]`:
  `/area-personal` rendered with the pack card, but `/api/my-bookings` was still compiling when
  the 15 s wait for «Próxima clase» ran out. (2) `booking-single [es]`: `/sesion-confirmada`
  (wrapped via its layout) rendered in 2.8 s; `/api/stripe/session` was still compiling at 15 s.
  (3) `courses-navigation` «es: navbar Cursos…»: the first `GET /cursos` took 14.9 s next to a 37 s
  cache write. (3) passed on a warm re-run (16.3 s). (1) and (2) were NOT re-run, because a re-run
  truncates the test DB again. Their `[en]` twins passed the same flows through the same pages in
  this run.
- **P2-04 — the context lives in `useUserSession.ts`, not in `UserSessionProvider.tsx`.** The
  sketch put `createContext` + `useUserSessionContext()` in the provider and had the hook import
  them back, which is a circular import (the provider imports `useUserSessionState` from the
  hook). Now the hook file exports `UserSessionContext` next to `useUserSessionState()`.
  `useUserSession()` reads the context directly and throws «useUserSession() must be used inside
  <UserSessionProvider>». The provider only mounts the state. `UserSessionValue` is
  `ReturnType<typeof useUserSessionState>`, so it is the old return shape by construction.
  `UserSessionProvider` is a default export, like `AuthProvider`.
- **P2-04 — `updateCredits` uses a functional `setPackSession` update**, so it can be a
  `useCallback` with no deps (it used to read `packSession` from the closure). Behaviour is the
  same: with no pack it does nothing, `remaining > 0` sets the new count, anything else clears it.
- **P2-04 — no call site, and no comment outside the file list, changed.** `BookingProvider`'s
  `type UserSessionState = ReturnType<typeof useUserSession>` still resolves. The comments in
  `useCourseProgress.ts`, `ratelimit.ts` and `UserPricingSync.tsx` that mention `useUserSession`
  are still true. No existing unit test rendered `Navbar`, `BookingProvider` or
  `PackBookingOverlay`, so no test wrapper needed the provider. `/sesion/[token]` (`PreJoinSetup`
  → `PackBookingOverlay`) is under `[locale]/layout.tsx`, so it gets the provider like every other
  page.
- **P2-04 — tests beyond the plan.** `src/hooks/__tests__/useUserSession.test.tsx` (7 tests, jsdom)
  checks the planned three: one fetch for two consumers, a shared `updateCredits`, and the throw
  outside the provider. It also checks that the callbacks stay stable and the value stays
  memoized across a re-render, that each tab focus refetches once with the 30 s cooldown, that
  sign-out clears both consumers together, and that a signed-out visitor makes no request.
- **P2-04 — manual checks** (worktree `pnpm dev` on :3100 against the test DB, `E2E_MODE`, the e2e
  student signed in through `/api/test/auth`, using the same temporary `e2e-worktree` launch config as
  P2-03, removed afterwards). `/api/credits` Resource Timing entries per signed-in full page load:
  `/en/mentoria` 1, lesson `dl-nlp/adios-recurrencia` 1, `/en` 1 (reached by a same-origin
  navigation, so the middleware served the static home), `/en/area-personal` 1. That last page
  read 0 on its first cold-compile load at 8 s, and 1 on a warm reload. Tab focus on `/mentoria`
  (Navbar + BookingProvider consumers) gave +1 request, then +0 for a second focus inside the
  cooldown. For that check `visibilityState` was forced to `visible`, because the pane reports
  `hidden`. No console or server errors. Not checked live: the Navbar badge after a pack class
  booked in the overlay, and the sign-out clear. The e2e student has no pack credits. The unit
  test covers both, and `booking-pack.spec.ts` covers the badge. No before-measurement was taken;
  the task md's "twice per load" for booking pages follows from the two hook instances there.
- **P2-04 — checks.** `pnpm test`: 162/162 suites (unit 156, integration 6), 2116 tests (7 new).
  `pnpm lint`: 0 errors (the same 8 pre-existing warnings, none in touched files).
  `tsc --noEmit`: only the pre-existing `mdx.test.ts` (`RepoLink`) error. `pnpm build` green.
  `check:messages` not run, since no message keys changed.
- **P2-04 — NOT done:** `pnpm test:e2e` (`booking-pack`, `booking-personal-area`, `home`). The
  booking specs' `resetTestState()` truncates the whole test DB and wipes the test calendar.
  Waiting for Gustavo's go-ahead.
- **P3-01 — the route test was rewritten (not in the file list).**
  `src/app/api/internal/reconcile-stripe/__tests__/route.test.ts` mocked the stripe singleton and
  `@/infrastructure/supabase`, the two imports the task removes, and the acceptance grep covers that
  directory. Once the logic moved to the service, the route ran the real `paymentService` graph over
  those partial mocks. The payment mock had no `wasRefunded`, so both single-session cases answered
  500. Adding `wasRefunded` to the mock would have made the test pass without testing anything
  meaningful. The suite now mocks `@/services` and checks only the route's contract with
  cron-job.org: the 403s, the 48/100/10 arguments, the `{ scanned, mismatches, details }` body, the
  info/error/page-cap log lines (sample capped at 10), and the 500 path. The proof matrix it used to
  cover moved to the service tests. Stopped for Gustavo's go-ahead before rewriting it.
- **P3-01 — service tests beyond the plan.** The slot-taken case is driven through a real
  `processWebhookEvent` (the refund leaves no processed marker) rather than a seeded refund row.
  Also added: a non-succeeded PI is counted but not checked, the lookback window is passed through
  (`createdGte = now − 48 h`), and a proof read error rejects the run instead of reporting false
  mismatches. There are two mock-based cases for the legacy Checkout Session retry: with
  `amount_total` the row is recorded, and without it the class is booked and no row is written.
  With the three fixes reverted, 6 of the new tests fail.
- **P3-01 — `hitPageCap` keeps the old `pageCount === MAX_PAGES` rule.** It is also true when the
  10th page happened to be the last one. The route's warn fired in that case before this change
  too, and the task said only where the work happens changes.
- **P3-01 — `FakeStripeClient.listPaymentIntents`** pages in seed order and throws on an unknown
  `startingAfter` cursor, as Stripe does. `listCalls` records every call so tests can assert the
  cursor chain.
- **P3-01 — found while testing: a failed admin retry cleared its dead-letter and reported
  `{ ok: true }`.** When the retried `createBooking` failed, `processSingleSession` wrote the
  dead-letter again and returned normally. `reprocessFailedBooking` then deleted it. Out of P3-01's
  scope; fixed separately on the same branch as `DEAD-LETTER-RETRY-01` (see below).
- **P3-01 — checks.** `pnpm test`: 162/162 suites, 2130 tests (9 route tests + 11 service tests +
  2 retry mock tests, against 7 old route tests). `pnpm lint`: 0 errors (the same 8 pre-existing
  warnings, none in touched files). `tsc --noEmit`: only the pre-existing `mdx.test.ts`
  (`RepoLink`) error. `pnpm build` green (commit `5d2e0fd`).
- **P3-01 — NOT done:** the manual cron call against the test Stripe account, and the optional
  one-off `payments` backfill for bookings already recovered through the admin retry (the query is
  in the task md; each amount has to be fetched from Stripe).
- **`DEAD-LETTER-RETRY-01` — out of plan, found during P3-01, fixed on the same branch at
  Gustavo's request (a separate commit).** When a `/admin/failed-bookings` retry's booking failed
  again, `processSingleSession` dead-lettered the new failure itself (upsert, same key) and returned
  normally. `reprocessFailedBooking` then deleted the entry and answered `{ ok: true }`. The admin
  saw «Procesado correctamente», the entry vanished, and the student had paid for a class that did
  not exist. The cron only caught it inside its 48 h window. Now `processSingleSession` returns
  its outcome (`booked` / `already_handled` / `refunded` / `dead_lettered`), and the retry clears
  the entry only when the payment is resolved. On `dead_lettered` it keeps the re-written entry
  (new error and `failed_at`) and returns `{ ok: false, error }`, which the route already maps to
  500 and `RetryButton` already shows. The webhook ignores the outcome, so its behaviour is
  unchanged. A retry that ends in a slot-taken refund still clears the entry and reports success,
  as before: the money went back. A failed retry also re-sends the
  dead-letter notification email, as the webhook path does. Tests: 4 in-memory cases (failed
  again keeps the entry with the new error; a later retry still recovers it; a slot-taken retry
  refunds and clears; an already-processed payment clears). 2 of them fail with the fix
  reverted. `pnpm test`: 162/162 suites, 2134 tests. Lint 0 errors. No new `tsc` errors.
  `pnpm build` green.
- **`DEAD-LETTER-RETRY-02` — out of plan, at Gustavo's request: the retry button says the
  student was refunded.** A successful retry used to read «Procesado correctamente» even when
  the slot was taken and the student got their money back instead of a class.
  `reprocessFailedBooking` now returns `outcome` (`booked` / `already_handled` / `refunded`)
  next to `ok: true`. The admin route passes it through unchanged, and `RetryButton` shows
  «↩ Reembolsado al alumno: el hueco ya no estaba libre.» in amber (new `.warning-text`,
  `var(--warning)`) instead of the green ✓. Tests: the retry assertions now include the outcome,
  plus one new case (an earlier refund: `refunded`, no second refund). New
  `src/components/admin/__tests__/RetryButton.test.tsx` (jsdom, 4 cases: the POST, booked,
  refunded, failed-again error). `pnpm test`: 163/163 suites, 2139 tests. Lint 0 errors. No new
  `tsc` errors. `pnpm build` green. Not checked in the browser: that would need an admin session
  (there is none locally) and a real Stripe test refund on a dead-letter row in the test DB.
- **P3-02 — `src/lib/__tests__/admin-api-routes.test.ts` was updated (not in the file list),
  without stopping first.** It `jest.mock`ed the admin `_data.ts` module the task deletes, so the
  suite failed to load ("Could not locate module"). Its POST cases also pinned the behaviour the
  task removes: the route-level `useCredit` loop and a direct `supabaseAuditRepository.append`.
  Also, with the origin check first, its no-`Origin` requests would now answer 403 where it
  expected 401. The mocks now target `adminService`. The 401/403/400 ladder and the GET 200s
  are kept. The POST cases now assert the delegation (`adjustCredits` called with `by: <admin>`),
  the `{ ok, requested, applied }` body, a partial debit, a 500 on a non-domain failure, and
  403 for a cross-site request and for a missing Origin (real `isValidOrigin`, no session read).
  The debit loop itself moved to `AdminService.test.ts`. Gustavo: the skill's rule is to stop on a
  failing test; if you'd rather review this first, the old file is at `HEAD`.
- **P3-02 — counts: one call, both tabs.** `total_count` / `low_credit_count` come from a one-row
  `counts` CTE taken before the low-credit filter and the page window, and the page is LEFT JOINed
  onto it. That way a page with no rows (an empty tab, `?page=99`, `p_limit = 0`) still returns one
  counts-only row with the student columns NULL, and the repository drops it. Without this, an
  empty low-credit tab would have shown "Todos 0". The dashboard's count is the same RPC with
  `p_limit = 0`.
- **P3-02 — RPC details beyond the sketch.** All four params have DEFAULTs (`NULL`, `false`, `50`,
  `0`), so the generated `Args` are optional and a blank search is simply omitted. The generated
  `Returns` marks every column non-null, which is wrong for the dates and the empty-page row, so
  the repository reads through its own nullable row type. `name` falls back with
  `COALESCE(NULLIF(name, ''), email)`: `users.name` is `NOT NULL DEFAULT ''`, so the sketch's
  plain `COALESCE` (and the old `u.name ?? u.email`) never fell back. `REVOKE`/`GRANT` per 0018;
  an anon call now gets `42501 permission denied`.
- **P3-02 — reads throw on a Supabase error.** `_data.ts` rendered a failed query as empty lists
  and zero counts. The repository follows the `if (error) throw error` convention, so the admin
  sees an error page instead of a wrong dashboard. `getStudent` uses `maybeSingle()` (the old
  `.single()` error on "not found" was being swallowed).
- **P3-02 — CSRF check order and body follow the task sketch.** Both POSTs check the origin on
  the first line and answer `{ error: "Forbidden" }`. The other admin routes check it after the
  session and answer `"Invalid origin"`. Left as the task specifies.
- **P3-02 — extras.** `AdminStudentsQuerySchema` (`src/lib/schemas.ts`) parses `?q=`/`?filter=`/
  `?page=` leniently (a bad page reads as 1) for the page and `GET /api/admin/students`. That route
  now takes the same params and returns `{ students, total, lowCreditTotal, page, pageSize }`, with
  `students` kept for compatibility. `admin.css` gained `.pager` and `.adjust-form-notice`. The
  tab counts cover the current search. The search is a `next/form` GET form. The ×, the tabs and the
  pager are links that keep `q`/`filter`. `AdjustCreditsForm` shows the partial-debit notice and
  calls `router.refresh()`, so the notice survives. A full adjustment still reloads, as before.
  Stale comments in `students/[email]/pricing/route.ts` and `ContentFeedbackService.ts` that
  referenced `_data.ts` were updated. Provenance comments avoid the literal `admin/_data` path so
  the acceptance grep stays empty.
- **P3-02 — checks.** `pnpm test`: 166/166 suites, 2169 tests (new: 14 service, 7 DB-gated
  repository, 5 failed-bookings route; admin-api-routes 16 → 20). `pnpm lint`: 0 errors (the same 8
  pre-existing warnings, none in touched files). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error. `pnpm build` green. `supabase gen types` diff is only the new
  function. Manual check (built app, hand-minted admin cookie, curl, 116 temporary
  `p302-manual-*` users seeded into the test DB and deleted afterwards): `/admin/students`
  (111 students / 45 low; `?q=Buscada` found #107; page 3 = 101–111; low-credit tab keeps "Todos
  111"; `?page=99` and an empty search keep both counts), `/admin` (45), a course reader's detail
  page (200) and an unknown email (404). The adjust POST returned 403 cross-site and with no Origin;
  `−3` on 1 credit → `{ requested: -3, applied: -1 }` with both in the audit; `+2` → a
  `manual-<uuid>` pack expiring +180 days. Failed-bookings POST: 403 cross-site; same-origin
  unknown id → 404.
- **P3-02 — NOT done:** `0024` on production. The partial-debit notice in the browser: the Browser
  pane holds Gustavo's own non-admin session as an HttpOnly cookie, which a page script can't
  replace, and it was left alone. The API side was checked by curl. `pnpm test:e2e` was not run.
  The failed-bookings retry button was checked only through the API.

- **P3-03 — its own service, not `PaymentService`** (the task asked to pick one and say so).
  `src/services/BookingPaymentAuditService.ts` holds the pure rules (`evaluateBooking`,
  `expectedPaymentFor`) and `auditUpcoming`. `PaymentService` already carries checkout, the
  webhook, the dead-letter retry and the reconcile cron.
- **P3-03 — a run whose only findings are `review` items logs `warn`, not `error`.** The task's
  §5 and acceptance say "findings → one Sentry `error` log + one tutor email". A pack's partial
  refund is, per §3, "a *review* item, not an error", and it would recur every day while that
  pack's classes stay booked. So the route logs `error` (→ Sentry) when at least one finding is an
  `error`, `warn` (not forwarded to Sentry) when all are `review`, and emails in both cases. A
  clean run logs `info` and sends nothing, as specified.
- **P3-03 — where the email goes out.** The service takes `IEmailClient` (as specified) and exposes
  `emailReport(report)`. The route decides when to call it (only with findings) and turns a send
  failure into a `warn`. `auditUpcoming` never emails, so the service test can assert the audit
  writes nothing, email included.
- **P3-03 — finding shape.** Beyond `code`, each finding carries `severity` (`error` | `review`),
  the booking id, student, type, start, the `paymentId` checked, and `expected` / `actual` as
  `field=value` strings. A class gets one `payment_mismatch` listing every differing field.
  `pack_not_owned` ends that class's checks (no Stripe call for someone else's pack), and a
  manual pack owned by another student is `pack_not_owned`, not a manual pass.
- **P3-03 — the route also refuses an unset `CRON_SECRET`.** The other two internal routes compare
  the header with `` `Bearer ${process.env.CRON_SECRET}` ``, which a literal `Bearer undefined`
  matches when the variable is missing. This route's body lists student emails, so it checks
  `!secret` first. The other two routes are untouched (a follow-up, not this task).
- **P3-03 — `retrievePaymentForAudit` fails closed on an unexpanded `latest_charge`** (it would
  read as "never refunded"). Stripe's `resource_missing` is matched by duck type (`type` +
  `code`), so `StripeClient.ts` still imports the SDK as a type only.
- **P3-03 — legacy Checkout packs would read `payment_not_found`.** A pack bought through the
  legacy Checkout flow stores its `cs_…` session id in `credit_packs.stripe_payment_id`
  (`handlePackPayment(…, stripeSessionId, …)`), and `paymentIntents.retrieve` answers that with
  `resource_missing` (checked against test mode). Checkout-session creation was removed on
  2026-03-22, when packs were valid 180 days, so none should still be redeemable. If one shows
  up, check it by hand, like the pre-`0015` pack classes the task md mentions.
- **P3-03 — files beyond the list.** `BookingService.test.ts` and `PaymentService.test.ts`: one line
  each in their hand-rolled `jest.Mocked<…>` factories, for `tsc`. New
  `src/infrastructure/stripe/__tests__/StripeClient.test.ts` (9 cases: the expand, the mapping,
  no charge, `resource_missing` → null, four other errors rethrown, unexpanded charge → throws).
- **P3-03 — fixtures.** `InMemoryBookingRepository.seedCreditPack` (fixture-only: the credits
  fake keeps one pack per user and no payment id per pack) and
  `listUpcomingForPaymentAuditShouldFail`. `FakeStripeClient.seedAuditPayment` / `failAuditFor` /
  `auditCalls`; an unseeded id answers `null`, as Stripe's `resource_missing` does.
- **P3-03 — tests beyond the plan.** Service: at most 5 Stripe calls in flight (12 PIs), a failed
  read makes no Stripe call, a refunded pack flags every class on it, "writes nothing" (spies on
  every booking/Stripe write + no email), an unparseable timestamp is a `length_mismatch`, and
  `evaluateBooking` throws when a class that has a payment gets no facts. Route: 403 with
  `CRON_SECRET` unset, a review-only run (`warn` + email), the sample cap. DB-gated: completed,
  no-show, cancelled and past rows excluded; a pack owned by another student; `until` exclusive.
- **P3-03 — checks.** `pnpm test`: 169/169 suites, 2235 tests (new: 46 service, 9 route, 9
  `StripeClient`, 2 DB-gated; `SupabaseBookingRepository.test.ts` 26, none skipped, test DB).
  `pnpm lint`: 0 errors (the same 8 pre-existing warnings). `tsc --noEmit`: only the pre-existing
  `mdx.test.ts` (`RepoLink`) error. `pnpm build` green (`ƒ /api/internal/booking-payment-audit`).
- **P3-03 — manual checks (local; nothing written, nothing sent).** This build on `:3217` against
  the TEST DB and the Stripe test key, with `NOTIFY_EMAIL` blanked and a throwaway `CRON_SECRET`:
  403 with no bearer and with a wrong one; 200 `{ checked: 0, findings: 0, details: [] }` in
  0.36 s (the test DB has no confirmed booking in the next 8 weeks). A read-only script against
  Stripe test mode: a succeeded single (1h), a succeeded pack and a `requires_payment_method`
  PaymentIntent mapped as expected with the charge expanded; an unknown `pi_…` and a `cs_…` id →
  `null`; an empty id → throws (`StripeInvalidRequestError`, no code). No refunded PaymentIntent
  among the 100 most recent, so the refund mapping is covered only by the mocked-SDK test. The
  email was rendered with `fetch` stubbed (subject, Madrid times, HTML escaping); nothing sent.
- **P3-03 — NOT done:**
  - The staging run from the task's test plan: in Stripe test mode, a paid class refunded from the
    dashboard, a pack class and a free call → exactly one `payment_refunded` and one email.
  - The cron-job.org job: daily **07:00 Europe/Madrid**, `GET
    https://gustavoai.dev/api/internal/booking-payment-audit`, header `Authorization: Bearer
    <CRON_SECRET>`. The 14:00 second run is optional.
  - Deploy with P1-03 (or after it). Until P1-03 is on production, every paid class rescheduled
    there keeps a NULL `stripe_payment_id` and reads `no_payment_link`. Before the first
    production run, list those with the SQL in the task md and check them by hand.
  - `pnpm test:e2e`: no UI change.

- **P4-01 — `StripeClient.createRefund` passes `params` uncast.** The task's sketch kept
  `params as Parameters<typeof stripe.refunds.create>[0]`, but `Parameters<>` of an overloaded
  function takes the LAST overload, which for `refunds.create` is `create(options?: RequestOptions)`.
  With one argument that typechecked (as request options); with the new second argument tsc
  rejects it (TS2345). `params` is structurally a `RefundCreateParams`, so the cast is gone.
  No runtime change: a type assertion compiles to nothing.
- **P4-01 — fake: `refunds` still means "refunds issued".** A keyed replay adds nothing to it, so
  every existing `stripe.refunds` assertion holds. The new `refundCalls` records every call with
  its key, replays included. The fake still does not emulate Stripe's `idempotency_error` for a
  reused PaymentIntent key with different params, so the price-edit tests assert two distinct
  keys and the second PaymentIntent's amount instead of "no error".
- **P4-01 — the "throws once" record failure is a `jest.spyOn(...).mockRejectedValueOnce`** on the
  in-memory repo, not a new fixture flag, so `InMemoryPaymentRepository` is unchanged.
- **P4-01 — two existing assertions updated.** "issues refund when slot is no longer available"
  and SINGLE-SESSION-CONFIRM-01 "records the refund + broadcasts slot_taken…" used
  `toHaveBeenCalledWith(objectContaining({ reason }))`, which fails on the new second argument;
  both now also assert `{ idempotencyKey: "refund:slot_taken:pi_single_123" }`. No existing test
  asserted an exact checkout key string.
- **P4-01 — tests.** 4 new in `PaymentService.test.ts`: the refund replay (real service, in-memory
  repos, fake Stripe), a pack price edit, a single-session price edit, and the no-edit dedup for
  both (`Date.now` frozen inside one 5-min window). All 4 fail against HEAD's `PaymentService.ts`
  (checked by swapping it in).
- **P4-01 — line refs.** The task md's line numbers predate P3-01..P3-03. The code it describes is
  at `StripeClient.ts:47`/`:93-95`, `PaymentService.ts:192`, `:226-227`, `:628-638` (pre-change).
- **P4-01 — checks.** `pnpm test` 169/169 suites, 2239 tests (4 new). `pnpm lint` 0 errors (the
  same 8 warnings). `pnpm build` green. `tsc --noEmit`: the only error is
  `src/lib/courses/__tests__/mdx.test.ts:98` (`RepoLink`), in a file this task does not touch.
- **P4-01 — NOT done:** `pnpm test:e2e` (no UI change), and a Stripe test-mode replay of a keyed
  refund (the SDK forwards `idempotencyKey` as the `Idempotency-Key` header, the same path
  `createPaymentIntent` has used since REFACTOR-P1-05).

- **P4-02 — line refs and counts drifted since the task was written.** The stale step-6 comment
  was at `BookingService.ts:323-324`, not `:237-238`. `/api/courses/progress` now traces 81
  `content/` files, not 74 (content grew): 72 of 72 under `content/courses/`. The search-index
  route's own trace also lists all 72, so its comment now says so. The `dynamicParams` paragraph
  was rewritten around what still holds, checked on `next start`: an unknown course or locale
  gets Next's HTML 404 and the handler never runs; a known pair answers 200 JSON.
- **P4-02 — `startup-checks.ts` names three CRON_SECRET routes, not two.** P3-03's
  `/api/internal/booking-payment-audit` shipped after the task was written.
- **P4-02 — documented beyond the task's convention list (what shipped, per its gotchas):** P3-03
  (all three cron routes in the cron-job.org gotcha, `BookingPaymentAuditService` in the service
  list and in the P1-01 gotcha) and P4-01 (one gotcha on Stripe idempotency keys). The Service
  Layer list also gained `AdminService` and `PaymentService`'s reconcile cron. The free-call cap
  and P1-04's expired-pack fallback are written up as "the cycle-4 default, not yet confirmed by
  Gustavo" (see Decisions). **When Gustavo decides, update those two CLAUDE.md lines.**
- **P4-02 — older CLAUDE.md drift fixed, found by the review:** the quick reference pointed admin
  pages at `src/app/admin/` (they live in `src/app/[locale]/admin/`); the schedule gotcha still
  said "60s ISR loader" (30 days since PERF-11) and now names `CommerceProviders`; the cron
  gotcha named only `session-cleanup`; the booking-shell gotcha's reason for `PersonalArea`
  reading `packSession` from `useBooking()` stopped holding with P2-04 and was reworded.
- **P4-02 — not touched:** `csrf.ts`'s exemption list doesn't name `booking-payment-audit` (a
  GET behind `CRON_SECRET`, like the two cron routes it does list). It's outside the task's file
  list and changes no behaviour, so it's left as a one-line follow-up. The archive is
  `/refactor-archive`'s job.

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
