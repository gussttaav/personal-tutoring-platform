# Phase 3 — Performance

> **Goal:** kill N+1 queries, replace SSE polling with Realtime, plug the missing membership check, save DB roundtrips on hot paths.

## Why this phase exists

Phase 1 made the system correct. Phase 2 made it defensible. Phase 3 makes it cheap to operate as it grows.

Current hot-path costs the audit found:

- **Chat SSE:** every 1.5s poll, the session repository runs `findZoomSessionId` (2 queries) twice — once for `count`, once for `list` — even if zero new messages arrive. Multiplied across two open chat panels (tutor + student) plus the 20-second connection window = ~100 queries / minute / session.
- **Payment SSE (`/api/sse`):** same shape, ~13 polls per connection.
- **Availability cache miss:** concurrent first-views of a popular date stampede the Google Calendar API.
- **`useCredit` + `getBalance`:** two roundtrips where one would do.
- **`SessionService.getChatMessages`:** missing membership check (admitted in code comment) — security-flavored but bundled here because we're already in `SessionService`.

## Tasks in this phase

| # | Task | Severity | Files touched |
|---|------|----------|---------------|
| 01 | [Replace `/api/chat-session` SSE polling with Supabase Realtime](01-replace-sse-with-realtime.md) | 🟠 High | `api/chat-session/route.ts`, `hooks/useSessionChatStream.ts`, `lib/supabase-browser.ts` (new) |
| 02 | [Fix `SupabaseSessionRepository` N+1](02-session-repository-n1.md) | 🟠 High | `SupabaseSessionRepository.ts`, `ISessionRepository.ts`, `SessionService.ts`, fakes |
| 03 | [Availability cache coalescing + decrement_credit returns pack_size](03-availability-cache-coalescing.md) | 🟡 Medium | `lib/availability-cache.ts`, `BookingService.ts`, new SQL migration |
| 04 | [Chat membership check in `SessionService.getChatMessages`](04-chat-membership-check.md) | 🟡 Medium (security) | `SessionService.ts`, `api/chat-session/route.ts` |

## Dependency graph

```
01 (Realtime) ──── independent (but see note below — Realtime needs RLS or service-role)
02 (N+1)      ──── independent
03 (cache)    ──── independent
04 (member)   ──── depends on 02 only loosely (don't conflict)
```

**Note on Task 01 and Realtime + RLS:** Supabase Realtime uses the anon JWT by default. With Phase 2 Task 01's deny-anon policies, Realtime subscriptions get denied. Task 01 includes the workaround (use a signed channel access token, OR add a permissive Realtime-only policy for `session_messages`). Read both before starting.

## Success criteria for the phase

- [ ] All 4 task PRs merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] **Query count per chat session:** ≤ 3 DB queries per connection lifetime (verify via Supabase logs)
- [ ] **Concurrent cache miss:** two simultaneous availability requests for the same `(date, duration)` produce one Calendar API call, not two (verify via instrumented log)
- [ ] **Chat membership:** `curl /api/chat-session?eventId=...` from a non-participant returns 403, not chat messages
- [ ] **Realtime delivery:** chat message visible to other participant in <500 ms p95 (was ~1.5s with polling)

## What NOT to do in this phase

- Don't migrate the booking-payment SSE (`/api/sse`) to Realtime in this phase. It's a different table (`credit_packs`) with different patterns. Add as a follow-up if Phase 3 Task 01 goes smoothly.
- Don't introduce a query result cache layer (Redis-cached read-throughs). Premature; measure first.
- Don't reach for materialized views. Postgres can handle the workloads after the N+1 fix.

## After this phase

Phase 4 (observability) for production-grade monitoring, or move to feature work.
