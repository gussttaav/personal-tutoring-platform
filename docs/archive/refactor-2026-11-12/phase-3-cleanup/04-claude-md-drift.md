# P3-04 — CLAUDE.md drift

**Tag:** `REFACTOR-R5-P3-04` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Bring CLAUDE.md (and the stale comments the cycle leaves behind) in line with the code after
P1-01 … P3-03. Like `REFACTOR-R3-P4-01` and `REFACTOR-R4-P4-02`, this is a docs-only task, done last.

## Context

What each task changes that CLAUDE.md currently states or omits:

| Task | CLAUDE.md section | Drift |
|------|-------------------|-------|
| P1-01 | Gotchas → "A failed reschedule leaves the student their class" | Add: the reschedule token only works for its owner (`RESCHEDULE_NOT_OWNER`, checked before the claim) |
| P1-02 | Gotchas → "Repository reads that gate a side effect fail CLOSED" | Add: `markProcessed` after a committed booking is best-effort; the booking-exists gate is the proof |
| P1-03 | Gotchas → "The server decides what is bookable" (free-call cap paragraph) | Add: backed by the `bookings_one_free_call_per_user` partial unique index (migration `0029`) |
| P1-04 | Same paragraph / booking shell | Paid checkout refuses `rescheduleToken`; reschedules go through `/api/book` only |
| P2-01 | Gotchas → "The chat assistant runs on Claude Haiku 5.5" | The prompt/price/kill-switch assembly lives in `ChatService.reply`; the route is thin |
| P2-02 | Gotchas → "Cancelling is one transaction" | `bookings.credit_restored` / `bookings.rescheduled` (migration `0030`) and what history/email read from them |
| P2-03 | Service Layer list / Gotchas (crons) | `BookingService.sweepPendingTerminations` |
| P3-01 | — | Optional one-liner: availability cache is keyed by the tutor's date; invalidate with `invalidateForWindow` |
| P3-03 | Gotchas → "Every Stripe write carries an idempotency key" | A replayed non-payable intent gets a fresh one |
| — | `src/lib/csrf.ts` exemption comment | Lists the three crons? (R4 SUMMARY noted `booking-payment-audit` missing.) Check and fix |

## Files affected

| File | Change |
|------|--------|
| `CLAUDE.md` | The rows above, in the existing terse style; one paragraph per gotcha, tags in parentheses |
| `src/lib/csrf.ts` | Exemption comment lists `/api/internal/booking-payment-audit` if still missing (comment only) |
| Any file whose header comment a task made stale | Fix in place |

## The change

Edit, don't append: each fact goes into the paragraph that already covers that area, with the
task tag in parentheses, like the existing `(REFACTOR-R4-P1-03)` references. Don't add a "Cycle 5"
section.

## Acceptance criteria

- [ ] Every row in the Context table is reflected (or explicitly judged unnecessary in STATUS.md)
- [ ] `git grep -n "REFACTOR-R5-" -- src supabase` lists every task tag at least once
- [ ] No code change other than comments

## Test plan

- `pnpm lint` (comments only, so it should be a no-op). Read the diff once end to end.

## Notes / gotchas

- Write CLAUDE.md for the next agent: facts and where they live, not history.
- If a task deviated from its md, document what shipped (from STATUS.md → Deviations), not what was planned.

## Out of scope

- Archiving the cycle (`/refactor-archive` does that).
