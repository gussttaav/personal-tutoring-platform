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
| [02 Idempotency + eligibility reads fail closed](phase-1-correctness/02-idempotency-reads-fail-closed.md) | `REFACTOR-R4-P1-02` | 🟠 | ⬜ | _tbd_ | |
| [01 Server-side slot validation + `/api/book` rate limit](phase-1-correctness/01-server-side-slot-validation.md) | `REFACTOR-R4-P1-01` | 🔴 | ⬜ | _tbd_ | |
| [03 Reschedule keeps the original booking until the new one commits](phase-1-correctness/03-reschedule-keeps-original.md) | `REFACTOR-R4-P1-03` | 🟠 | ⬜ | _tbd_ | |
| [04 Atomic cancel, credit back to the originating pack](phase-1-correctness/04-atomic-cancel-restore-pack.md) | `REFACTOR-R4-P1-04` | 🟡 | ⬜ | _tbd_ | |

**Exit criteria**
- [ ] `POST /api/book` with an off-hours start, a busy slot, or `endIso − startIso` ≠ the session type's length → 4xx, no calendar event, no credit spent
- [ ] Paid checkout for a mismatched duration → 4xx before any PaymentIntent exists; the webhook books `startIso + duration`, never the metadata `end_iso`
- [ ] Forced Supabase error in any idempotency read during a duplicate webhook → 500 (Stripe retries), no refund, no second booking
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

**Exit criteria**
- [ ] A slot-taken refund within the lookback window produces no reconcile mismatch; `stripe` is imported by no route handler
- [ ] Dead-letter retry of a PaymentIntent writes a `payments` row with the charged amount
- [ ] A student past #100 by email is findable in `/admin/students`; the low-credit count excludes accounts that never booked or bought
- [ ] Every admin POST/PATCH route calls `isValidOrigin`; a `−N` adjustment larger than the balance reports what was actually applied
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

## Deviations from plan

_None yet._

## Known regressions introduced

_None yet._
