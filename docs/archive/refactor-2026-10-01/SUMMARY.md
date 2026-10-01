# Refactor Summary — Cycle 4: Correctness · Performance · Payments & Admin · Cleanup

**Date range:** 2026-09-28 (audit + plan, `1f6f8de`) → 2026-10-01 (archive)
**Tasks completed:** 13 of 13: the 12 in the original plan, plus P3-03, added on 2026-09-28 as
the follow-up to P1-01's trim. One task shipped trimmed (P1-01) and one missed its numeric
target (P2-02). Four out-of-plan fixes also landed (see below).
**Tag convention:** `REFACTOR-R4-PN-NN`
**Verification:** `pnpm test`, `pnpm lint` and `pnpm build` were run green per task (final run on
the P4-02 branch: 169/169 suites, 2239 tests, 192/192 static pages). The three exit-criteria boxes
still open at archive time were closed on Gustavo's word, not re-run by the archiving pass: the full
e2e suite run by hand (50/50), the P2-02 JS target accepted as missed, and the production steps.
See *Archive reconciliation* in `STATUS.md`. `STATUS.md` is the record of outcomes. The task
files' own acceptance checklists were left as they were planned.

---

## Tasks completed

There were no GitHub PRs this cycle. Each task is one commit, developed on a `claude/*` worktree
branch and merged into `staging` with the `refactorization` branch (`7156dfd`). None is on `main`
at archive time.

### Phase 1 — Correctness
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | Server-side slot validation + `/api/book` rate limit (**trimmed**: no per-request Calendar read) | `REFACTOR-R4-P1-01` | `a6e6356` |
| 02 | Idempotency + eligibility reads fail closed | `REFACTOR-R4-P1-02` | `753d4d1` |
| 03 | Reschedule keeps the original booking until the new one commits | `REFACTOR-R4-P1-03` | `f56164c` |
| 04 | Atomic cancel, credit back to the originating pack (migration `0023`) | `REFACTOR-R4-P1-04` | `b9917ac` |

### Phase 2 — Performance
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | `@googleapis/calendar` instead of `googleapis` | `REFACTOR-R4-P2-01` | `11d76e2` |
| 02 | Shell weight: icon-font subset + Sentry Replay (**JS target missed, accepted**) | `REFACTOR-R4-P2-02` | `012c38d` |
| 03 | Commerce providers out of the root layout | `REFACTOR-R4-P2-03` | `56e3663` |
| 04 | One user-session state for the whole page | `REFACTOR-R4-P2-04` | `844eff3` |

### Phase 3 — Payments & Admin
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | Payment ledger accuracy | `REFACTOR-R4-P3-01` | `5d2e0fd` |
| 02 | Admin students area (migration `0024`) | `REFACTOR-R4-P3-02` | `e1c0e02` |
| 03 | Daily audit: upcoming classes > 15 min are paid | `REFACTOR-R4-P3-03` | `25c803c` |

### Phase 4 — Cleanup
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | Stripe idempotency keys | `REFACTOR-R4-P4-01` | `c955635` |
| 02 | CLAUDE.md drift + stale comments | `REFACTOR-R4-P4-02` | `51db1ce` |

### Out of plan
| Fix | Tag | Commit |
|-----|-----|--------|
| A failed dead-letter retry keeps its entry instead of reporting success (found during P3-01) | `DEAD-LETTER-RETRY-01` | `0005628` |
| The dead-letter retry button says when the student was refunded | `DEAD-LETTER-RETRY-02` | `5b93a30` |
| Cancel's post-commit locale read is best-effort (P1-04 follow-up) | `REFACTOR-R4-P1-05` | `4f9103d` |
| `reconcile-stripe` + `session-cleanup` refuse an unset `CRON_SECRET` (P3-03 follow-up) | `CRON-AUTH-01` | `c9c0ea9` |

---

## Key wins

- **A class can no longer outgrow its payment, and the money paths fail safe.** The server checks
  every booking's length, grid, notice, window and working hours in-process before any side effect
  (`BookingService.checkSlot`), and the webhook books `start + paid duration`. Reads that gate a
  refund or an account deletion now throw on a Supabase error instead of reading as "absent".
  A failed reschedule leaves the student their original class, and cancelling is a single
  transaction that returns a pack credit to the pack it came from.

