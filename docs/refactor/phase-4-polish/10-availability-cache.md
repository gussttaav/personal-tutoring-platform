# Task 4.10 — Availability Caching

**Fix ID:** `PERF-10`
**Priority:** P3
**Est. effort:** 2 hours

## Problem

`/api/availability` calls Google Calendar's freebusy API on every request. For dates far in the future, availability rarely changes — a student browsing 3 weeks ahead hits Google Calendar every time they change their date selection in the UI.

Google Calendar's API quotas:
- 1,000,000 queries/day per project (generous for a single tutor)
- 600 queries/minute per user (the service account)

We're not close to limits today, but:
- Reducing Google API calls improves page load time (Google adds ~50–200ms latency)
- Reduces dependency on Google's uptime for a read-only operation
- Simple to cache correctly because slot availability has a clear invalidation signal (booking creation)

## Scope

**Modify:**
- `src/app/api/availability/route.ts` — add tiered caching
- `src/services/BookingService.ts` — invalidate cache on booking/cancel

**Create:**
- `src/lib/availability-cache.ts` — helper for cache key format + TTL logic

**Do not touch:**
- Google Calendar client code
- Slot generation logic in `calendar.ts`

## Approach

### Step 1 — Tiered TTL

Slots change less often the further out they are:

| Date distance | Cache TTL | Rationale |
|---|---|---|
| Today / tomorrow | 0 (no cache) | High churn; cache risks stale data for minutes |
| 2–7 days ahead | 5 minutes | Moderate change rate |
| 8+ days ahead | 15 minutes | Low change rate |

Cache is invalidated on any new booking or cancellation that affects the date.

### Step 2 — Cache helper

```ts
// src/lib/availability-cache.ts
/**
 * PERF-10 — Tiered availability caching.
 *
 * Cache key format: avail:{date}:{duration}
 * TTL depends on how far out the date is.
 */
import { kv } from "@/infrastructure/redis/client";

export function cacheTTLSeconds(date: string): number {
  const daysAhead = Math.floor(
    (new Date(date).getTime() - Date.now()) / 86_400_000
  );
  if (daysAhead <= 1) return 0;
  if (daysAhead <= 7) return 300;
  return 900;
}

export function cacheKey(date: string, duration: number): string {
  return `avail:${date}:${duration}`;
}

export async function getCached<T>(date: string, duration: number): Promise<T | null> {
  const ttl = cacheTTLSeconds(date);
  if (ttl === 0) return null;
  return kv.get<T>(cacheKey(date, duration));
}

export async function setCached<T>(date: string, duration: number, value: T): Promise<void> {
  const ttl = cacheTTLSeconds(date);
  if (ttl === 0) return;
  await kv.set(cacheKey(date, duration), value, { ex: ttl });
}

/**
 * Invalidate cache for a specific date across all durations we cache.
 * Call this on any booking create/cancel.
 */
export async function invalidate(date: string): Promise<void> {
  await Promise.all([15, 60, 120].map(d =>
    kv.del(cacheKey(date, d))
  ));
}
```

### Step 3 — Apply in the availability route

```ts
// src/app/api/availability/route.ts — relevant section
const cached = await getCached<{ slots: TimeSlot[] }>(date, duration);
if (cached) {
  // Still need to localize timezone if different from server
  const withLocalTime = cached.slots.map(slot => localizeSlot(slot, tz, duration));
  return NextResponse.json({ slots: withLocalTime, timezone: SCHEDULE.timezone, cached: true });
}

const slots = await getAvailableSlots(date, duration);
await setCached(date, duration, { slots });

// ... existing localization + response
```

### Step 4 — Invalidate on booking/cancel

In `BookingService.createBooking`, after the calendar event is created successfully:

```ts
// src/services/BookingService.ts
import { invalidate as invalidateAvailability } from "@/lib/availability-cache";

// After createCalendarEvent succeeds:
const bookingDate = input.startIso.slice(0, 10);
await invalidateAvailability(bookingDate);
```

Same in `BookingService.cancelByToken`:

```ts
const bookingDate = record.startsAt.slice(0, 10);
await invalidateAvailability(bookingDate);
```

And in the reschedule flow (for the OLD date, so it becomes bookable again).

### Step 5 — Observability

Add cache-hit/miss metrics to the log:

```ts
if (cached) {
  log("info", "Availability cache hit", { service: "availability", date, duration });
} else {
  log("info", "Availability cache miss", { service: "availability", date, duration });
}
```

After a week in production, check the ratio in Vercel logs. Target: >70% hit rate.

## Acceptance Criteria

- [ ] `src/lib/availability-cache.ts` exists with the helpers
- [ ] Tiered TTL logic is correct (0 / 5min / 15min)
- [ ] `/api/availability` checks cache before calling Google
- [ ] `/api/availability` writes to cache on miss
- [ ] `BookingService.createBooking` invalidates cache on success
- [ ] `BookingService.cancelByToken` invalidates cache on success
- [ ] Reschedule invalidates both old and new dates
- [ ] Cache-hit/miss logged for observability
- [ ] Unit test for `cacheTTLSeconds`: today → 0, 3 days → 300, 14 days → 900
- [ ] Manual test: open booking wizard → browse dates → verify second visit to same date returns faster
- [ ] Manual test: book a session → verify availability for that date updates immediately (cache invalidated)
- [ ] `npm run build` passes
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **7.2 Cache Availability Slots**.

## Testing

```ts
// src/lib/__tests__/availability-cache.test.ts
describe("cacheTTLSeconds", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(cacheTTLSeconds(today)).toBe(0);
  });

  it("returns 300 for 3 days ahead", () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(300);
  });

  it("returns 900 for 14 days ahead", () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(900);
  });
});
```

## Out of Scope

- Caching the localized-timezone variant (cache stores the raw slots; localization is cheap and happens per-request)
- Implementing CDN-layer caching via `Cache-Control` headers (possible but complicates invalidation — Redis cache is sufficient)
- Stale-while-revalidate patterns (SWR) — add only if the cache hit rate proves too low

## Rollback

Safe. Remove the cache calls and the route reverts to hitting Google on every request. Cached entries TTL out naturally. No data model changes.
