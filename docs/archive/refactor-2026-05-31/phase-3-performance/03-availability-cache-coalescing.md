# Task P3-03 — Availability cache coalescing + `decrement_credit` returns `pack_size`

**Severity:** 🟡 Medium
**Effort:** 2–3 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

Two small wins bundled:

1. **Cache stampede:** concurrent cache misses for the same `(date, duration)` each call the Google Calendar API. Coalesce with a short Redis lock.
2. **Double roundtrip:** `BookingService` calls `useCredit` then immediately `getBalance` to read `pack_size`. Roll that into `decrement_credit` so it returns `pack_size` in the same call.

## Context

### 1. Cache stampede in availability

```typescript
// src/app/api/availability/route.ts:7029
const cached = await getCached<{ slots: TimeSlot[] }>(date, duration);
if (cached) { /* hit */ return ... }
const slots = await getAvailableSlots(date, duration);  // ← Google Calendar API
await setCached(date, duration, { slots });
```

Two browsers requesting `/api/availability?date=2026-06-15&duration=60` at the same time, both finding a cache miss, both call Google. Wasted quota; potential rate-limit hit.

### 2. Two roundtrips for credit + pack_size

```typescript
// src/services/BookingService.ts:31627
if (input.sessionType === "pack") {
  await this.credits.useCredit(input.email);                  // RPC roundtrip 1
  const creditRecord = await this.credits.getBalance(input.email); // roundtrip 2
  packSizeForToken = creditRecord?.packSize ?? undefined;
}
```

The `decrement_credit` SQL function already reads the row that holds `pack_size`. Just return it.

## Files affected

| File | Change |
|------|--------|
| `src/lib/availability-cache.ts` | Add `getOrCompute(key, computeFn, ttlSec)` helper |
| `src/app/api/availability/route.ts` | Use `getOrCompute` instead of get → compute → set |
| `supabase/migrations/0008_decrement_credit_pack_size.sql` | **NEW** — update `decrement_credit` to return `pack_size` |
| `src/domain/repositories/ICreditsRepository.ts` | `decrementCredit` returns `pack_size` |
| `src/infrastructure/supabase/SupabaseCreditsRepository.ts` | Pass through new field |
| `src/services/CreditService.ts` | `useCredit` returns `pack_size` |
| `src/services/BookingService.ts` | Drop the extra `getBalance` call |
| `src/__tests__/fixtures/InMemoryCreditsRepository.ts` | Update return shape |

## The change

### 1. `src/lib/availability-cache.ts` — add coalescing helper

```typescript
import { kv } from "@/infrastructure/redis/client";

// ── existing getCached / setCached stays ────────────────────────────────────

// REFACTOR-P3-03: Coalesce concurrent cache misses for the same key. The
// first caller acquires a short Redis lock and runs `compute`; concurrent
// callers wait briefly and re-read. Falls through to compute if the lock
// can't be acquired (avoid deadlock if Redis flakes).
export async function getOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSec: number,
): Promise<T> {
  const cached = await getCachedRaw<T>(key);
  if (cached) return cached;

  const lockKey = `lock:${key}`;
  const locked = await kv.set(lockKey, "1", { nx: true, ex: 10 });

  if (!locked) {
    // Someone else is computing — wait briefly and re-read once.
    await new Promise(r => setTimeout(r, 250));
    const retry = await getCachedRaw<T>(key);
    if (retry) return retry;
    // Fall through and compute ourselves rather than spin further.
  }

  try {
    const value = await compute();
    await setCachedRaw(key, value, ttlSec);
    return value;
  } finally {
    if (locked) await kv.del(lockKey);
  }
}

// Internal helpers — your existing getCached/setCached probably already have
// these or equivalent. Adjust the wrapper above to match your API.
async function getCachedRaw<T>(key: string): Promise<T | null> {
  return (await kv.get<T>(`cache:${key}`)) ?? null;
}
async function setCachedRaw<T>(key: string, value: T, ttlSec: number): Promise<void> {
  await kv.set(`cache:${key}`, value, { ex: ttlSec });
}
```

### 2. `src/app/api/availability/route.ts` — use it

```typescript
import { getOrCompute } from "@/lib/availability-cache";

// inside GET:
try {
  const cacheKey = `avail:${date}:${duration}`;
  const result = await getOrCompute(
    cacheKey,
    async () => {
      log("info", "Availability cache miss — fetching from Calendar", { date, duration });
      const slots = await getAvailableSlots(date, duration);
      return { slots };
    },
    AVAILABILITY_CACHE_TTL_SEC,  // your existing constant
  );

  return NextResponse.json({
    slots: localizeSlots(result.slots, tz, duration),
    timezone: SCHEDULE.timezone,
  });
} catch (err) {
  log("error", "Error fetching slots", { service: "availability", date, error: String(err) });
  return NextResponse.json({ error: "Error al consultar disponibilidad" }, { status: 500 });
}
```

Note: if your existing `getCached` / `setCached` keys differ from `cache:{key}`, harmonize. The key namespace must be consistent.

### 3. New SQL migration: `supabase/migrations/0008_decrement_credit_pack_size.sql`

