# Task 4.2 — Supabase Repository Implementations

**Fix ID:** `DB-02`
**Priority:** P3
**Est. effort:** 6 hours

## Problem

Task 4.1 created the database. Task 4.2 implements the repository interfaces against Supabase. The result: `SupabaseCreditsRepository`, `SupabaseBookingRepository`, etc., each implementing the same interface as its Redis counterpart. Services remain unchanged — they just get constructed with a different implementation.

These repositories are **not yet wired into production**. This task creates them alongside the Redis repos. Task 4.3 turns on dual-write. Task 4.5 flips primary.

## Scope

**Create:**
- `src/infrastructure/supabase/client.ts` — Supabase client singleton
- `src/infrastructure/supabase/SupabaseCreditsRepository.ts`
- `src/infrastructure/supabase/SupabaseBookingRepository.ts`
- `src/infrastructure/supabase/SupabaseSessionRepository.ts`
- `src/infrastructure/supabase/SupabasePaymentRepository.ts`
- `src/infrastructure/supabase/SupabaseAuditRepository.ts`
- `src/infrastructure/supabase/types.ts` — generated Supabase types
- `src/infrastructure/supabase/index.ts`
- `src/infrastructure/supabase/__tests__/*.test.ts`

**Do not touch:**
- The Redis repositories — they stay functional
- The service layer — services still use Redis repos
- Any route handler

## Approach

### Step 1 — Install dependency

```bash
npm install @supabase/supabase-js
```

### Step 2 — Client singleton

```ts
// src/infrastructure/supabase/client.ts
/**
 * DB-02 — Supabase client singleton.
 *
 * Uses the SERVICE_ROLE_KEY, which bypasses Row Level Security. This is
 * correct for server-side code: the NextAuth session is the auth boundary.
 * NEVER expose the service role key to the browser.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = createSupabaseClient();
```

### Step 3 — Generate types

```bash
supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts
```

Check this generated file into the repo. Regenerate whenever migrations change.

### Step 4 — Credits repository

Key differences from Redis: credits are per-pack rows, not a single aggregate record. Queries aggregate across active (non-expired) packs.

```ts
// src/infrastructure/supabase/SupabaseCreditsRepository.ts
export class SupabaseCreditsRepository implements ICreditsRepository {
  async getCredits(email: string): Promise<CreditResult | null> {
    // Find or create the user
    const userId = await this.findUserId(email);
    if (!userId) return null;

    // Sum credits across all active (non-expired) packs
    const { data: packs, error } = await supabase
      .from("credit_packs")
      .select("credits_remaining, pack_size, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .gt("credits_remaining", 0)
      .order("expires_at", { ascending: true }); // expire-first consumption

    if (error) throw error;
    if (!packs?.length) return null;

    const total = packs.reduce((sum, p) => sum + p.credits_remaining, 0);
    const { data: user } = await supabase
      .from("users").select("name").eq("id", userId).single();

    return {
      credits:   total,
      name:      user?.name ?? "",
      packSize:  packs[0].pack_size as PackSize, // oldest-expiring pack
      expiresAt: packs[0].expires_at,
    };
  }

  async addCredits(params: {
    email: string; name: string; creditsToAdd: number;
    packLabel: string; stripeSessionId: string;
  }): Promise<void> {
    const userId = await this.upsertUser(params.email, params.name);

    // Idempotency via unique constraint on stripe_payment_id
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6); // PACK_VALIDITY_MONTHS

    const { error } = await supabase
      .from("credit_packs")
      .insert({
        user_id:           userId,
        pack_size:         params.creditsToAdd,
        credits_remaining: params.creditsToAdd,
        stripe_payment_id: params.stripeSessionId,
        expires_at:        expiresAt.toISOString(),
      });

    // 23505 = unique violation = idempotency triggered, safe to ignore
    if (error && error.code !== "23505") throw error;
  }

  async decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }> {
    const userId = await this.findUserId(email);
    if (!userId) return { ok: false, remaining: 0 };

    // Atomic decrement via a stored procedure (see below)
    const { data, error } = await supabase.rpc("decrement_credit", { p_user_id: userId });

    if (error) throw error;
    return data as { ok: boolean; remaining: number };
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    const userId = await this.findUserId(email);
    if (!userId) return { ok: false, credits: 0 };

    const { data, error } = await supabase.rpc("restore_credit", { p_user_id: userId });
    if (error) throw error;
    return data as { ok: boolean; credits: number };
  }

  private async findUserId(email: string): Promise<string | null> {
    const { data } = await supabase
      .from("users").select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    return data?.id ?? null;
  }

  private async upsertUser(email: string, name: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .upsert({ email: normalized, name }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}
```

### Step 5 — Atomic decrement via stored procedure

The Redis implementation uses Lua for atomicity. Postgres uses a stored procedure:

Add to `supabase/migrations/0002_credit_procedures.sql`:

