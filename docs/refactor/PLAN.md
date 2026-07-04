# Refactor Cycle 3 — Correctness · Hardening · Architecture · Docs

**Audit date:** 2026-07-04
**Source:** Full-codebase audit (risk-ordered: payments → auth → transactions → external APIs → services/routes)
**Previous cycles:** see [docs/archive/INDEX.md](../archive/INDEX.md) — nothing here re-proposes work completed in
`refactor-04-2026` or `refactor-2026-05-31` (slot locks, webhook retries, saga compensation, RLS,
DB-backed admin role, Zoom membership checks, spend caps, reconciliation cron were all verified intact).

**Tag convention:** the 2026-05-31 cycle already stamped `REFACTOR-PN-NN` into code comments, so this
cycle uses **`REFACTOR-R3-PN-NN`** to keep tags grep-unambiguous. One task = one PR.

---

## Top issues (from audit)

| # | Sev | Issue | Task |
|---|-----|-------|------|
| 1 | 🟠 | Email failures silently swallowed — retry + `emailFailed` defeated | [P1-01](phase-1-correctness/01-email-send-throws.md) |
| 2 | 🟠 | Webhook slot re-check fails open on Google API errors | [P1-02](phase-1-correctness/02-slot-recheck-fail-closed.md) |
| 3 | 🟠 | Stripe retry after `markProcessed` failure refunds a fulfilled booking | [P1-03](phase-1-correctness/03-idempotency-booking-gate.md) |
| 4 | 🟠 | Admin role revocation doesn't propagate for up to 30 days | [P2-01](phase-2-hardening/01-admin-role-hourly-refresh.md) |
| 5 | 🟠 | ~900 duplicated lines: WeeklyCalendar ↔ AvailabilityModal, already diverging | [P3-01](phase-3-architecture/01-extract-week-grid.md) |
| 6 | 🟡 | `ScheduleService.getConfig()` uncached — 2 Supabase queries per hot-path call | [P3-02](phase-3-architecture/02-schedule-config-cache.md) |
| 7 | 🟡 | `POST /api/cancel` unlimited; `zoom/token` hand-rolls IP + borrows a limiter | [P2-02](phase-2-hardening/02-rate-limit-cancel-zoom-token.md) |
| 8 | 🟡 | `payment-confirmation/channel` bypasses `IStripeClient` + no rate limit | [P3-03](phase-3-architecture/03-payment-channel-service-layer.md) |
| 9 | 🟡 | Server-side `console.*` invisible to Sentry / request-id | [P2-03](phase-2-hardening/03-server-console-to-log.md) |
| 10 | 🟢 | CLAUDE.md drift (users.locale, slot-lock location, dead route names) | [P4-01](phase-4-docs/01-claude-md-drift.md) |

## Phases

1. **[Phase 1 — Correctness](phase-1-correctness/README.md)** — payment/booking money paths (3 tasks)
2. **[Phase 2 — Hardening](phase-2-hardening/README.md)** — auth freshness, rate limits, observability (3 tasks)
3. **[Phase 3 — Architecture](phase-3-architecture/README.md)** — dedupe, caching, layering (3 tasks)
4. **[Phase 4 — Docs](phase-4-docs/README.md)** — CLAUDE.md + stale comments (1 task)

## Order & dependencies

- Phase 1 first — all three touch `PaymentService.processSingleSession`; land P1-02 → P1-03 → P1-01
  (P1-01 is the widest blast radius: every email caller).
- P2-03 (console→log) excludes `email-functions.ts`, which is converted inside P1-01 to keep one-PR-per-task.
- Phase 3 is independent of Phases 1–2; P3-01 is the largest task and can proceed in parallel.
- Phase 4 last (docs describe the post-refactor state).

## Deferred / explicitly out of scope this cycle

- `ZoomRoomSession.tsx` hook split (1,497 lines, 22 `useState`) — deferred a second time; style, not correctness.
  Revisit only if a Zoom-room feature forces edits there.
- XState for the Zoom room state machine (carried from cycle 2).
- `pino` logger migration (P4-02 Part B of cycle 2).
- Availability route: invalid `tz` query param maps to a generic 500 instead of 400 — cosmetic, noted for a rainy day.
