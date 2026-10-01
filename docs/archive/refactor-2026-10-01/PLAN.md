# Refactor Cycle 4 — Correctness · Performance · Payments & Admin · Cleanup

**Audit date:** 2026-09-28
**Source:** Full-codebase audit in two passes. The first followed the risk order (payments → auth →
transactions → external APIs → services/routes). The second covered what the first under-weighted:
the course and blog features shipped since cycle 3, and a measured efficiency/architecture sweep over
the existing `.next` build (lambda traces, first-load JS, prerender cache tags).
**Previous cycles:** see [docs/archive/INDEX.md](../archive/INDEX.md). Nothing here re-proposes work completed in
`refactor-04-2026`, `refactor-2026-05-31`, `refactor-2026-07-22` or `redesign-2026-09-19`. Where a task
builds on an archived fix, it names it (see *Relation to prior cycles* below).

**Tag convention:** cycles 2 and 3 already stamped `REFACTOR-PN-NN` and `REFACTOR-R3-PN-NN` into code
comments. Per CLAUDE.md, from cycle 3 on the tag carries the cycle, so this cycle uses
**`REFACTOR-R4-PN-NN`**. One task = one PR. Every touched file gets the tag in its file-top comment block.

---

## Top issues (from audit)

| # | Sev | Issue | Task |
|---|-----|-------|------|
| 1 | 🔴 | Booking endpoints trust the client's time window; `/api/book` has no rate limit | [P1-01](phase-1-correctness/01-server-side-slot-validation.md) |
| 2 | 🟠 | Idempotency + eligibility reads swallow DB errors and answer "not processed / no data" | [P1-02](phase-1-correctness/02-idempotency-reads-fail-closed.md) |
| 3 | 🟠 | Reschedule destroys the original booking before the new one exists; retry is impossible | [P1-03](phase-1-correctness/03-reschedule-keeps-original.md) |
| 4 | 🟠 | 10 MB `googleapis` chunk in 32 of 43 API lambdas | [P2-01](phase-2-performance/01-googleapis-calendar-only.md) |
| 5 | 🟠 | Every page: 3.9 MB icon font preloaded + eager Sentry Replay (~half of static-page JS) | [P2-02](phase-2-performance/02-shell-weight-font-sentry.md) |
| 6 | 🟡 | Cancel restores the credit to the wrong pack, non-atomically, and may claim a restore that didn't happen | [P1-04](phase-1-correctness/04-atomic-cancel-restore-pack.md) |
| 7 | 🟡 | Root layout couples all ~108 static pages (lessons, posts) to Supabase pricing/schedule | [P2-03](phase-2-performance/03-commerce-providers-scope.md) |
| 8 | 🟡 | Signed-in page loads fan out: 2–3 `/api/credits` + `/api/pricing` on every page | [P2-04](phase-2-performance/04-single-user-session-state.md) |
| 9 | 🟡 | Payment ledger: reconcile false alarms on refunds + dead-letter retries record no payment | [P3-01](phase-3-payments-admin/01-payment-ledger-accuracy.md) |
| 10 | 🟡 | Admin students area: 100-user cap, wrong low-credit metric, CSRF-less POSTs, logic in routes | [P3-02](phase-3-payments-admin/02-admin-students-area.md) |
| 11 | 🟢 | Stripe idempotency: refunds keyless; checkout key ignores the amount | [P4-01](phase-4-cleanup/01-stripe-idempotency-keys.md) |
| 12 | 🟢 | CLAUDE.md drift + stale comments | [P4-02](phase-4-cleanup/02-docs-drift.md) |

## Phases

1. **[Phase 1 — Correctness](phase-1-correctness/README.md)**: booking and money paths (4 tasks)
2. **[Phase 2 — Performance](phase-2-performance/README.md)**: lambda weight, page weight, render coupling, client fan-out (4 tasks)
3. **[Phase 3 — Payments & Admin](phase-3-payments-admin/README.md)**: ledger accuracy, admin students area, booking-payment audit (3 tasks; P3-03 added 2026-09-28)
4. **[Phase 4 — Cleanup](phase-4-cleanup/README.md)**: Stripe idempotency keys, docs (2 tasks)

## Order & dependencies

- **Phase 1:** land **P1-02 → P1-01 → P1-03 → P1-04**.
  - P1-02 is small and a prerequisite for P1-03, which makes two bookings share one
    `stripe_payment_id`, and `hasBookingForPayment`'s `.maybeSingle()` must stop erroring on that.
  - P1-03 needs P1-01's slot validator, specifically its `ignoreEventId` option. _(Obsolete: P1-01
    was trimmed to in-process checks with no Calendar read — see STATUS.md → Deviations.)_
  - P1-04 rebases on P1-03, which removes the reschedule's `restoreCredit` call.
- **Phase 2** is independent of Phase 1 and can run in parallel. Inside it, **P2-03 before P2-04**:
  P2-04's pricing half relies on `UserPricingSync` having moved out of the root layout. P2-01 and
  P2-02 are independent of everything.
