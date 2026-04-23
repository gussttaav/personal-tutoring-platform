# Phase 1 — Security

**Duration:** Week 1–2
**Risk if skipped:** Data leakage, financial loss, unauthorized classroom access

## Overview

This phase addresses the security issues that are actively exploitable in production. Every task here fixes a concrete attack vector that a reasonably-motivated bad actor could use today. Do these before anything else.

## Goals

1. Eliminate the credit race condition that allows double-booking with a single credit.
2. Close the unauthenticated information-disclosure on `/api/stripe/session`.
3. Prevent unauthorized users from generating valid Zoom JWTs for sessions they don't own.
4. Block cross-site request forgery on all state-mutating POST routes.
5. Separate capabilities: the token that joins a session must not also be able to cancel it.
6. Fix the duplicated Redis client in the SSE route (not a direct vulnerability, but an architectural violation that makes later fixes harder).

## Tasks

| ID | Task | File | Est. effort |
|----|------|------|-------------|
| 1.1 | [Atomic credit decrement](./01-atomic-credits.md) | `kv.ts` | 2–3 h |
| 1.2 | [Auth gate on `/api/stripe/session`](./02-stripe-session-auth.md) | route | 30 min |
| 1.3 | [Zoom token session-membership check](./03-zoom-token-auth.md) | 3 files | 2 h |
| 1.4 | [CSRF protection middleware](./04-csrf.md) | new middleware | 1–2 h |
| 1.5 | [Split join token from cancel token](./05-split-tokens.md) | 4 files | 3–4 h |
| 1.6 | [Fix SSE duplicate Redis client](./06-sse-redis-import.md) | 1 line | 5 min |

## Suggested Order

1. **1.6 first** — trivial, removes noise from later diffs.
2. **1.2 next** — 30 min, closes a data leak.
3. **1.1** — the race condition fix; unblocks reasoning about correctness in later phases.
4. **1.3** — moderate complexity, touches three files.
5. **1.4** — cross-cutting middleware; easier after route handlers stabilize.
6. **1.5 last** — requires email template changes and has the largest blast radius.

Tasks 1.1, 1.2, 1.3, 1.4, 1.6 are independent — you can do them in separate PRs in any order after 1.6. Task 1.5 should be last because it touches email templates and the session page.

## Exit Criteria

- [ ] All six tasks have merged PRs
- [ ] `npm run build` passes without warnings
- [ ] `npm test` passes (all existing + new tests from this phase)
- [ ] Manual smoke test: full booking flow (pack purchase → book → join session → cancel) works end-to-end
- [ ] Manual security check: `curl` the unauthenticated endpoints with invalid sessions returns 401/403, not 200

## Non-goals for This Phase

- Do **not** introduce the repository pattern here. That's Phase 3.
- Do **not** touch the webhook beyond what's needed for CSRF exemption.
- Do **not** rewrite email templates. Only add/modify what's needed for token separation.
- Do **not** start the database migration. That's Phase 4.

## Rollback Plan

Each task is an independent PR. If any change causes production issues, revert that single PR. Tasks 1.1 and 1.5 have the highest rollback risk because they modify data shapes — test them in a preview environment first.
