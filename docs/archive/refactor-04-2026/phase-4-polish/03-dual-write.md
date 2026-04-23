# Task 4.3 — Dual-Write Phase

**Fix ID:** `DB-03`
**Priority:** P3
**Est. effort:** 2 hours

## Problem

With Redis repositories (production) and Supabase repositories (new, untested at scale) both implementing the same interfaces, we can run them in parallel. Writes go to both; reads still come from Redis. This lets us:

1. Populate Supabase with live production data
2. Verify that writes succeed consistently
3. Run reconciliation against live-traffic data without affecting user-facing behavior
4. Build confidence before flipping primary

The pattern: a `DualWriteRepository` class wraps both, writes to both (primary + shadow), and reads from primary only. If the shadow write fails, log and continue — a failed shadow write must never break user-facing behavior.

## Scope

**Create:**
- `src/infrastructure/dual-write/DualCreditsRepository.ts`
- `src/infrastructure/dual-write/DualBookingRepository.ts`
- `src/infrastructure/dual-write/DualSessionRepository.ts`
- `src/infrastructure/dual-write/DualPaymentRepository.ts`
- `src/infrastructure/dual-write/DualAuditRepository.ts`
- `src/infrastructure/dual-write/index.ts`

**Modify:**
- `src/services/index.ts` — switch singleton construction to use dual-write repos when `ENABLE_DUAL_WRITE` env var is set
- `src/lib/startup-checks.ts` — make Supabase vars required when `ENABLE_DUAL_WRITE=true`

**Do not touch:**
- The interfaces themselves
- Individual Redis or Supabase repositories
- Service-layer code

## Approach

### Step 1 — Dual-write wrappers

```ts
// src/infrastructure/dual-write/DualCreditsRepository.ts
/**
 * DB-03 — Dual-write wrapper for credit operations.
 *
 * Writes are fanned out to both primary (Redis) and shadow (Supabase).
 * Reads come from primary only. Shadow failures are logged but do not
 * throw — the user-facing flow must not depend on the shadow.
 *
 * This is a temporary class. After the flip in Task 4.5, services use
 * the primary repository (Supabase) directly and this wrapper is deleted.
 */
import type { ICreditsRepository, CreditResult }
  from "@/domain/repositories/ICreditsRepository";
import { log } from "@/lib/logger";

export class DualCreditsRepository implements ICreditsRepository {
  constructor(
    private readonly primary: ICreditsRepository,
    private readonly shadow:  ICreditsRepository,
  ) {}

  async getCredits(email: string): Promise<CreditResult | null> {
    return this.primary.getCredits(email);
  }

  async addCredits(params: Parameters<ICreditsRepository["addCredits"]>[0]): Promise<void> {
    await this.primary.addCredits(params);

    // Shadow write — never throws, only logs
    this.shadow.addCredits(params).catch((err) =>
      log("warn", "Shadow write failed: addCredits", {
        service: "dual-write",
        email: params.email,
        stripeSessionId: params.stripeSessionId,
        error: String(err),
      })
    );
  }

  async decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }> {
    const primary = await this.primary.decrementCredit(email);

    // Shadow only attempts if primary succeeded — otherwise shadow drift
    if (primary.ok) {
      this.shadow.decrementCredit(email).catch((err) =>
        log("warn", "Shadow write failed: decrementCredit", { email, error: String(err) })
      );
    }
    return primary;
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    const primary = await this.primary.restoreCredit(email);

    if (primary.ok) {
      this.shadow.restoreCredit(email).catch((err) =>
        log("warn", "Shadow write failed: restoreCredit", { email, error: String(err) })
      );
    }
    return primary;
  }
}
```

### Step 2 — Apply the same pattern to each repository

The only subtlety: for atomic operations (decrement, restore, consumeCancelToken), shadow write should only happen if the primary succeeds. Otherwise the shadow gets decremented when the primary rejected, creating drift.

### Step 3 — Wire into services

