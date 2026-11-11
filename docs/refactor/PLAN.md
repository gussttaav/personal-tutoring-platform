# Refactor Cycle 5 — Correctness · Honesty & Architecture · Cleanup

**Audit date:** 2026-11-10
**Source:** a full-codebase audit, following the risk order: payments → auth → database transactions →
external APIs → services and routes. It concentrated on code shipped since cycle 4 was archived
(2026-10-01): the chat assistant's tools and voice, the classroom join window, booking attribution,
the admin users area and blog subscriptions. It also re-checked the items cycle 4 deferred.
**Previous cycles:** see [docs/archive/INDEX.md](../archive/INDEX.md). Nothing here re-proposes work completed in
`refactor-04-2026`, `refactor-2026-05-31`, `refactor-2026-07-22`, `refactor-2026-10-01`,
`redesign-2026-09-19` or `chat-assistant-2026-11-09`. Five tasks pick up items that
[cycle 4's SUMMARY](../archive/refactor-2026-10-01/SUMMARY.md#deferred-to-a-future-refactor) explicitly deferred.
They are marked *(deferred from R4)* below.

**Tag convention:** per CLAUDE.md, from cycle 3 on the tag carries the cycle. This cycle uses
**`REFACTOR-R5-PN-NN`**. One task = one PR (or one commit merged into `staging`, as in cycle 4).
Every touched file gets the tag in its file-top comment block.

**Audit verdict:** no 🔴. The money paths still fail safe, every table has RLS, every RPC since
`0017` revokes PUBLIC/anon/authenticated EXECUTE, every admin write is CSRF-checked, and all three
crons refuse an unset `CRON_SECRET`. What remains is two correctness gaps (🟠), then honesty,
architecture and debt.

---

## Top issues (from audit)

| # | Sev | Issue | Task |
|---|-----|-------|------|
| 1 | 🟠 | A reschedule token isn't bound to the signed-in user: a class can move to another account | [P1-01](phase-1-correctness/01-reschedule-token-owner.md) |
| 2 | 🟠 | `markProcessed` failing after a committed booking writes a false dead-letter *(deferred from R4)* | [P1-02](phase-1-correctness/02-mark-processed-after-commit.md) |
| 3 | 🟡 | `/api/chat` carries business logic: private-price merge, prompt assembly, the Redis kill switch | [P2-01](phase-2-honesty-architecture/01-chat-route-to-service.md) |
| 4 | 🟡 | A pack cancel with no credit restored, and a rescheduled class, are misreported in email + history *(deferred from R4)* | [P2-02](phase-2-honesty-architecture/02-cancel-reschedule-honesty.md) |
| 5 | 🟢 | The one-free-call cap is check-then-act, with no DB constraint | [P1-03](phase-1-correctness/03-free-call-unique-index.md) |
| 6 | 🟢 | Paid checkout accepts a `rescheduleToken` that no client sends | [P1-04](phase-1-correctness/04-checkout-refuses-reschedule-token.md) |
| 7 | 🟢 | The session-cleanup cron's loop lives in its route, which imports the repository directly | [P2-03](phase-2-honesty-architecture/03-session-cleanup-to-service.md) |
| 8 | 🟢 | Availability-cache invalidation keys on the UTC date, not the tutor's *(deferred from R4)* | [P3-01](phase-3-cleanup/01-availability-invalidation-tutor-date.md) |
| 9 | 🟢 | N+1 `getPackSize` in `listByUser` / `findByCancelToken` *(deferred from R4)* | [P3-02](phase-3-cleanup/02-pack-size-join.md) |
| 10 | 🟢 | A second purchase inside the 5-minute window gets the already-succeeded PaymentIntent back *(deferred from R4)* | [P3-03](phase-3-cleanup/03-checkout-replay-succeeded-intent.md) |
| — | 🟢 | CLAUDE.md drift after this cycle | [P3-04](phase-3-cleanup/04-claude-md-drift.md) |

P3-04 isn't an audit finding. It's the docs task every cycle closes with.

## Phases

1. **[Phase 1 — Correctness](phase-1-correctness/README.md)**: booking and payment paths (4 tasks)
2. **[Phase 2 — Honesty & Architecture](phase-2-honesty-architecture/README.md)**: what we tell the student, and logic back into services (3 tasks)
3. **[Phase 3 — Cleanup](phase-3-cleanup/README.md)**: deferred debt + docs (4 tasks)

## Order & dependencies

- **Phase 1:** land **P1-02 → P1-01 → P1-04 → P1-03**.
  - P1-02 is the smallest and touches only `PaymentService.processSingleSession`.
  - P1-01 and P1-04 both touch the reschedule path. Land P1-01's owner check first. P1-04 then
    removes the paid-reschedule entry point, and its tests can assume the check exists.
  - P1-03 is the only Phase 1 task with a migration (`0029`). Landing it last keeps the test-DB
    migration step to one point in the phase.
- **Phase 2** after Phase 1.
  - P2-02 changes how the reschedule claim marks the original booking (`BookingService.createBooking`)
    and the cancel RPC. It must rebase on P1-01 and P1-03, which edit the same lines. It adds
    migration `0030`.
  - P2-01 and P2-03 are independent of everything and can run in parallel with Phase 1.
- **Phase 3** last.
  - P3-01 edits the `invalidateAvailability` calls in `BookingService`, next to P2-02's changes.
  - P3-03 edits both checkout methods, after P1-04 drops the single-session `rescheduleToken`.
  - P3-04 describes the post-refactor state.

## Decisions needed (Gustavo), with the default each task assumes

| Task | Decision | Default in the task md |
|------|----------|------------------------|
| P1-01 | A signed-in user who isn't the booking's owner opens its reschedule link | **Refuse** (403 `RESCHEDULE_NOT_OWNER`), before the token is consumed. The message says to sign in with the account that booked the class, and never shows that account's email. |
| P1-03 | Production already holding two non-cancelled `free15min` rows for one user (from before the cap) | The migration **aborts** with a message naming the count. Gustavo resolves the rows by hand, using the pre-check query in the task, then re-runs it. |
| P1-04 | A checkout body carrying a non-empty `rescheduleToken` (only the mobile app could send one) | **Reject** with 400 `INVALID_REQUEST` (schema: `z.never().optional()`) rather than silently strip it. A strip would book a second class and leave the original in place. Gustavo confirms the mobile app never sends it. |
| P2-02 | Wording of the three new history labels and the new email line | ES/EN copy proposed in the task: «crédito pasado a la nueva clase», «crédito no devuelto», «pagada en la clase reprogramada». |
| P3-03 | How to tell a replayed checkout from a fresh one | Server-side: if the idempotent call returns a PaymentIntent that is no longer payable (`succeeded`, `processing`, `canceled`), create a fresh one under a suffixed key. No client change. |

## Working notes for whoever picks a task up

- **Toolchain:** `pnpm build`, `pnpm test` and `pnpm test:e2e` need **Node 22** (`nvm use 22`); the system default is Node 18.
- **Worktrees:** app-made worktrees have no `node_modules` or `.env`. Run `pnpm install --frozen-lockfile` and symlink
  `.env`, `.env.local` and `.env.test.local` from the main checkout. Serve on a free port: `:3000` belongs to Gustavo's own dev server.
- **Migrations:** `supabase db push` targets **production**. Apply `0029` and `0030` to the **test** DB deliberately
  (`--project-ref`, no re-link), then regenerate `src/infrastructure/supabase/types.ts` against it. Gustavo runs the
  production step himself.
- **E2E:** the booking specs truncate the test DB even with `E2E_BASE_URL` set. Ask before running them. Known flakes,
  not your regression: `pnpm build` (`next/font/google` under Turbopack; Supabase PGRST303 "JWT issued at future"), and
  the e2e suite (a different single test fails per run, so re-run to confirm against a warm server).
- **Email templates** can't render under Jest (`getTranslations` needs Next's config resolution). Mock the module and
  test the callers. To check the real HTML, use a scratch `tsx` script with a faked `next-intl/server` in `require.cache`.
