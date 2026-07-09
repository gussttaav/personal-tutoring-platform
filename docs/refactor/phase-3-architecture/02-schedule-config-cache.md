# P3-02 — Version-keyed cache for `ScheduleService.getConfig()`

**Tag:** `REFACTOR-R3-P3-02` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Every `getConfig()` call performs two Supabase queries (`getWeeklyHours` + `getSettings`).
It runs fresh on every availability request — deliberately, so admin schedule edits apply
immediately — plus every booking and every single-session webhook. The availability modal
fires 7 parallel day-fetches per week view → **14 Supabase round-trips for identical config**.
The invalidation signal already exists: the admin schedule route bumps `avail:version` on
edit. Key a short-TTL Redis config cache to that same version so freshness is preserved.

## Context

- `src/services/ScheduleService.ts:20-31` — the double query.
- `src/app/api/availability/route.ts:42-50` — "Read the schedule fresh (not the 60s ISR cache) … paired with the Redis cache version bump in /api/admin/schedule."
- `src/lib/availability-cache.ts:11-22` — `avail:version` counter + `bumpScheduleVersion()`; availability keys are already version-namespaced, so a bump instantly orphans them. The config cache rides the same mechanism.
- Architecture rule: services get infrastructure via constructor injection (`src/domain/repositories/` interfaces) — the service must not import `kv` directly.
- Other hot callers: `BookingService.createBooking` step 1 (`BookingService.ts:104`), `PaymentService.processSingleSession` (`PaymentService.ts:377`).

## Files affected

| File | Change |
|------|--------|
| `src/domain/repositories/IConfigCache.ts` (new) | Minimal port: `get<T>(key)`, `set<T>(key, value, ttlSec)`, `currentVersion()` |
| `src/infrastructure/redis/RedisConfigCache.ts` (new) | Impl on the shared `kv` client; version read reuses `avail:version` |
| `src/services/ScheduleService.ts` | Inject cache; `getConfig()` reads through it |
| `src/services/index.ts` | Wire the new dependency |
| `src/__tests__/fixtures/` | In-memory `IConfigCache` fake |
| `src/services/__tests__/ScheduleService.test.ts` | Cache-hit / cache-miss / version-bump tests |

## The change

```ts
// ScheduleService.getConfig — REFACTOR-R3-P3-02
async getConfig(): Promise<ScheduleConfig> {
  const version = await this.cache.currentVersion();          // 1 Redis GET
  const key     = `schedule:config:v${version}`;
  const cached  = await this.cache.get<ScheduleConfig>(key);  // 1 Redis GET
  if (cached) return cached;

  const [weeklyHours, settings] = await Promise.all([
    this.repo.getWeeklyHours(),
    this.repo.getSettings(),
  ]);
  const config: ScheduleConfig = {
    weeklyHours,
    timezone:           settings.timezone,
    minNoticeHours:     settings.minNoticeHours,
    bookingWindowWeeks: BOOKING_WINDOW_WEEKS,
  };
  await this.cache.set(key, config, 300); // TTL backstop; version bump is the real invalidator
  return config;
}
```

Freshness argument: `updateConfig` → admin route calls `bumpScheduleVersion()` (already does,
for availability keys) → next `getConfig()` resolves a new version → miss → fresh read. The
300s TTL only bounds orphan memory, exactly like the availability keys.

**Verify during implementation** that `/api/admin/schedule` bumps the version *after*
`updateConfig` persists (read the route; if it bumps before the DB write completes, a racing
read could cache stale config under the new version — if so, move the bump after the write).

## Acceptance criteria

- [ ] Warm path: `getConfig()` = 2 Redis reads, 0 Supabase queries (assert via fakes: repo methods not called on hit)
- [ ] Admin schedule edit → next availability response reflects it immediately (manual: edit `/admin/schedule`, refetch `/api/availability` — no stale window)
- [ ] Redis outage degrades to direct Supabase reads (cache port failures are caught → fall through to `repo`, log a warning), never a 500
- [ ] `ScheduleService` still imports zero infrastructure modules (port injected)
- [ ] `getMinNoticeHours()` either reads through `getConfig()` or is deleted if unused (check callers)
- [ ] File-top comment blocks updated with `REFACTOR-R3-P3-02`

## Test plan

- **Existing:** `ScheduleService.test.ts`, `BookingService.test.ts`, `PaymentService.test.ts` (constructor signature change ripples into test setup — update fixtures once).
- **New:** hit → no repo calls; miss → repo called + `set` with 300s; version bump between calls → refetch; cache `get` throws → repo fallback + no throw.
- **Manual (perf):** open the availability modal in dev with Supabase query logging on — config queries per week view drop from 14 to ≤ 2 (first miss populates; 6 parallel siblings may race the first miss — acceptable, they just each do the Supabase read once; do NOT add miss-coalescing locks for config, it's tiny).

## Notes / gotchas

- **Store the config as one JSON value.** Upstash REST has no MULTI/EXEC (CLAUDE.md gotcha); a single `SET`/`GET` is atomic enough.
- Weekly-hours shape (`WeeklyHours`) serializes cleanly (arrays of minute blocks) — but confirm `kv.get` deserialization matches (`@upstash/redis` auto-JSONs; mirror how `availability-cache.ts` round-trips objects).
- `BOOKING_WINDOW_WEEKS` is static/in-code — caching it inside the value is fine; it can't drift.
- Don't cache in `PricingService` "while you're there" — separate concern, separate cycle if ever needed (`getDisplayPrices` already caches on the display path).

## Out of scope

- Coalescing config cache misses (unnecessary at this cost).
- Caching pricing or other admin-editable tables.
- Changing the availability-cache mechanics themselves.
