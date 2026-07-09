# P4-01 — Fix CLAUDE.md drift and stale code comments

**Tag:** `REFACTOR-R3-P4-01` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Three documented "facts" are now false. CLAUDE.md is the contract both contributors and
coding agents rely on, so each drift is a future bug: (1) it says there is no `users.locale`
column — migration `0010_user_locale.sql` added one and emails depend on it; (2) it says slot
locks live in Redis (`slot:lock:*`) — they moved to Postgres; (3) `csrf.ts`'s exemption
comment names internal routes that no longer exist.

## Context

- `CLAUDE.md` — i18n section: "locale persisted in the `NEXT_LOCALE` cookie (no `users.locale` column)". Reality: `supabase/migrations/0010_user_locale.sql`; `UserService.getLocale/seedLocaleOnLogin`; `BookingService.ts:276` reads it for email locale ("account source of truth"); `MobileAuthService` surfaces it.
- `CLAUDE.md` — Data Storage: "Redis … slot locks (`slot:lock:*`)". Reality: Postgres `slot_locks` table + `acquire_slot_lock` RPC (`src/infrastructure/supabase/SupabaseBookingRepository.ts:333-351`); `grep -rn "slot:lock" src` (excl. tests) → no hits.
- `src/lib/csrf.ts:17-18` — exemption comment lists `/api/internal/zoom-terminate` (QStash signature) and `/api/internal/zoom-terminate-fallback`. Reality: QStash was removed (cycle-2 P1-04 deviation); live internal routes are `/api/internal/session-cleanup` and `/api/internal/reconcile-stripe`, both `CRON_SECRET`.

## Files affected

| File | Change |
|------|--------|
| `CLAUDE.md` | i18n section: locale cookie is the *render-path* source; `users.locale` is the account/email source (seeded at login, reconciled by `seedLocaleOnLogin`). Data Storage: remove `slot:lock:*` from the Redis list; note slot locks are Postgres (`slot_locks` + `acquire_slot_lock` RPC). Optionally add the `REFACTOR-R3-*` tag convention to the refactor-workflow section. |
| `src/lib/csrf.ts` | Exemption comment: replace dead route names with `/api/internal/session-cleanup` + `/api/internal/reconcile-stripe` (CRON_SECRET) |

## The change

Docs/comments only — no behavior. Suggested CLAUDE.md wording:

> - Locale: `NEXT_LOCALE` cookie drives rendering; **`users.locale`** (migration 0010) is the
>   account-level source of truth used by background flows (emails from webhooks). They are
>   reconciled at login (`seedLocaleOnLogin`).

> - **Redis (Upstash)** is used ONLY for ephemeral state: rate limiting (`rl:*`),
>   in-session chat (`chat:session:*`), availability + schedule-config cache (`avail:*`, `schedule:config:*`).
>   Slot locking is a **Postgres** concern: `slot_locks` table via the `acquire_slot_lock` RPC.

(Include `schedule:config:*` only if P3-02 has landed; otherwise omit.)

## Acceptance criteria

- [ ] Every claim in CLAUDE.md's Data Storage + Gotchas sections spot-checked against code (grep, not memory)
- [ ] No remaining reference to `slot:lock:*`, "no `users.locale` column", or `zoom-terminate*` routes anywhere in CLAUDE.md / `src/lib/csrf.ts`
- [ ] ZoomRoomSession split deferral stays recorded in PLAN.md only — no CLAUDE.md TODO added
- [ ] `pnpm lint` green (comment-only change in `csrf.ts` shouldn't trip anything, but verify)

## Test plan

Docs-only: `pnpm build` + `pnpm lint` as smoke. No runtime surface.

## Notes / gotchas

- Do this task **last** — P2-02/P3-01/P3-02 change facts CLAUDE.md should state (new limiters, week-grid module location, config cache key).
- While editing, resist "improving" unrelated CLAUDE.md sections — one task, one PR, reviewable diff.
- The user-level memory file (`project_supabase_timestamp_format.md` etc.) is separate tooling — out of scope.

## Out of scope

- Any code behavior change.
- Rewriting the refactor-workflow section beyond adding the R3 tag note.
- `docs/archive/` content (immutable history).
