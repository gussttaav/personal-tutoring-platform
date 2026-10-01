# P4-02 — CLAUDE.md drift + stale comments

**Tag:** `REFACTOR-R4-P4-02` · **Severity:** 🟢 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

CLAUDE.md is what every agent session and every `/refactor-task` run reads first, so drift in it
turns into wrong code. It's already behind on two shipped features (per-student pricing and the
0022 re-declaration of the deletion procedure). This cycle adds several conventions that must be
written down, or the next feature will reintroduce what Phases 1–3 removed. A handful of code
comments also state things that stopped being true. Do this **last**, so it describes the
post-cycle state.

## Context

**Already stale (before this cycle's changes)**
- `CLAUDE.md:95`: account deletion "(migration `0017`, re-declared in `0021` …) walks **15** tables".
  `supabase/migrations/0022_user_pricing.sql` re-declared it again with `user_pricing`, so it's **16**.
- `CLAUDE.md:90` (pricing gotcha) and `:135` (quick reference): "the `pricing` table (single source of
  truth)". Silent on `user_pricing` overrides (`0022`), `PricingService.resolve()` as the one merge
  point, `/api/pricing`'s `hasCustomPricing`, and `UserPricingSync`.
- `src/services/BookingService.ts:237-238`: "moved BEFORE **QStash** so the booking row exists if
  QStash scheduling fails; P1-04's fallback cron". QStash was removed in cycle 2.
- `src/app/api/courses/search-index/[courseSlug]/[locale]/route.ts:15-18`: claims Next "cannot
  statically trace" `content/`, so it "may simply not exist in a lambda". The build proves otherwise:
  `api/courses/progress/route.js.nft.json` traces 74 `content/` files. (`dynamicParams = false` is
  still worth keeping, for different reasons.)
- `src/lib/startup-checks.ts:66`: "Vercel cron authentication (session-cleanup cron)". It's
  cron-job.org (Hobby plan), and `CRON_SECRET` also guards `reconcile-stripe`.

**New conventions from this cycle, to document**
- P1-01: bookable-slot rules live in `BookingService.checkSlot()`, and session lengths in `SESSION_DURATION_MINUTES`; never trust a client `endIso`; the free-call cap and its decision.
- P1-03: reschedule order (claim → new booking → teardown), `reinstateBooking`, and pack reschedules moving the credit to the new booking.
- P1-04: `cancel_booking` RPC (`0023`), restore-to-originating-pack order, `creditsRestored` is reported, never asserted.
- P1-02: repository reads that gate side effects throw on `error`; `false`/`null` means *known absent*.
- P2-01: Calendar via `@googleapis/calendar`; never import `googleapis`.
- P2-02: the icon font is a subset; add an icon via `src/constants/icons.ts` + `pnpm build:icons`; `pnpm check:icons` in CI.
- P2-03: prices/schedule come from `CommerceProviders`, mounted per commerce page, **not** the root layout; a new page that books or shows prices must mount it; the footer modal's `/api/policy` fallback.
- P2-04: `useUserSession()` reads `UserSessionProvider` (one state per page).
- P3-01: reconciliation lives in `PaymentService.reconcileRecentPayments`; a slot-taken refund is proof of handling.
- P3-02: admin reads go through `AdminService` → `IAdminQueryRepository`; "student" = user with a booking or a credit pack.

## Files affected

| File | Change |
|------|--------|
| `CLAUDE.md` | Fix `:90`, `:95`, `:135`; add gotchas for the conventions above; quick-reference rows ("Add an icon", "Admin read/query", "Is this slot bookable?"); `pnpm check:icons` / `build:icons` under Commands |
| `src/services/BookingService.ts` | Rewrite the `:237-238` comment (pending_terminations + session-cleanup cron) |
| `src/app/api/courses/search-index/[courseSlug]/[locale]/route.ts` | Correct the tracing paragraph; keep the `dynamicParams` rationale that still holds |
| `src/lib/startup-checks.ts` | `:66` comment → "cron-job.org authentication (session-cleanup + reconcile-stripe)" |
| `docs/refactor/STATUS.md` | Tick the Phase 4 exit criteria |

## The change

Text edits only. For the pricing gotcha, the target wording:

> Prices are NOT in Stripe. The four public prices live in the Supabase `pricing` table; a student may
> have **private overrides** in `user_pricing` (migration `0022`, sparse: a row only for an overridden
> product, edited on `/admin/students/<email>`). `PricingService.resolve(userId)` is the ONE merge
> point: the charge (`getAmount`) and the display (`getPublicPricing`, `GET /api/pricing` →
> `hasCustomPricing`) both read through it. The static pages show public prices, and `UserPricingSync`
> (inside `CommerceProviders`) overlays a signed-in student's own. …

For the deletion gotcha: "(migration `0017`, re-declared in `0021` and `0022`), which walks 16 tables".

Keep each new gotcha to the shape of the existing ones: a rule, a file reference, and the reason. No
tutorials.

## Acceptance criteria

- [x] Every claim in the "Already stale" list is corrected
- [x] Each "New conventions" item has a CLAUDE.md line naming the rule and the file
- [x] `grep -rn "QStash" src` → only historical tag comments (e.g. `REFACTOR-P1-04` notes), no present-tense claims
- [x] `pnpm build` green (comment-only code changes)
- [x] File-top comment blocks of touched code files carry `REFACTOR-R4-P4-02`

## Test plan

- **Existing:** `pnpm test`, `pnpm build`.
- **Review:** read CLAUDE.md top to bottom against the merged Phase 1–3 PRs. Every file path it names exists (`ls` each one).

## Notes / gotchas

- Land after every other task in the cycle, since several conventions only exist once their task merges.
  If a task was dropped or deviated, document what shipped (see STATUS.md → Deviations), not what was planned.
- Don't archive here. That's `/refactor-archive`, after this task.

## Out of scope

- Rewriting the archive docs.
- `docs/courses/**` and `docs/seo/**`.