- **Messages:** any customer-facing copy goes into **both** `messages/es.json` and `messages/en.json`, and `pnpm check:messages` must pass.

## Relation to prior cycles

| Prior work | This cycle |
|------------|------------|
| `SEC-05` (cycle 1): split join token from cancel token; cancel token = HMAC(`eventId:email:startsAt`) | P1-01 uses the email the token is already bound to. Today nothing compares it with the caller. |
| `REFACTOR-R4-P1-03`: a reschedule keeps the original until the new one commits | P1-01 adds a refusal **before** the claim, so the compensation path is untouched. P2-02 marks the claimed original as *rescheduled*, and `reinstateBooking` must clear that mark. |
| `REFACTOR-R4-P1-01`: the one-free-call cap (`hasActiveFreeSession`) | P1-03 backs the same rule with a partial unique index. The service check stays as the fast path. |
| `REFACTOR-R3-P1-03` / `REFACTOR-R4-P1-02`: the booking-exists gate heals a missing processed marker | P1-02 relies on it: `markProcessed` becomes best-effort after the commit. |
| `REFACTOR-R4-P1-04`: `cancel_booking` RPC reports `restored` | P2-02 persists that answer on the row (`credit_restored`), so history and email can tell the truth later. |
| `REFACTOR-R4-P3-01`: the reconcile cron's logic moved into `PaymentService` | P2-03 does the same for `session-cleanup`. |
| `REFACTOR-R4-P4-01`: checkout idempotency keys include amount + currency | P3-03 keeps the key and its 5-minute double-click dedup, and only adds the "no longer payable" escape. |
| `CHAT-AGENT-P1-02` (chat cycle): the route builds `ToolContext` from the server session | P2-01 keeps that rule. Identity still comes from the session, now inside the service. |

## Deferred / explicitly out of scope this cycle

- **`ZoomRoomSession.tsx` hook split** (1,541 lines). Fourth deferral: style, not correctness. Revisit only if a Zoom-room feature forces edits there.
- **Identity is the email** (no `users.id` in the JWT or bearer; `ensureUser` UPSERTs on every course write). Needs its own design.
- **`pino` logger migration**, **XState for the Zoom room**, **availability `tz` → 400**. Carried from earlier cycles.
- **Sentry browser tracing** (the lever for R4-P2-02's missed JS target). A product call, not a refactor.
- **Chat history is keyed by an unguessable server UUID, not bound to the user.** Possession is the access control, by
  design (`REFACTOR-P2-03`). Not a finding.
- **`check:bundle` red on the `gt:pyodide-loaded` literal.** Reported as a false positive since P11-02. Not in CI, and not
  re-verified by this audit.
- **Admin role-revocation latency.** Out of the threat model (single admin, no role-management UI).
