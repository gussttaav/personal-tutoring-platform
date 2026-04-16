# Task 3.7 — Reorganize Folder Structure

**Fix ID:** `ARCH-16`
**Priority:** P2
**Est. effort:** 2 hours

## Problem

After Tasks 3.1–3.6, the new folders (`src/domain/`, `src/services/`, `src/infrastructure/`) coexist with the old layout. `src/lib/` contains a mix of things that now belong elsewhere:

- `kv.ts`, `calendar.ts` (mostly) — data-access logic that should live in `infrastructure/`
- `gemini.ts`, `email.ts`, `stripe.ts`, `zoom.ts` — external-system adapters
- `schemas.ts`, `validation.ts`, `logger.ts`, `ip-utils.ts`, `csrf.ts`, `http-errors.ts` — genuine shared utilities that stay in `lib/`

This task is the final cleanup: move files to where they conceptually belong, update imports, delete dead code. Do this **last** because it creates import churn across the whole codebase — merging this after all services exist means imports settle in one pass instead of repeatedly.

## Scope

This task touches many files. Rules:

- **Move, don't rewrite** — `git mv` or equivalent to preserve history.
- **Update imports** — use find-and-replace across the codebase for each moved module.
- **Delete only dead code** — a module becomes dead when no non-infrastructure file imports it. Verify with `grep` before deleting.
- **No behavior changes** — this is a pure relocation.

**Do not touch:**
- `src/components/`, `src/features/`, `src/hooks/` — these stay where they are
- `src/constants/` — stays
- `src/app/` — stays (routes are already in the right place)

## Target Layout

```
src/
├── app/                          # Routes (unchanged)
├── domain/                       # Types + interfaces (from Task 3.1)
│   ├── types.ts
│   ├── errors.ts
│   └── repositories/
├── services/                     # Business logic (from Tasks 3.3–3.6)
│   ├── CreditService.ts
│   ├── BookingService.ts
│   ├── PaymentService.ts
│   ├── SessionService.ts
│   ├── ChatService.ts            # NEW — extract from /api/chat route
│   └── index.ts
├── infrastructure/               # External adapters
│   ├── redis/                    # (from Task 3.2)
│   │   ├── RedisCreditsRepository.ts
│   │   ├── RedisBookingRepository.ts
│   │   ├── RedisSessionRepository.ts
│   │   ├── RedisPaymentRepository.ts
│   │   ├── RedisAuditRepository.ts
│   │   ├── slot-lock.ts          # moved from calendar.ts
│   │   ├── client.ts             # was lib/redis.ts
│   │   └── index.ts
│   ├── stripe/
│   │   ├── StripeClient.ts       # (from Task 3.5)
│   │   ├── client-singleton.ts   # was lib/stripe.ts
│   │   └── index.ts
│   ├── google/
│   │   ├── CalendarClient.ts     # core of old lib/calendar.ts
│   │   ├── auth.ts               # Google service-account setup
│   │   └── index.ts
│   ├── zoom/
│   │   ├── ZoomClient.ts         # (from Task 3.6)
│   │   ├── jwt.ts                # was lib/zoom.ts (JWT signing)
│   │   └── index.ts
│   ├── gemini/
│   │   ├── GeminiClient.ts       # wraps lib/gemini.ts
│   │   └── index.ts
│   ├── resend/
│   │   ├── EmailClient.ts
│   │   ├── templates.ts          # HTML email templates
│   │   └── index.ts
│   └── qstash/                   # (from Task 2.1)
│       ├── QStashScheduler.ts
│       ├── client.ts
│       └── index.ts
├── lib/                          # Genuine cross-cutting utilities
│   ├── schemas.ts
│   ├── validation.ts
│   ├── logger.ts
│   ├── ip-utils.ts
│   ├── csrf.ts
│   ├── admin.ts
│   ├── http-errors.ts
│   ├── api-client.ts             # browser-side API client
│   ├── stripe-client.ts          # browser-side Stripe
│   ├── booking-config.ts         # shared server+client schedule config
│   └── startup-checks.ts
├── components/                   # (unchanged)
├── features/                     # (unchanged)
├── hooks/                        # (unchanged)
├── constants/                    # (unchanged)
├── types/                        # DELETE — move contents to domain/types.ts
├── middleware/                   # (optional — for global middleware if added later)
├── auth.ts                       # (unchanged)
└── instrumentation.ts            # (unchanged)
```

## Approach

Do this in strict order to minimize broken-build time:

### Step 1 — ChatService extraction (quick cleanup)