- **Phase 3** after Phase 1.
  - P3-01 touches `PaymentService.reprocessFailedBooking`, next to P1-01/P1-02's webhook changes.
  - P3-02's credit-adjust move uses the `CreditService` restore semantics P1-04 introduces.
  - P3-03 (added after P1-01 was trimmed) needs P1-03's `stripe_payment_id` carry-over, and shares
    `IStripeClient` with P3-01.
- **Phase 4** last. P4-01 touches `StripeClient`, which P3-01 extends. P4-02 describes the
  post-refactor state.

## Decisions needed (Gustavo), with the default each task assumes

| Task | Decision | Default in the task md |
|------|----------|------------------------|
| P1-01 | Is the free 15-min call once per student? | At most **one non-cancelled** `free15min` booking per user. Cancelling frees it again. |
| P1-04 | Cancelled pack class whose originating pack has **expired** | Restore to the originating pack if still active, else to the earliest-expiring active pack with room, else report `creditsRestored: false` truthfully and log for manual handling. |
| P2-02 | Session Replay: keep (lazy-loaded) or drop? | **Drop** if the Sentry project shows no replay you actually watched in the last 90 days; otherwise lazy-load. |
| P2-03 | Footer policy modal on pages without the commerce providers | The modal fetches its two numbers lazily from a small static, tag-revalidated route, only when it opens. |

## Working notes for whoever picks a task up

- Toolchain: `pnpm build`, `pnpm test` and `pnpm test:e2e` need **Node 22** (`nvm use 22`); the system default is Node 18.
- App-made worktrees have no `node_modules` or `.env`: run `pnpm install --frozen-lockfile` and symlink `.env` / `.env.local` from the main checkout. Serve on a free port; `:3000` belongs to Gustavo's own dev server.
- `supabase db push` targets **production**. Apply new migrations (`0023`+) to the test DB deliberately and check the link first.
- Known flakes, not your regression: `pnpm build` (`next/font/google` under Turbopack, Supabase PGRST303 "JWT issued at future"), and the e2e suite (a different single test fails per run, so re-run to confirm). P2-03 should remove the PGRST303 class for content pages.
- The audit's size figures came from the main checkout's `.next` build of 2026-09-27 23:41. Re-measure before and after each Phase 2 task on your own build, and record both numbers in the PR.

## Relation to prior cycles

| Prior work | This cycle |
|------------|-----------|
| `REFACTOR-P1-01` slot locks + `0005` exclusion constraint (cycle 2) | P1-01 adds what those never checked: working hours, calendar conflicts, duration |
| `REFACTOR-P1-03` booking saga (cycle 2) | P1-03 revisits the accepted "partial reschedule rollback". The premise "the user will get a clear error to retry" is false: the retry returns `RESCHEDULE_TOKEN_CONSUMED` |
| `REFACTOR-P1-05` PaymentIntent idempotency keys (cycle 2) | P4-01 adds the amount to the key and a key to refunds |
| `REFACTOR-R3-P1-02` webhook re-check fails closed on **Google** errors | P1-02 applies the same rule to **Postgres** reads |
| `REFACTOR-R3-P1-03` booking-exists gate | P1-02 widens its lookup from confirmed-only to any status |
| `REFACTOR-R3-P3-03` Stripe behind `IStripeClient` | P3-01 moves the reconcile route's direct `stripe` import behind it too |
| `REFACTOR-R3-P2-01` admin role re-fetch (**won't do**) | Not re-proposed. Single-admin threat model stands |
| `REFACTOR-R3-P2-02` rate limits | P1-01 adds `/api/book`, the one booking route still unlimited |
| `PERF-11` ISR window → 30 days | P2-03 removes the coupling PERF-11 worked around |

## Deferred / explicitly out of scope this cycle

- **`markProcessed` failure after a successful `createBooking`** (`PaymentService.ts:503`) writes a false
  dead-letter and broadcasts `failed` for a booking that exists. Rare, and an admin retry already heals
  it via the `REFACTOR-R3-P1-03` gate.
- **Identity is the email.** The JWT/bearer carry no `users.id`, so almost every repository call
  re-resolves email → id, and every course-progress/attempt/vote write runs `ensureUser`, an UPSERT
  that rewrites the `users` row. Worth fixing, but it touches the credential format (web cookie and
  mobile bearer) and account-deletion semantics. It needs its own design.
- **Availability-cache invalidation keys on the UTC date** (`startIso.slice(0, 10)` in
  `BookingService.ts:191,235,375`, `AccountService.ts:108`). Wrong day only for slots between 00:00
  and 02:00 Madrid time, which working hours never produce today.
- **N+1 in `SupabaseBookingRepository.listByUser`** (`getPackSize` per row, `:185`). Upcoming-booking
  lists are short.
- **Admin bookings/payments lists** are "latest 100" by design (newest first). Only the *students*
  list (P3-02) is a correctness problem.
- **A second pack purchase inside the same 5-minute idempotency window** gets the already-succeeded
  PaymentIntent back. P4-01 does not change the window.
- **Carried from earlier cycles:** `ZoomRoomSession.tsx` hook split (third deferral), XState for the
  Zoom room, `pino` logger migration, availability `tz` → 400.