```ts
// src/services/index.ts
import {
  creditsRepository as redisCreditsRepo,
  bookingRepository as redisBookingRepo,
  // etc.
} from "@/infrastructure/redis";
import {
  supabaseCreditsRepository,
  supabaseBookingRepository,
  // etc.
} from "@/infrastructure/supabase";
import { DualCreditsRepository } from "@/infrastructure/dual-write/DualCreditsRepository";
// etc.

const DUAL_WRITE_ENABLED = process.env.ENABLE_DUAL_WRITE === "true";

const creditsRepo = DUAL_WRITE_ENABLED
  ? new DualCreditsRepository(redisCreditsRepo, supabaseCreditsRepository)
  : redisCreditsRepo;

// ... same for other repos

export const creditService = new CreditService(creditsRepo, auditRepo);
// ... etc
```

### Step 4 — Startup check

```ts
// src/lib/startup-checks.ts
if (process.env.ENABLE_DUAL_WRITE === "true") {
  const dbVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = dbVars.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`ENABLE_DUAL_WRITE=true but missing: ${missing.join(", ")}`);
  }
}
```

### Step 5 — Enable in preview first

Set `ENABLE_DUAL_WRITE=true` in the Vercel Preview environment. Deploy a preview. Run through the full flow (sign in, purchase pack, book, cancel) and verify:

1. Production behavior works (primary writes succeed)
2. Supabase dashboard shows the shadow data

After a few days of clean preview traffic, enable in production.

## Dual-Write Duration

Run for **2–4 weeks** before flipping primary (Task 4.5). This gives:

- Coverage of weekly usage patterns (different days of week, different session types)
- Enough reconciliation runs (Task 4.4) to trust the data
- Time to catch edge cases: pack expiry, reschedule flows, refunds

Do not flip until reconciliation shows zero drift for at least 7 consecutive days.

## Acceptance Criteria

- [ ] Five dual-write wrappers exist, each implementing its interface
- [ ] Wrappers read from primary, write to both, log shadow failures
- [ ] Atomic ops write to shadow only if primary succeeded
- [ ] `src/services/index.ts` constructs dual-write repos when env flag is set
- [ ] Startup check enforces Supabase vars when dual-write is enabled
- [ ] `ENABLE_DUAL_WRITE=true` in Preview, verified live
- [ ] Preview test: purchase a pack, see credit pack row in Supabase
- [ ] Preview test: book a session, see booking row in Supabase
- [ ] Preview test: cancel, see status updated in Supabase
- [ ] No user-visible errors or latency regression in Preview
- [ ] `npm run build` passes
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **5. Migration Plan → Step 2: Dual-Write Phase**.

## Testing

Unit test for the dual-write wrapper — ensure shadow failures don't propagate:

```ts
describe("DualCreditsRepository", () => {
  it("does not throw when shadow write fails", async () => {
    const primary = mockCreditsRepo();
    const shadow  = mockCreditsRepo();
    shadow.addCredits.mockRejectedValue(new Error("shadow down"));

    const repo = new DualCreditsRepository(primary, shadow);
    await expect(repo.addCredits({ ...sampleParams })).resolves.toBeUndefined();
    expect(primary.addCredits).toHaveBeenCalled();
  });

  it("does not write to shadow when primary fails", async () => {
    const primary = mockCreditsRepo();
    const shadow  = mockCreditsRepo();
    primary.addCredits.mockRejectedValue(new Error("primary down"));

    const repo = new DualCreditsRepository(primary, shadow);
    await expect(repo.addCredits({ ...sampleParams })).rejects.toThrow("primary down");
    expect(shadow.addCredits).not.toHaveBeenCalled();
  });
});
```

## Out of Scope

- Backfilling historical Redis data to Supabase — do this as a one-time script after dual-write is enabled in production (see Task 4.4 for the reconciliation tooling, which can be repurposed for backfill)
- Flipping primary (Task 4.5)
- Removing Redis repos (happens gradually in follow-ups after Phase 4)

## Rollback

Trivial. Set `ENABLE_DUAL_WRITE=false` to disable. No data changes — Supabase has extra rows, but they're ignored when the flag is off.
