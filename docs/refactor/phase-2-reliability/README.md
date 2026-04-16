# Phase 2 — Reliability

**Duration:** Week 3–4
**Risk if skipped:** Failed bookings go undetected, Zoom sessions never terminate, duplicate code means bugs get fixed in one place and remain in another

## Overview

Phase 1 closed the security holes. Phase 2 addresses the reliability issues: broken timers in serverless, duplicated code that doubles maintenance cost, uncapped AI spending from anonymous users, and failed bookings with no recovery path.

The theme of this phase is **making production actually work as designed**. Several features in the current codebase (the `setTimeout`-based Zoom cleanup, the dead-letter pattern) were written correctly but are missing the piece that makes them reliable.

## Goals

1. Replace `setTimeout` with a scheduler that actually fires (QStash).
2. Deduplicate the webhook handlers so bug fixes apply once, not twice.
3. Build a recovery path for dead-letter entries.
4. Cap Gemini spend from unauthenticated users with tiered rate limits.
5. Get webhooks under Stripe's 20-second budget by deferring email sends.

## Tasks

| ID | Task | File | Est. effort |
|----|------|------|-------------|
| 2.1 | [Replace `setTimeout` with QStash](./01-qstash-scheduler.md) | webhook + new route | 3–4 h |
| 2.2 | [Deduplicate webhook handlers](./02-webhook-dedup.md) | webhook | 3 h |
| 2.3 | [Dead-letter recovery endpoint](./03-dead-letter-recovery.md) | new route | 2–3 h |
| 2.4 | [Chat route auth + tiered rate limiting](./04-chat-auth.md) | chat route | 1–2 h |
| 2.5 | [Webhook async processing via `waitUntil`](./05-webhook-waituntil.md) | webhook | 1 h |

## Suggested Order

1. **2.2 first** — dedup the webhook before making other changes to it. All subsequent webhook tasks will be easier.
2. **2.5 next** — quick win, reduces webhook timeout risk before 2.1 lands.
3. **2.1** — the QStash integration; biggest reliability improvement.
4. **2.3** — dead-letter recovery; depends on QStash being in place for automated retry.
5. **2.4** — chat auth; independent of the other tasks, can be done in parallel.

## Exit Criteria

- [ ] All five tasks have merged PRs
- [ ] No `setTimeout` calls remain in any route handler or webhook
- [ ] Webhook handler has one code path for single-session processing, not two
- [ ] Admin can view and retry dead-letter entries via authenticated API
- [ ] Gemini API spend is capped at a predictable monthly maximum
- [ ] `npm test` passes with new tests from this phase
- [ ] Manual smoke test: force a calendar failure (e.g., by corrupting `GOOGLE_CALENDAR_ID` temporarily in preview) → verify dead-letter entry is created and recoverable

## Non-goals for This Phase

- Do **not** refactor route handlers into services (Phase 3).
- Do **not** introduce a database yet (Phase 4).
- Do **not** build the admin UI dashboard here. Only the admin API endpoints needed for dead-letter recovery.
- Do **not** change rate limit values for authenticated routes unless a specific task calls for it.

## New Dependencies

- **`@upstash/qstash`** — added in Task 2.1. Free tier supports 500 messages/day which is more than sufficient for current traffic.

## Environment Variables Added

- `QSTASH_TOKEN` (secret)
- `QSTASH_CURRENT_SIGNING_KEY` (secret, for incoming webhook verification)
- `QSTASH_NEXT_SIGNING_KEY` (secret, for key rotation)
- `ADMIN_EMAILS` (comma-separated list, used by Task 2.3)

Update `src/lib/startup-checks.ts` to require the new vars once they are adopted.

## Rollback Plan

Task 2.1 is the highest-risk change in this phase because it introduces a new external dependency. The QStash integration is fire-and-forget with a clear fallback: if QStash is unreachable, the Zoom cleanup fails silently and the session TTLs naturally expire within 24h (the existing JWT cannot be re-issued). The loss of automated cleanup is not critical.

Other tasks are pure refactors with no data changes — revert-safe.
