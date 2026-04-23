# Task 3.2 — Implement Redis Repository Adapters

**Fix ID:** `ARCH-11`
**Priority:** P2
**Est. effort:** 4 hours

## Problem

Task 3.1 defined repository interfaces. Now we need concrete implementations that wrap the existing `kv.ts`, `calendar.ts` (for booking/session persistence), and slot-lock logic.

This task is still zero-behavior-change. The repositories are thin wrappers that delegate to the existing functions. The migration from direct `kv` calls to repositories happens in Tasks 3.3–3.6, not here.

## Scope

**Create:**
- `src/infrastructure/redis/RedisCreditsRepository.ts`
- `src/infrastructure/redis/RedisBookingRepository.ts`
- `src/infrastructure/redis/RedisSessionRepository.ts`
- `src/infrastructure/redis/RedisPaymentRepository.ts`
- `src/infrastructure/redis/RedisAuditRepository.ts`
- `src/infrastructure/redis/index.ts` — exports singleton instances

**Do not touch:**
- Existing `kv.ts`, `calendar.ts`, etc. — these continue to work unchanged
- Any route handler or service

## Approach

Each implementation wraps existing functions. Do **not** copy logic — delegate. This keeps the two code paths equivalent during the migration.

### Step 1 — Credits repository

```ts
// src/infrastructure/redis/RedisCreditsRepository.ts
/**
 * ARCH-11 — Redis-backed implementation of ICreditsRepository.
 *
 * Wraps the existing src/lib/kv.ts functions. Once all callers are migrated
 * through services (Tasks 3.3–3.6), kv.ts can be deleted and its logic
 * inlined here.
 */
import type { ICreditsRepository, CreditResult }
  from "@/domain/repositories/ICreditsRepository";
import * as kvModule from "@/lib/kv";

export class RedisCreditsRepository implements ICreditsRepository {
  async getCredits(email: string): Promise<CreditResult | null> {
    return kvModule.getCredits(email);
  }

  async addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void> {
    return kvModule.addOrUpdateStudent(
      params.email,
      params.name,
      params.creditsToAdd,
      params.packLabel,
      params.stripeSessionId,
    );
  }

  async decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }> {
    return kvModule.decrementCredit(email);
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    return kvModule.restoreCredit(email);
  }
}
```

### Step 2 — Booking repository

```ts
// src/infrastructure/redis/RedisBookingRepository.ts
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { BookingRecord } from "@/domain/types";
import * as calendarModule from "@/lib/calendar";
import { kv } from "@/lib/redis";

export class RedisBookingRepository implements IBookingRepository {
  async createBooking(record: Omit<BookingRecord, "used">) {
    // Assumes Task 1.5 has landed → createBookingTokens exists
    return calendarModule.createBookingTokens(record);
  }

  async findByCancelToken(token: string): Promise<BookingRecord | null> {
    const result = await calendarModule.verifyCancellationToken(token);
    return result?.record ?? null;
  }

  async findByJoinToken(token: string) {
    return calendarModule.resolveJoinToken(token);
  }

  async consumeCancelToken(token: string): Promise<boolean> {
    // The existing consumeCancellationToken takes optional email for cleanup;
    // we look up the record first to get the email.
    const rec = await calendarModule.verifyCancellationToken(token);
    return calendarModule.consumeCancellationToken(token, rec?.record.email);
  }

  async listByUser(email: string): Promise<BookingRecord[]> {
    const setKey = `bookings:${email.toLowerCase().trim()}`;
    const tokens = await kv.zrange<string[]>(setKey, 0, -1);
    if (!tokens?.length) return [];

    const records = await Promise.all(
      tokens.map(t => kv.get<BookingRecord>(`cancel:${t}`))
    );
    return records.filter((r): r is BookingRecord => r !== null && !r.used);
  }

  async acquireSlotLock(startIso: string, durationMinutes: number): Promise<boolean> {
    return calendarModule.acquireSlotLock(startIso, durationMinutes);
  }

  async releaseSlotLock(startIso: string): Promise<void> {
    return calendarModule.releaseSlotLock(startIso);
  }
}
```

### Step 3 — Session repository

```ts
// src/infrastructure/redis/RedisSessionRepository.ts
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ZoomSession } from "@/domain/types";
import { kv } from "@/lib/redis";
import { getSessionDurationWithGrace } from "@/lib/zoom";

export class RedisSessionRepository implements ISessionRepository {
  async createSession(eventId: string, session: ZoomSession): Promise<void> {
    const ttl = getSessionDurationWithGrace(session.sessionType) * 60 + 86_400;
    await kv.set(`zoom:session:${eventId}`, session, { ex: ttl });
  }

  async findByEventId(eventId: string): Promise<ZoomSession | null> {
    return kv.get<ZoomSession>(`zoom:session:${eventId}`);
  }

  async deleteByEventId(eventId: string): Promise<void> {
    await kv.del(`zoom:session:${eventId}`);
  }

  async appendChatMessage(eventId: string, message: string): Promise<number> {
    const listKey = `chat:session:${eventId}`;
    const len = await kv.rpush(listKey, message);
    if (len === 1) {
      await kv.expire(listKey, 86_400);
    }
    return len;
  }

  async listChatMessages(eventId: string, from: number, to: number): Promise<string[]> {
    return kv.lrange<string>(`chat:session:${eventId}`, from, to);
  }

  async countChatMessages(eventId: string): Promise<number> {
    return kv.llen(`chat:session:${eventId}`);
  }
}
```