- **Every API lambda shed ~9 MB and the first paint got ~4× faster.** Swapping `googleapis` for
  `@googleapis/calendar` took the full API catalog out of 37 of 41 route traces (largest chunk
  traced by `/api/courses/progress`: 10,126 KB → 1,313 KB). Subsetting the icon font to the 107
  glyphs in use (3,943,736 → 14,840 bytes) cut Lighthouse mobile LCP on `/` from 25.3 s to 6.7 s.
  Moving the commerce providers out of the root layout took the pricing/schedule ISR tags off
  116 of 124 pages, including every blog post and lesson, and a page now makes one
  `/api/credits` request instead of one per consumer.

- **Payments are audited after booking too, and the admin area scales past 100 users.** A daily
  read-only cron (`BookingPaymentAuditService`) flags any upcoming class whose payment was
  refunded, disputed or doesn't match. The reconcile cron no longer reports slot-taken refunds as
  mismatches. Every Stripe write is idempotency-keyed. `/admin/students` searches and paginates
  in Postgres over real students only, and admin POSTs are CSRF-checked.

---

## Notable deviations

Full detail in `STATUS.md` under *Deviations from plan*. The ones worth carrying forward:

- **P1-01 was trimmed at Gustavo's request:** there is no Google Calendar read on `/api/book` or
  at checkout. It measured 470–880 ms per call. Free-call and pack bookings made through the API
  are not checked against the tutor's manual calendar events. The paid webhook keeps its freebusy
  re-check, and P3-03's daily audit is the safety net for "every class > 15 min is paid".
- **P2-02 missed its ≥ 60 KB JS target (−38.5 KB) and Gustavo accepted it.** Replay was smaller
  than the audit assumed. What remains in Sentry's 129.7 KB chunk is the core SDK plus browser
  tracing.
- **P2-03 also wrapped `/sesion/[token]`,** a commerce consumer the task missed. Without it, the
  pre-join pack booking would have thrown.
- **P3-03 got its own service rather than going into `PaymentService`.** A run whose findings are
  all review items logs `warn`, not `error`.
- **Policies:** the one-free-call cap and the expired-pack credit fallback shipped as defaults and
  were confirmed by Gustavo on 2026-10-01.

**Known regressions introduced:** a rescheduled paid class shows its price twice in booking
history, because both rows share the PaymentIntent. This was accepted in P1-03's gotchas. (P1-02's
cancel-500 regression was closed by P1-04.)

---

## Deferred to a future refactor

From this cycle:

- **Sentry browser tracing** (`__SENTRY_TRACING__: false`, or drop `browserTracingIntegration`):
  the remaining lever for P2-02's JS target. It's a product call, because it costs the browser
  performance data in Sentry.
- **A pack class whose credit could not be restored** still gets the cancel email's `refundMsg`
  ("if you paid for this session individually…"), and `history-stats.ts` still reads every
  cancelled pack class as "crédito devuelto" (P1-04's second follow-up).
- **Deduplicate the price of a rescheduled paid class** in booking history (the known regression
  above).
- **`csrf.ts`'s exemption comment** doesn't list `/api/internal/booking-payment-audit`. It's
  documentation only, since it's a GET.
- **Verification steps that weren't recorded as done:** client errors reaching Sentry after
  P2-02 (needs a preview deploy); the Vercel cold-start comparison for P2-01; the manual
  reconcile-cron call and the optional `payments` backfill for retries recovered before P3-01; a
  keyed refund replay in Stripe test mode (P4-01); a live admin price edit invalidating
  `/mentoria` but not lessons (P2-03, checked structurally); the partial-debit notice in the
  browser (P3-02, checked by curl).

Carried from `PLAN.md` → *Deferred / explicitly out of scope this cycle*:

- `markProcessed` failing after a successful `createBooking` writes a false dead-letter.
- Identity is the email: no `users.id` in the JWT/bearer, and `ensureUser` UPSERTs on every
  course write. This needs its own design.
- Availability-cache invalidation keys on the UTC date (wrong only for 00:00–02:00 Madrid slots).
- N+1 `getPackSize` in `SupabaseBookingRepository.listByUser`.
- A second pack purchase inside the same 5-minute idempotency window gets the earlier
  PaymentIntent back.
- From earlier cycles: the `ZoomRoomSession.tsx` hook split (third deferral), XState for the Zoom
  room, the `pino` logger migration, and availability `tz` → 400.

---

## Commits by tag

All code changes carry their `REFACTOR-R4-PN-NN` tag in a file-top comment block. To trace a
task: `git log --grep='REFACTOR-R4-P1-03'`, or `git grep 'REFACTOR-R4-P1-03' -- src supabase`.
The commit for each tag is in the tables above.
