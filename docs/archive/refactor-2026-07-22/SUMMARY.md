# Refactor Summary — Cycle 3: Correctness · Hardening · Architecture · Docs

**Date range:** 2026-07-04 (audit + plan) → 2026-07-22 (archive)
**Tasks completed:** 9 shipped / 10 planned — 1 explicitly **won't do** (`REFACTOR-R3-P2-01`)
**Tag convention:** `REFACTOR-R3-PN-NN` (cycle-carrying, to stay grep-unambiguous against cycle 2's `REFACTOR-PN-NN`)
**Verification:** all phase exit criteria checked. `pnpm test` + `pnpm build` were run green after
every task; the three boxes still open in `STATUS.md` at archive time were ticked retroactively on
Gustavo's confirmation, not re-run by the archiving pass (see the reconciliation note in `STATUS.md`).

---

## Tasks completed

### Phase 1 — Correctness (money paths)
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Email `send()` throws on failure — retry + `emailFailed` no longer defeated | `REFACTOR-R3-P1-01` | [#51](https://github.com/gussttaav/personal-web-booking-app/pull/51) |
| 02 | Webhook slot re-check fails **closed** on Google API errors | `REFACTOR-R3-P1-02` | [#52](https://github.com/gussttaav/personal-web-booking-app/pull/52) |
| 03 | Booking-exists idempotency gate before refund | `REFACTOR-R3-P1-03` | [#54](https://github.com/gussttaav/personal-web-booking-app/pull/54) |

### Phase 2 — Hardening
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Admin role hourly re-fetch | `REFACTOR-R3-P2-01` | 🚫 **won't do** — see below |
| 02 | Rate limits: `/api/cancel` + `zoom/token` | `REFACTOR-R3-P2-02` | [#60](https://github.com/gussttaav/personal-web-booking-app/pull/60) |
| 03 | Server-side `console.*` → `log()` | `REFACTOR-R3-P2-03` | [#62](https://github.com/gussttaav/personal-web-booking-app/pull/62) |

### Phase 3 — Architecture
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Extract shared week-grid module | `REFACTOR-R3-P3-01` | [#64](https://github.com/gussttaav/personal-web-booking-app/pull/64) |
| 02 | Cache `ScheduleService.getConfig()` | `REFACTOR-R3-P3-02` | [#65](https://github.com/gussttaav/personal-web-booking-app/pull/65) |
| 03 | `payment-confirmation/channel` via the service layer | `REFACTOR-R3-P3-03` | [#67](https://github.com/gussttaav/personal-web-booking-app/pull/67) |

### Phase 4 — Docs
| # | Task | Tag | PR |
|---|------|-----|----|
| 01 | Fix CLAUDE.md drift + stale comments | `REFACTOR-R3-P4-01` | none — landed directly on `staging` (`81cfa32`) |

---

## Key wins

- **Three silent-failure paths in the payment/booking flow now fail loudly and correctly.** Email
  sends throw instead of swallowing Resend 4xx/5xx (so `emailFailed` actually reaches the booking
  caller), the webhook's slot re-check fails closed when Google errors — returning 500 so Stripe
  retries, rather than booking or refunding on incomplete information — and a booking-exists gate
  stops a Stripe redelivery after a failed `markProcessed` from refunding an already-fulfilled
  booking. All three sat on `PaymentService.processSingleSession`, so they landed in dependency
  order P1-02 → P1-03 → P1-01.

- **~900 duplicated, already-diverging lines collapsed into one week-grid module.** `WeeklyCalendar`
  (−313 lines) and `AvailabilityModal` (−259) now share `src/components/week-grid/` plus a
  `useWeekAvailability` hook, with a `resetKey` prop preserving each surface's distinct cache-reset
  semantics. The two calendars can no longer drift apart silently.

- **The hot availability path stopped hammering Postgres, and Stripe stopped leaking out of its
  layer.** `ScheduleService.getConfig()` is now version-keyed cached (≤1 round-trip on a hit, admin
  edits still take effect immediately via a version bump), and `payment-confirmation/channel` no
  longer constructs its own Stripe client — `new Stripe(` exists exactly once, in
  `src/infrastructure/stripe/client-singleton.ts`. The route is now a thin dispatcher over
  `PaymentService.getConfirmationChannelState()` and gained a 30/min per-email limiter.

- **Observability and docs caught up with reality.** Server-side `console.*` is gone (every event
  now reaches Sentry with a `service` tag and request id), `/api/cancel` and `zoom/token` are rate
  limited on the shared `rl:*` namespace, and CLAUDE.md no longer claims things that stopped being
  true (`users.locale`, Postgres-not-Redis slot locks, current internal route names).

---

## Notable deviations

Full detail in `STATUS.md` → **Deviations from plan**. The ones worth carrying forward:

- **P2-01 — reverted after implementation, by decision.** The audit's 🟠 assumed a multi-admin org
  where a hostile admin must be revoked fast. This app has exactly one admin (Gustavo) and no
  role-management feature, so the hourly re-fetch would have cost a role query per hour for every
  *student* and protected nobody. The existing revocation lever is rotating `AUTH_SECRET`.
  **Revisit only if the app gains multiple admins or in-app role management.**
- **P3-02 — the config-cache port gained `bumpVersion()`,** called by `updateConfig`, so non-HTTP
  callers see fresh config. The admin route's own `bumpScheduleVersion()` was left in place, so the
  edit path increments twice — harmless, the version is only a nonce. `getMinNoticeHours()` was
  deleted (zero production callers, and it was an uncached second path to `repo.getSettings()`).
- **P3-03 — the pack variant of `ConfirmationChannelState` deliberately carries no `checkoutType`,**
  matching the shipped wire contract the mobile client already parses; the union discriminates on
  `checkoutType` (single) vs `confirmed` (pack). The route serializes the union verbatim. The
  limiter runs *after* `getSession()` because it keys by authenticated email, so the 401 path is
  unlimited by design.
- **P3-01 — `AvailabilityModal` shrank 259 lines, just under the ≥300 target,** because the
  modal-only `DayColumn` (~130 lines) was explicitly scoped to stay in the consumer. No leftover
  duplication.
- **P2-03 — verified statically, not by forced live sign-in** (needs real Google OAuth in dev).
  Like-for-like logger swap in NextAuth config; no service-layer seam to test.

**Known regressions introduced:** none recorded.

---

## Deferred to a future refactor

Carried from `PLAN.md` → *Deferred / explicitly out of scope this cycle*:

- **`ZoomRoomSession.tsx` hook split** (1,497 lines, 22 `useState`) — deferred a **second** time;
  style, not correctness. Revisit only if a Zoom-room feature forces edits there.
- **XState for the Zoom room state machine** (carried from cycle 2).
- **`pino` logger migration** (cycle 2's P4-02 Part B).
- **Availability route: invalid `tz` query param → generic 500 instead of 400** — cosmetic.

---

## PRs

Eight of the nine shipped tasks map 1:1 to a merged PR (linked in the tables above, #51–#67).
`REFACTOR-R3-P4-01` was done directly on `staging` at Gustavo's direction — trace it via commit
`81cfa32`. All code changes carry their `REFACTOR-R3-PN-NN` tag in the file-top comment block.
