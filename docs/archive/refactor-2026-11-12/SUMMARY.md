# Refactor Summary — Cycle 5: Correctness · Honesty & Architecture · Cleanup

**Date range:** 2026-11-10 (audit + plan, committed as `b74706d` on 2026-11-11) → 2026-11-12 (archive)
**Tasks completed:** 11 of 11, as planned. Nothing was trimmed, added or dropped.
**Tag convention:** `REFACTOR-R5-PN-NN`
**Verification:** `pnpm test` and `pnpm lint` ran green per task (last run: 3325 tests after
P3-03). At archive time, on `e201b97`, the archiving pass ran `pnpm build` (green) and the full
e2e suite: 52/60 on a cold dev server, every failure a known cold-compile timeout. The four
affected spec files then passed on a warm cache (19 passed, 1 expected skip). Details are in
`STATUS.md` → *Archive reconciliation*. `STATUS.md` is the record of outcomes. The task files'
own acceptance checklists were left as they were planned.

---

## Tasks completed

There were no GitHub PRs this cycle. Each task is one commit made straight on `staging`, at
Gustavo's choice. At archive time none of them is pushed or on `main`.

### Phase 1 — Correctness
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | A reschedule token only works for its owner | `REFACTOR-R5-P1-01` | `c666a52` |
| 02 | `markProcessed` after the commit is best-effort | `REFACTOR-R5-P1-02` | `50be786` |
| 03 | One free call per user, enforced by the database (migration `0029`) | `REFACTOR-R5-P1-03` | `dc38a4c` |
| 04 | Checkout refuses a reschedule token | `REFACTOR-R5-P1-04` | `b942b3e` |

### Phase 2 — Honesty & Architecture
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | `/api/chat` becomes a thin route | `REFACTOR-R5-P2-01` | `30467ef` |
| 02 | Cancel and reschedule tell the truth about credits and payments (migration `0030`) | `REFACTOR-R5-P2-02` | `640d510` (+ `822cb4d`, prod note) |
| 03 | Session-cleanup sweep moves into `BookingService` | `REFACTOR-R5-P2-03` | `b98b88e` |

### Phase 3 — Cleanup
| # | Task | Tag | Commit |
|---|------|-----|--------|
| 01 | Availability invalidation on the tutor's date | `REFACTOR-R5-P3-01` | `0d48e10` |
| 02 | Pack size by join, not per row | `REFACTOR-R5-P3-02` | `625fc1a` |
| 03 | Checkout never hands back a paid PaymentIntent | `REFACTOR-R5-P3-03` | `fae23f9` |
| 04 | CLAUDE.md drift | `REFACTOR-R5-P3-04` | `e201b97` |

---

## Key wins

- **A class can't be moved to someone else's account, and the free call can't be booked twice.**
  The reschedule token is now checked against the caller before anything is consumed (403
  `RESCHEDULE_NOT_OWNER`). Two concurrent free-call requests now meet a partial unique index, so
  exactly one succeeds. Paid checkout no longer accepts a reschedule token at all, which leaves
  `/api/book` as the only reschedule path.

- **The money paths stopped misreporting.** A `markProcessed` failure after a committed booking
  no longer writes a false dead-letter. The cancellation email and the booking history now read
  what actually happened (`credit_restored`, `rescheduled`): «crédito no devuelto», «crédito
  pasado a la nueva clase», and a rescheduled paid class's price shows once. A second purchase
  inside the 5-minute idempotency window gets its own PaymentIntent instead of the one already
  paid.

- **Routes are thin again, and cycle 4's refactor debt is paid down.** `/api/chat` and the
  session-cleanup cron now hand their logic to `ChatService.reply()` and
  `BookingService.sweepPendingTerminations`. A signed-in chat turn does one price read instead of
  two. The availability cache is invalidated on the tutor's local date, and `listByUser` dropped
  from N + 2 queries to 2. Seven items from cycle 4's deferred list landed here; what's left of
  it is design or product work (see below).

---

## Notable deviations

Full detail in `STATUS.md` under *Deviations from plan*. The ones worth carrying forward:

- **P3-03 loops instead of hopping once.** The planned single retry under `<key>:after:<id>`
  would have handed a third purchase in the window the second, already-paid intent. It now
  re-suffixes until an intent is payable, capped at 10 hops.
- **P2-01 reads prices on every signed-in turn,** including students with no override (one
  `resolve()`), so that `resolve()` stays the one merge point. The kill-switch check now runs
  after the body parse: an over-cap request with a malformed body answers 400, where it used to
  answer 503.
- **P1-03 hit its abort in production.** Gustavo's own account held four pre-cap free calls. At
  his choice they were cancelled, and then `0029` applied.
- **P2-03:** a `recordPendingTerminationFailure` throw now answers the route's own 500, where it
  used to be Next's uncaught 500.

**Known regressions introduced:** none.

---

## Deferred to a future refactor

From this cycle:

- **Mobile app publish (P2-02 follow-up).** It's committed on the app's `staging` (`eb2b70e`)
  and waits for Gustavo's `update:*`, after this cycle's server code reaches production. It isn't
  a break: until then the app shows the old labels.
- **`SupabaseBookingRepository.findByCancelToken` answers `null` on a read error.** This was out
  of scope for P3-02. It reads as "invalid link", not as a destructive side effect, but it doesn't
  follow the fail-closed contract.
- **Verification not done:** the optional Stripe test-mode replay of a succeeded intent (P3-03),
  the manual chat check with a private price (P2-01), the manual `curl` of the session-cleanup
  cron (P2-03).
- **Stale comment:** `src/services/BookingService.ts:11` still points at
  `docs/refactor/phase-1-correctness/03-booking-saga-compensation.md`, a cycle-1 path.
  Applied migration `0029`'s abort message also names `docs/refactor/…`. That one stays as is,
  since applied migrations are never edited.

Carried from `PLAN.md` → *Deferred / explicitly out of scope this cycle*:

- Identity is the email: no `users.id` in the JWT/bearer, and `ensureUser` UPSERTs on every
  course write. This needs its own design.
- Sentry browser tracing (the lever for R4-P2-02's missed JS target). A product call.
- `ZoomRoomSession.tsx` hook split (fourth deferral), XState for the Zoom room, the `pino` logger
  migration, availability `tz` → 400.
- `check:bundle` red on the `gt:pyodide-loaded` literal (a false positive, not in CI).
- `admin_list_students` (`0024`) is unused and can be dropped in a later migration (since
  `ADMIN-USERS-01`).

---

## Commits by tag

All code changes carry their `REFACTOR-R5-PN-NN` tag in a file-top comment block. To trace a
task, run `git log --grep='REFACTOR-R5-P1-03'` or `git grep 'REFACTOR-R5-P1-03' -- src supabase`.
The commit for each tag is in the tables above.
