# Task 4.5 — Flip Primary to Supabase

**Fix ID:** `DB-05`
**Priority:** P3
**Est. effort:** 1 hour (of code), 1 week of monitoring

## Problem

After dual-write has run cleanly for 2–4 weeks and reconciliation shows zero drift for at least 7 consecutive days, Supabase is ready to become primary. This is a **config-only change** — no new code — but it's the highest-stakes moment of the migration.

After the flip: reads come from Supabase, writes go to Supabase first (primary) and Redis second (shadow). A bug in Supabase reads becomes a user-facing issue.

## Scope

**Modify:**
- `src/services/index.ts` — swap primary and shadow arguments in dual-write constructors

**Do not touch:**
- Repository implementations
- Service logic
- Route handlers

## Prerequisites — DO NOT SKIP

Before merging this PR, verify **all** of:

- [ ] Dual-write has been enabled in production for ≥ 14 days
- [ ] Daily reconciliation has exited 0 for ≥ 7 consecutive days
- [ ] No manual Supabase edits in the last 7 days
- [ ] Sentry (Task 4.8) is live and receiving errors
- [ ] You have tested the flip in a Preview environment with a full end-to-end flow
- [ ] You have a deploy slot: low-traffic time, developer on-call for 4h post-deploy
- [ ] The tutor is aware of the deploy time

## Approach

### Step 1 — The code change

```ts
// src/services/index.ts — BEFORE
const creditsRepo = DUAL_WRITE_ENABLED
  ? new DualCreditsRepository(redisCreditsRepo, supabaseCreditsRepository)
  //                          ^^^^^^^^^^^^^^^^^ primary (Redis)
  //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^ shadow (Supabase)
  : redisCreditsRepo;

// AFTER
const creditsRepo = DUAL_WRITE_ENABLED
  ? new DualCreditsRepository(supabaseCreditsRepository, redisCreditsRepo)
  //                          ^^^^^^^^^^^^^^^^^^^^^^^^^  primary (Supabase)
  //                                                     ^^^^^^^^^^^^^^^^^ shadow (Redis)
  : redisCreditsRepo;
```

Same two-word swap for all five repositories. That's the entire code change.

### Step 2 — Gradual rollout (optional but recommended)

Flip one repository at a time, in this order (lowest to highest blast radius):

1. **Audit** — most forgiving (log writes, not user-visible)
2. **Sessions** — short TTL; any issues resolve within 24h naturally
3. **Payments** — already dual-written via Stripe idempotency
4. **Credits** — user-visible, but addCredits is idempotent
5. **Bookings** — user-visible + has cascading effects (cancel, join)

Between each flip, wait 24–48h and verify no errors in Sentry.

### Step 3 — Monitoring during and after flip

Watch these for the first 72h:

- Sentry error rate for services that now read from Supabase
- Supabase dashboard: query performance, connection count, error rate
- Vercel function duration: Supabase latency is typically higher than Upstash Redis (5–20ms vs 1–5ms) — verify this does not push any endpoint over its timeout
- `/api/credits` response times — this is called frequently, any regression is immediately user-visible

### Step 4 — Keep Redis for 30 days

Do not delete Redis data. The dual-write is still active (Redis is now shadow). If Supabase has a critical issue, flipping back requires only reverting this PR.

After 30 days of stable Supabase-primary operation, a follow-up PR can:

1. Disable dual-write for persistent entities (remove the wrappers, use Supabase repos directly)
2. Schedule Redis data deletion

That follow-up is **not part of this task** — it waits until confidence is high.

## Acceptance Criteria

- [ ] All prerequisites above are met
- [ ] `src/services/index.ts` swaps primary/shadow arguments
- [ ] PR description documents the monitoring plan for the 72h post-deploy
- [ ] Preview test: full flow works identically to production
- [ ] Gradual rollout order followed (one repo at a time, if choosing gradual)
- [ ] Post-deploy: 72h of clean Sentry signal before proceeding to next task
- [ ] Redis data preserved; no deletion scripts run

## Reference

See `docs/refactor/PLAN.md` → section **5. Migration Plan → Step 3: Swap Primary**.

## Testing

Pre-deploy:

1. Flip in Preview environment
2. Full end-to-end manual test:
   - Sign in, purchase pack via Stripe test mode
   - Verify `/api/credits` returns credits from Supabase (check Supabase logs)
   - Book a pack session
   - Verify booking appears in `/area-personal`
   - Cancel the booking
   - Verify credit restored
3. Run reconciliation one more time → exit 0

Post-deploy:

1. Monitor Sentry in real time for 4h
2. Perform a manual test with a real (small) payment in production
3. Verify behavior matches pre-deploy

## Out of Scope

- Deleting Redis data (wait 30 days after flip)
- Removing the dual-write wrappers (follow-up PR)
- Any new features

## Rollback

This is the whole point of the dual-write architecture: rollback is a config revert.

**If a serious issue is detected within 24h:**

1. `git revert <this-commit>`
2. Deploy
3. Reads go back to Redis; writes go back to "Redis primary, Supabase shadow"
4. Investigate the Supabase issue without user-facing pressure

**If an issue is detected after 24h but before 30 days:**

1. Same revert
2. Run reconciliation to see if new Supabase-only writes are in Redis
3. If not, backfill Redis with missing data before declaring rollback complete

**If an issue is detected after 30 days:**

1. Redis may have stale data (dual-write stopped)
2. Rollback requires a restore from Supabase → Redis first
3. Much harder — which is why the 30-day retention exists