```sql
-- REFACTOR-P3-03: decrement_credit now returns pack_size of the pack it
-- decremented from, so BookingService doesn't need a separate getBalance call.

CREATE OR REPLACE FUNCTION decrement_credit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_pack_id   UUID;
  v_pack_size INT;
  v_total     INT;
BEGIN
  SELECT id, pack_size INTO v_pack_id, v_pack_size
  FROM credit_packs
  WHERE user_id          = p_user_id
    AND credits_remaining > 0
    AND expires_at        > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pack_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'remaining', 0, 'pack_size', NULL);
  END IF;

  UPDATE credit_packs
  SET credits_remaining = credits_remaining - 1
  WHERE id = v_pack_id;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs
  WHERE user_id   = p_user_id
    AND expires_at > now();

  RETURN jsonb_build_object(
    'ok',        true,
    'remaining', v_total,
    'pack_size', v_pack_size  -- REFACTOR-P3-03
  );
END;
$$ LANGUAGE plpgsql;
```

### 4. Domain types

```typescript
// src/domain/repositories/ICreditsRepository.ts
export interface DecrementResult {
  ok: boolean;
  remaining: number;
  packSize: 5 | 10 | null;  // REFACTOR-P3-03
}

export interface ICreditsRepository {
  decrementCredit(email: string): Promise<DecrementResult>;
  // ... others unchanged
}
```

### 5. Supabase impl

```typescript
async decrementCredit(email: string): Promise<DecrementResult> {
  const userId = await this.findUserId(email);
  if (!userId) return { ok: false, remaining: 0, packSize: null };

  const { data, error } = await supabase.rpc("decrement_credit", { p_user_id: userId });
  if (error) throw error;

  // REFACTOR-P3-03: SQL function now returns pack_size
  const result = data as { ok: boolean; remaining: number; pack_size: number | null };
  return {
    ok: result.ok,
    remaining: result.remaining,
    packSize: (result.pack_size as 5 | 10 | null) ?? null,
  };
}
```

### 6. `CreditService.useCredit` — return packSize

```typescript
async useCredit(email: string): Promise<{ remaining: number; packSize: 5 | 10 | null }> {
  const result = await this.credits.decrementCredit(email);
  if (!result.ok) throw new InsufficientCreditsError();

  await this.audit.append(email, {
    action:    "decrement",
    remaining: result.remaining,
  });

  return { remaining: result.remaining, packSize: result.packSize };
}
```

### 7. `BookingService.createBooking` — drop the extra call

```typescript
// Before (line 31627):
if (input.sessionType === "pack") {
  await this.credits.useCredit(input.email);
  const creditRecord = await this.credits.getBalance(input.email);
  packSizeForToken = creditRecord?.packSize ?? undefined;
}

// After:
if (input.sessionType === "pack") {
  const { packSize } = await this.credits.useCredit(input.email);
  packSizeForToken = packSize ?? undefined;
}
```

## Acceptance criteria

- [ ] `getOrCompute` exported from `lib/availability-cache.ts`
- [ ] `/api/availability` uses `getOrCompute` — only one Calendar API call for two concurrent same-key misses
- [ ] `decrement_credit` SQL function returns `pack_size`
- [ ] `CreditService.useCredit` returns `{ remaining, packSize }`
- [ ] `BookingService.createBooking` no longer calls `getBalance` after `useCredit`
- [ ] Net DB queries for a pack booking drop by 1 per booking
- [ ] All existing tests pass

## Test plan

### Coalescing test

```typescript
describe("REFACTOR-P3-03: cache coalescing", () => {
  it("collapses two concurrent misses into one compute call", async () => {
    const computeFn = jest.fn().mockResolvedValue({ slots: [{ start: "...", end: "...", label: "..." }] });

    const [a, b] = await Promise.all([
      getOrCompute("test-key", computeFn, 60),
      getOrCompute("test-key", computeFn, 60),
    ]);

    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("falls through to compute if lock acquire fails", async () => {
    // Mock kv.set to return null (lock not acquired)
    jest.spyOn(kv, "set").mockResolvedValueOnce(null as never);
    const computeFn = jest.fn().mockResolvedValue({ slots: [] });
    await getOrCompute("test-key-2", computeFn, 60);
    expect(computeFn).toHaveBeenCalled();
  });
});
```

### Pack size test

```typescript
describe("REFACTOR-P3-03: decrement_credit returns pack_size", () => {
  it("returns the pack_size of the decremented pack", async () => {
    const services = buildTestServices();
    await services.creditService.addCredits({
      email: "u@example.com", name: "U", amount: 5,
      packLabel: "Pack 5 clases", stripeSessionId: "pi_test",
    });

    const { packSize } = await services.creditService.useCredit("u@example.com");
    expect(packSize).toBe(5);
  });
});
```

### Manual

```bash
# Stampede test (requires SUPABASE/Upstash real services or a good mock)
# Fire 5 concurrent requests for the same uncached date:
for i in {1..5}; do
  curl -s "https://gustavoai.dev/api/availability?date=2026-06-15&duration=60" &
done
wait

# Check structured logs: should see ONE "Availability cache miss" line, not 5.
```

## Notes / gotchas

- **Coalescing isn't free.** Each request adds 1 Redis `SET NX` even on hits — keep an eye on Upstash command count. Acceptable; Redis is cheap.
- **The 250 ms wait** in the loser-of-lock path is conservative. Tune down if Google Calendar latency is consistently <100 ms.
- **`pack_size` is nullable in the return** because the function can decrement-and-find-none (returns `ok: false`). Don't try to assert non-null in callers.
- **Don't replace `getBalance` everywhere.** Other callers (admin UI, credits route) still need the full record.

## Out of scope

- Returning `expires_at` from `decrement_credit` as well. Add if/when needed.
- A general-purpose request coalescer middleware. The helper is sufficient for this one hot path.
- Replacing Upstash Redis with a stronger primitive (e.g. Redlock). Single-node coalescing is fine.