### Step 4 — Payment repository

```ts
// src/infrastructure/redis/RedisPaymentRepository.ts
import type { IPaymentRepository, FailedBookingEntry }
  from "@/domain/repositories/IPaymentRepository";
import { kv } from "@/lib/redis";

const IDEMPOTENCY_TTL     = 7 * 24 * 60 * 60;
const FAILED_BOOKING_TTL  = 30 * 24 * 60 * 60;

export class RedisPaymentRepository implements IPaymentRepository {
  async isProcessed(key: string): Promise<boolean> {
    return (await kv.get(`webhook:single:${key}`)) !== null;
  }

  async markProcessed(key: string): Promise<void> {
    await kv.set(
      `webhook:single:${key}`,
      { processedAt: new Date().toISOString() },
      { ex: IDEMPOTENCY_TTL },
    );
  }

  async recordFailedBooking(entry: FailedBookingEntry): Promise<void> {
    await kv.set(`failed:booking:${entry.stripeSessionId}`, entry, { ex: FAILED_BOOKING_TTL });
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [next, batch] = await kv.scan(cursor, { match: "failed:booking:*", count: 100 });
      keys.push(...batch);
      cursor = next;
    } while (cursor !== 0 && cursor !== "0");

    const entries = await Promise.all(keys.map(k => kv.get<FailedBookingEntry>(k)));
    return entries.filter((e): e is FailedBookingEntry => e !== null);
  }

  async clearFailedBooking(stripeSessionId: string): Promise<void> {
    await kv.del(`failed:booking:${stripeSessionId}`);
  }
}
```

### Step 5 — Audit repository

```ts
// src/infrastructure/redis/RedisAuditRepository.ts
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { AuditEntry } from "@/domain/types";
import { kv } from "@/lib/redis";

const MAX_AUDIT_ENTRIES = 100;

export class RedisAuditRepository implements IAuditRepository {
  private key(email: string) {
    return `audit:${email.toLowerCase().trim()}`;
  }

  async append(email: string, entry: Omit<AuditEntry, "ts">): Promise<void> {
    const full: AuditEntry = { ...entry, ts: new Date().toISOString() };
    const k = this.key(email);
    await kv.lpush(k, JSON.stringify(full));
    await kv.ltrim(k, 0, MAX_AUDIT_ENTRIES - 1);
  }

  async list(email: string, limit = 100): Promise<AuditEntry[]> {
    const raw = await kv.lrange<string>(this.key(email), 0, limit - 1);
    return raw
      .map(r => {
        try { return JSON.parse(typeof r === "string" ? r : JSON.stringify(r)) as AuditEntry; }
        catch { return null; }
      })
      .filter((e): e is AuditEntry => e !== null);
  }
}
```

### Step 6 — Singleton exports

```ts
// src/infrastructure/redis/index.ts
/**
 * Repository singletons. Services import these by default, but can be
 * constructed with alternative implementations in tests.
 */
import { RedisCreditsRepository } from "./RedisCreditsRepository";
import { RedisBookingRepository } from "./RedisBookingRepository";
import { RedisSessionRepository } from "./RedisSessionRepository";
import { RedisPaymentRepository } from "./RedisPaymentRepository";
import { RedisAuditRepository }   from "./RedisAuditRepository";

export const creditsRepository = new RedisCreditsRepository();
export const bookingRepository = new RedisBookingRepository();
export const sessionRepository = new RedisSessionRepository();
export const paymentRepository = new RedisPaymentRepository();
export const auditRepository   = new RedisAuditRepository();
```

## Acceptance Criteria

- [ ] Five repository classes exist under `src/infrastructure/redis/`
- [ ] Each class implements its corresponding interface (TypeScript enforces this)
- [ ] Each class is a thin wrapper — no business logic moved here
- [ ] `src/infrastructure/redis/index.ts` exports singleton instances
- [ ] Fix-ID comment at the top of each file
- [ ] No existing file is modified
- [ ] `npm run build` passes
- [ ] Manual sanity: import a repository singleton and call a method in a scratch script — behavior matches the old direct call

## Reference

See `docs/refactor/PLAN.md` → section **5. Migration Plan → Step 1–2**.

## Testing

Add minimal smoke tests to `src/infrastructure/redis/__tests__/*.test.ts`:

```ts
// RedisCreditsRepository.test.ts
describe("RedisCreditsRepository", () => {
  it("delegates to kv module", async () => {
    const repo = new RedisCreditsRepository();
    const result = await repo.getCredits("nonexistent@example.com");
    expect(result).toBeNull();
  });
});
```

Deeper testing happens in service unit tests (Tasks 3.3–3.6).

## Out of Scope

- Adding any logic that's not already in `kv.ts` / `calendar.ts`
- Changing TTLs, key formats, or data shapes
- Deleting `kv.ts` or `calendar.ts` (do this after Phase 4)
- Supabase implementations (Phase 4)

## Rollback

Safe. Delete the `src/infrastructure/redis/` directory — nothing depends on it yet.