```sql
-- Atomically decrement one credit from the earliest-expiring active pack.
-- Returns {ok, remaining} where remaining is total across all active packs.
CREATE OR REPLACE FUNCTION decrement_credit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_pack_id UUID;
  v_total   INT;
BEGIN
  -- Lock the earliest-expiring pack with credits remaining
  SELECT id INTO v_pack_id
  FROM credit_packs
  WHERE user_id = p_user_id
    AND credits_remaining > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pack_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'remaining', 0);
  END IF;

  UPDATE credit_packs
  SET credits_remaining = credits_remaining - 1
  WHERE id = v_pack_id;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs
  WHERE user_id = p_user_id AND expires_at > now();

  RETURN jsonb_build_object('ok', true, 'remaining', v_total);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_credit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_pack_id UUID;
  v_total   INT;
BEGIN
  -- Restore to the earliest-expiring pack that hasn't reached its original size
  SELECT id INTO v_pack_id
  FROM credit_packs
  WHERE user_id = p_user_id
    AND credits_remaining < pack_size
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pack_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'credits', 0);
  END IF;

  UPDATE credit_packs
  SET credits_remaining = credits_remaining + 1
  WHERE id = v_pack_id;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs
  WHERE user_id = p_user_id AND expires_at > now();

  RETURN jsonb_build_object('ok', true, 'credits', v_total);
END;
$$ LANGUAGE plpgsql;
```

### Step 6 — Other repositories

The same pattern applies to each:

- **`SupabaseBookingRepository`** — inserts into `bookings`, generates tokens the same way (HMAC with CANCEL_SECRET), stores both tokens as columns
- **`SupabaseSessionRepository`** — inserts into `zoom_sessions` on create; chat messages go to `session_messages` (add this table in migration 0003 if keeping chat persistence — otherwise leave in Redis per PLAN mapping)
- **`SupabasePaymentRepository`** — idempotency via `stripe_payment_id UNIQUE` constraint; dead-letter entries as a `payments` row with `status: 'failed'`
- **`SupabaseAuditRepository`** — simple INSERT into `audit_log`

### Step 7 — Singleton exports

```ts
// src/infrastructure/supabase/index.ts
import { SupabaseCreditsRepository } from "./SupabaseCreditsRepository";
// ... etc

export const supabaseCreditsRepository = new SupabaseCreditsRepository();
export const supabaseBookingRepository = new SupabaseBookingRepository();
export const supabaseSessionRepository = new SupabaseSessionRepository();
export const supabasePaymentRepository = new SupabasePaymentRepository();
export const supabaseAuditRepository   = new SupabaseAuditRepository();
```

## Acceptance Criteria

- [ ] `@supabase/supabase-js` in dependencies
- [ ] Supabase client singleton exists
- [ ] Database types generated and checked in
- [ ] Five Supabase repositories implement their interfaces
- [ ] Atomic credit ops use stored procedures (migration 0002)
- [ ] Idempotency via unique constraints (handles 23505 errors gracefully)
- [ ] Each repository has a unit test that runs against a test Supabase project
- [ ] `npm run build` passes
- [ ] `npm test` passes (tests are gated on `SUPABASE_URL` being set, skip otherwise)
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **4. Future Database Schema** and **5. Migration Plan → Step 2**.

## Testing

Each repository gets a smoke test against a real Supabase test instance:

```ts
// SupabaseCreditsRepository.test.ts
describe("SupabaseCreditsRepository", () => {
  const repo = new SupabaseCreditsRepository();
  const testEmail = `test-${Date.now()}@example.com`;

  afterAll(async () => {
    // Cleanup
    await supabase.from("credit_packs").delete().eq("user_id", userId);
    await supabase.from("users").delete().eq("email", testEmail);
  });

  it("addCredits is idempotent by stripeSessionId", async () => {
    await repo.addCredits({ email: testEmail, name: "Test", creditsToAdd: 5, packLabel: "Pack 5", stripeSessionId: "pi_test_1" });
    await repo.addCredits({ email: testEmail, name: "Test", creditsToAdd: 5, packLabel: "Pack 5", stripeSessionId: "pi_test_1" });
    const balance = await repo.getCredits(testEmail);
    expect(balance?.credits).toBe(5); // not 10
  });

  it("decrementCredit is atomic under concurrency", async () => {
    // Add 1 credit, fire 10 concurrent decrements, expect 1 success + 9 failures
    await repo.addCredits({ ..., creditsToAdd: 1, stripeSessionId: "pi_concurrency" });
    const results = await Promise.all(
      Array(10).fill(0).map(() => repo.decrementCredit(testEmail))
    );
    const successes = results.filter(r => r.ok).length;
    expect(successes).toBe(1);
  });
});
```

Gate these tests with:

```ts
const describeDb = process.env.SUPABASE_URL ? describe : describe.skip;
describeDb("SupabaseCreditsRepository", () => { ... });
```

So they run only when a Supabase URL is configured (local dev, CI with test DB) and skip otherwise.

## Out of Scope

- Wiring Supabase repos into production (Task 4.3)
- Migrating existing Redis data (Task 4.3 + 4.4)
- Adding RLS policies for client-side access

## Rollback

Safe. These are new files; deleting them affects nothing. The services still use Redis repositories.
