# Phase 4 — Observability

> **Goal:** catch silent failures earlier; correlate logs; tag releases.

## Why this phase exists

Phases 1–3 fix bugs and improve performance. Phase 4 ensures that when something **new** breaks in production, you find out quickly and can diagnose it without guessing.

The themes:

- **Reconciliation:** even with Phase 1's webhook 500-on-failure, Stripe outages or your-end outages can drop events. A daily reconciliation cron catches anything that slipped through.
- **Correlation:** today, two concurrent bookings produce interleaved log lines with no way to tell which logs belong to which request. A request ID middleware fixes that.
- **Release tagging:** Sentry sees errors but groups them across all deploys. Tagging the release lets you correlate a spike with a specific commit.

## Tasks in this phase

| # | Task | Severity | Files touched |
|---|------|----------|---------------|
| 01 | [Stripe ↔ Supabase reconciliation cron](01-stripe-reconciliation-cron.md) | 🟡 Medium | new route, `vercel.json` |
| 02 | [Request ID middleware + structured `pino` logger](02-request-id-tracing.md) | 🟢 Low | `middleware.ts` (new), `lib/logger.ts`, `lib/request-context.ts` (new) |
| 03 | [Sentry release tagging via `VERCEL_GIT_COMMIT_SHA`](03-sentry-release-tagging.md) | 🟢 Low | `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts` |

## Dependency graph

```
01 (reconciliation)  ── independent
02 (request IDs)     ── independent (touches logger; no overlap with 01/03)
03 (Sentry release)  ── independent
```

All three are parallel. None requires changes outside this phase.

## Success criteria

- [ ] All 3 task PRs merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] Reconciliation cron runs daily; visible in Vercel cron history
- [ ] An intentional drop of a webhook (kill the server, send a webhook via Stripe CLI, restart) is caught by the cron the next morning with a Sentry alert
- [ ] Every log line includes `requestId`; same ID across all logs from one request
- [ ] Sentry "Releases" page shows per-deploy error counts; the latest deploy's SHA matches `VERCEL_GIT_COMMIT_SHA`

## What NOT to do in this phase

- Don't replace Sentry. It works, you've got source maps, leave it.
- Don't build a custom dashboard for `failed_bookings` or `pending_terminations` — Supabase Studio is good enough for now. Add to the existing `/admin/failed-bookings` page if you want UI polish.
- Don't migrate logging to OpenTelemetry / Datadog. JSON-to-stdout + Sentry is sufficient at this scale.

## After this phase

You're done with the planned refactor. The system is:

- **Correct** (Phase 1): no silent payment-without-booking, no concurrent slot races, no orphan resources
- **Defended** (Phase 2): RLS policies explicit, admin via DB, AI history server-side, JWT lifetime sane
- **Fast** (Phase 3): no N+1, Realtime instead of polling, coalesced cache misses
- **Observable** (Phase 4): reconciled, traced, release-tagged

Future work (if/when needed) gets promoted from PLAN.md's "Out of scope" section.
