# Phase 4 — Polish & Database Migration

**Duration:** Week 9–12
**Risk if skipped:** No persistent data store, no test coverage for critical paths, no production observability — the app works but breaks silently when it breaks

## Overview

Phase 4 does three things:

1. **Migrates persistent data to Supabase** — credits, bookings, payments, audit logs move out of Redis (which keeps rate limits, slot locks, and ephemeral chat)
2. **Adds test coverage** — integration tests for booking + payment flows, E2E tests for critical user journeys
3. **Adds observability and operational tooling** — Sentry, admin dashboard, availability caching

The database migration is the centerpiece. Phase 3 prepared the ground by putting all data access behind repository interfaces. Phase 4 swaps Redis repositories for Supabase repositories with a dual-write safety period in between.

## Goals

1. Supabase is the primary source of truth for persistent data
2. Redis is relegated to ephemeral state: rate limiting, slot locks, in-session chat, short-lived idempotency markers
3. Test coverage ≥ 70% on the services layer
4. Production errors reach a dashboard (Sentry) with source maps
5. The tutor can recover from production issues without calling the developer

## Tasks

| ID | Task | Scope | Est. effort |
|----|------|-------|-------------|
| 4.1 | [Supabase setup + schema](./01-supabase-schema.md) | new project | 3 h |
| 4.2 | [Supabase repository implementations](./02-supabase-repos.md) | infrastructure | 6 h |
| 4.3 | [Dual-write phase](./03-dual-write.md) | services | 2 h |
| 4.4 | [Reconciliation script](./04-reconciliation.md) | scripts | 3 h |
| 4.5 | [Flip primary to Supabase](./05-flip-primary.md) | config change | 1 h |
| 4.6 | [Integration test suite](./06-integration-tests.md) | tests | 6 h |
| 4.7 | [E2E test suite (Playwright)](./07-e2e-tests.md) | tests | 8 h |
| 4.8 | [Sentry integration](./08-sentry.md) | observability | 2 h |
| 4.9 | [Admin dashboard](./09-admin-dashboard.md) | new feature | 8 h |
| 4.10 | [Availability caching](./10-availability-cache.md) | perf | 2 h |

## Suggested Order

### Migration block (strict order)

1. **4.1** — schema created first; everything else depends on it
2. **4.2** — Supabase repositories implemented
3. **4.3** — dual-write enabled; Redis still primary, Supabase shadow
4. **4.4** — reconciliation script runs daily during dual-write period (2–4 weeks minimum)
5. **4.5** — flip primary to Supabase after reconciliation shows clean state

### Independent tasks (parallel with migration block)

- **4.6, 4.7** — tests can be written while migration is in dual-write mode
- **4.8** — Sentry can be added anytime; earlier is better
- **4.9** — admin dashboard benefits from being after 4.5 (data is in Supabase, queryable)
- **4.10** — performance improvement, can be done anytime

## Exit Criteria

- [ ] All 10 tasks have merged PRs
- [ ] Supabase is primary for credits, bookings, payments, audit
- [ ] Redis still handles rate limits, slot locks, chat, idempotency
- [ ] `npm test` runs unit + integration tests, both pass
- [ ] `npm run test:e2e` runs Playwright suite against preview env, passes
- [ ] Sentry receives errors from production
- [ ] Admin dashboard deployed and accessible to `ADMIN_EMAILS`
- [ ] Documented operations runbook for common issues

## Non-goals for This Phase

- Do **not** rewrite the service layer — Phase 3 did that
- Do **not** add new features beyond what's listed
- Do **not** remove Redis entirely — it's still the right tool for ephemeral state
- Do **not** migrate to a different auth provider or payment processor

## New Dependencies

- `@supabase/supabase-js` — Supabase client
- `@sentry/nextjs` — error tracking
- `@playwright/test` — E2E testing (dev dep only)

## New Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (for future RLS-scoped access)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (for source map upload in CI)

## Rollback Strategy by Task

- **4.1–4.4** — zero production risk (dual-write is shadow, no primary change)
- **4.5** — highest risk; can flip back to Redis by reverting config
- **4.6–4.10** — independent additions, safe to revert individually

The critical revertibility point is 4.5. Do not delete Redis data after flipping to Supabase — keep it for 30 days as a safety net. If Supabase has issues, flipping back requires only a config change.