Create `src/services/ChatService.ts` wrapping the Gemini-backed chat logic. The `/api/chat` route becomes thin:

```ts
// src/services/ChatService.ts
export class ChatService {
  constructor(private readonly gemini: IGeminiClient) {}

  async ask(params: {
    message: string;
    history: GeminiMessage[];
    systemPrompt: string;
  }): Promise<{ reply: string }> {
    const trimmed = params.history.slice(-10);
    const reply = await this.gemini.chat(params.systemPrompt, trimmed, params.message);
    return { reply };
  }
}
```

### Step 2 — Move Redis client

```
src/lib/redis.ts → src/infrastructure/redis/client.ts
```

Update the one-line content to match, then find-and-replace `@/lib/redis` with `@/infrastructure/redis/client` across the codebase.

### Step 3 — Move Stripe singleton

```
src/lib/stripe.ts → src/infrastructure/stripe/client-singleton.ts
```

The browser-side `src/lib/stripe-client.ts` stays in `lib/` (it's a client-only helper).

### Step 4 — Move Zoom + Google + Gemini + Email + QStash

Each follows the same pattern: move the adapter code to `infrastructure/{vendor}/`, leave any genuinely shared utilities in `lib/`.

For `calendar.ts`, split it:
- The Google Calendar API calls → `src/infrastructure/google/CalendarClient.ts`
- The slot generation logic (pure date math) → `src/infrastructure/google/slot-generation.ts`
- The slot-lock Redis helpers → `src/infrastructure/redis/slot-lock.ts`
- The HMAC token signing → moves into `RedisBookingRepository.ts` (it's bound to that repo's token schema)

### Step 5 — Delete `src/types/index.ts`

All exported types moved to `src/domain/types.ts` in Task 3.1. Verify nothing still imports from `@/types` and delete the directory.

### Step 6 — Delete old `kv.ts`

After all services migrate to repositories (done in 3.3–3.6), no file outside the repository implementations imports `kv.ts`. Verify with:

```bash
grep -rn "from \"@/lib/kv\"" src/ --include="*.ts" --include="*.tsx"
```

If only `src/infrastructure/redis/RedisCreditsRepository.ts` shows up (which wraps it), inline its logic into the repository and delete `lib/kv.ts`. If any non-infrastructure file still imports it, that file needs migration first — add it as a sub-task.

### Step 7 — Rebuild import map + verify

After all moves:

1. `rm -rf .next/` (clear build cache)
2. `npm run build`
3. Fix any remaining import errors
4. `npm test`
5. Full manual smoke test (book, pay, cancel, join session, chat)

## Acceptance Criteria

- [ ] Folder structure matches the target layout
- [ ] `src/types/` directory is deleted
- [ ] `src/lib/kv.ts` is deleted (logic moved to repository)
- [ ] `src/lib/calendar.ts` is deleted or contains only pure helpers
- [ ] No file imports from `@/types` anywhere
- [ ] No file outside `src/infrastructure/redis/` imports `@/lib/kv`
- [ ] `src/services/ChatService.ts` exists and is used by `/api/chat`
- [ ] `npm run build` passes with zero warnings about missing modules
- [ ] `npm test` passes
- [ ] Manual smoke test: full booking + payment + cancel + join flow works
- [ ] Git history preserved — `git log --follow` on moved files shows their history
- [ ] Fix-ID comment added to a single `docs/refactor/ARCH-16-notes.md` file summarizing the reorg

## Reference

See `docs/refactor/PLAN.md` → section **3. Suggested Folder Structure** for the authoritative target layout.

## Testing

This is a refactor with no behavior change, so the main test is "nothing broke." Specifically:

1. Every existing Jest test still passes without modification
2. `npm run build` produces zero errors
3. The app starts locally and responds to a test booking end-to-end

If a test requires updating only its import paths, that's expected and fine. If a test requires updating mocks or logic, the refactor went too far — revert and try again.

## Out of Scope

- Renaming any symbol — only move files
- Changing function signatures
- Adding new functionality
- Deleting anything that has external callers (unless migrated in this task or an earlier one)

## Rollback

High-risk task due to widespread import changes. Mitigations:

1. Merge this PR to `main` **directly** (not a feature branch that accumulates other changes), so no other in-flight work has stale imports
2. Announce in the team channel 30 min before merge so no parallel PRs are created against the old paths
3. Keep the PR open only as long as it takes to get green CI — don't let it sit

If issues arise post-merge, revert is ugly but tractable: `git revert` the merge commit, accept the import-path reversion, and re-attempt with smaller sub-PRs (e.g., one vendor at a time).
