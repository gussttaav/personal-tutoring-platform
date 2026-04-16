# Task 4.4 — Reconciliation Script

**Fix ID:** `DB-04`
**Priority:** P3
**Est. effort:** 3 hours

## Problem

Dual-write produces data in both stores. Reconciliation verifies they agree. Without this, the flip in Task 4.5 is blind — we don't know if Supabase is missing data, has extra data, or has different values. Drift can emerge from:

- Shadow-write failures (logged but not retried)
- Ordering issues (concurrent writes arriving in different orders)
- TTL-expired Redis entries that were never persisted to Supabase
- Bugs in repository implementations

The reconciliation script compares the two stores and produces a diff report. Run it daily during the dual-write phase; only flip primary after several consecutive clean runs.

## Scope

**Create:**
- `scripts/reconcile.ts` — main reconciliation script
- `scripts/backfill.ts` — one-time script to copy existing Redis data into Supabase
- `package.json` — add `npm run reconcile` and `npm run backfill` scripts

**Do not touch:**
- Application code
- The dual-write wrappers

## Approach

### Step 1 — Backfill script (one-time)

Before reconciliation is useful, historical Redis data must exist in Supabase. Dual-write only covers new writes; data from before dual-write was enabled remains Redis-only.

```ts
// scripts/backfill.ts
/**
 * DB-04 — One-time backfill of Redis data into Supabase.
 *
 * Run: npm run backfill
 *
 * This scans all Redis keys for persistent entities (credits, bookings,
 * audit) and copies them to Supabase. Idempotent — re-running skips
 * entries already in Supabase (via unique constraints).
 *
 * Run ONCE, after dual-write has been enabled for 24h (so new writes
 * are already going to both stores) and BEFORE reconciliation.
 */
import { kv } from "@/infrastructure/redis/client";
import { supabase } from "@/infrastructure/supabase/client";
import type { CreditRecord, BookingRecord, AuditEntry } from "@/domain/types";

async function backfillCredits() {
  let cursor: string | number = 0;
  let processed = 0;
  let inserted = 0;

  do {
    const [next, keys] = await kv.scan(cursor, { match: "credits:*", count: 100 });
    for (const key of keys) {
      const record = await kv.get<CreditRecord>(key);
      if (!record) continue;
      processed++;

      // Upsert user
      const { data: user } = await supabase
        .from("users")
        .upsert({ email: record.email, name: record.name }, { onConflict: "email" })
        .select("id")
        .single();

      if (!user) { console.error(`Failed to upsert user ${record.email}`); continue; }

      // Insert credit pack (idempotent via stripe_payment_id UNIQUE)
      const { error } = await supabase.from("credit_packs").insert({
        user_id:           user.id,
        pack_size:         record.packSize ?? record.credits,
        credits_remaining: record.credits,
        stripe_payment_id: record.stripeSessionId,
        expires_at:        record.expiresAt,
        source:            "redis",
      });

      if (!error) inserted++;
      else if (error.code !== "23505") {
        console.error(`Failed to insert pack for ${record.email}:`, error.message);
      }
    }
    cursor = next;
  } while (cursor !== 0 && cursor !== "0");

  console.log(`Credits: processed ${processed}, inserted ${inserted}`);
}

async function backfillBookings() { /* similar pattern */ }
async function backfillAudit() { /* similar pattern */ }

async function main() {
  console.log("Starting backfill...");
  await backfillCredits();
  await backfillBookings();
  await backfillAudit();
  console.log("Backfill complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
```

### Step 2 — Reconciliation script

```ts
// scripts/reconcile.ts
/**
 * DB-04 — Reconciliation between Redis and Supabase.
 *
 * Run: npm run reconcile
 *
 * Compares live data between the two stores. Outputs a report of:
 *   - Entries in Redis but not in Supabase (missing in shadow)
 *   - Entries in Supabase but not in Redis (extra in shadow)
 *   - Entries with different values (drift)
 *
 * Exit code:
 *   0 = no drift
 *   1 = drift detected
 *
 * Set up a daily cron to run this during the dual-write phase. Only
 * proceed to Task 4.5 (flip primary) after several consecutive days
 * of exit code 0.
 */
import { kv } from "@/infrastructure/redis/client";
import { supabase } from "@/infrastructure/supabase/client";

interface ReconciliationReport {
  credits: {
    missingInSupabase: string[];
    extraInSupabase:   string[];
    drift:             Array<{ email: string; redis: number; supabase: number }>;
  };
  bookings: {
    missingInSupabase: string[];
    extraInSupabase:   string[];
  };
}

async function reconcileCredits(): Promise<ReconciliationReport["credits"]> {
  // Build Redis side
  const redisCredits = new Map<string, number>();
  let cursor: string | number = 0;
  do {
    const [next, keys] = await kv.scan(cursor, { match: "credits:*", count: 100 });
    for (const key of keys) {
      const email = key.replace("credits:", "");
      const record = await kv.get<{ credits: number; expiresAt: string }>(key);
      if (record && new Date(record.expiresAt) > new Date()) {
        redisCredits.set(email, record.credits);
      }
    }
    cursor = next;
  } while (cursor !== 0 && cursor !== "0");

  // Build Supabase side
  const { data: packs } = await supabase
    .from("credit_packs")
    .select("credits_remaining, users!inner(email)")
    .gt("expires_at", new Date().toISOString())
    .gt("credits_remaining", 0);

  const supabaseCredits = new Map<string, number>();
  for (const pack of packs ?? []) {
    // @ts-expect-error Supabase typing quirk on inner join
    const email = pack.users.email;
    supabaseCredits.set(email, (supabaseCredits.get(email) ?? 0) + pack.credits_remaining);
  }

  // Diff
  const missing: string[] = [];
  const extra: string[] = [];
  const drift: Array<{ email: string; redis: number; supabase: number }> = [];

  for (const [email, redisVal] of redisCredits) {
    const supabaseVal = supabaseCredits.get(email);
    if (supabaseVal === undefined) missing.push(email);
    else if (supabaseVal !== redisVal) drift.push({ email, redis: redisVal, supabase: supabaseVal });
  }
  for (const email of supabaseCredits.keys()) {
    if (!redisCredits.has(email)) extra.push(email);
  }

  return { missingInSupabase: missing, extraInSupabase: extra, drift };
}

async function reconcileBookings(): Promise<ReconciliationReport["bookings"]> { /* similar */ }

async function main() {
  const report: ReconciliationReport = {
    credits:  await reconcileCredits(),
    bookings: await reconcileBookings(),
  };

  console.log(JSON.stringify(report, null, 2));

  const hasDrift =
    report.credits.missingInSupabase.length > 0 ||
    report.credits.extraInSupabase.length > 0 ||
    report.credits.drift.length > 0 ||
    report.bookings.missingInSupabase.length > 0 ||
    report.bookings.extraInSupabase.length > 0;

  if (hasDrift) {
    console.error("❌ Drift detected");
    process.exit(1);
  } else {
    console.log("✅ Stores are in sync");
    process.exit(0);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

### Step 3 — npm scripts

```json
// package.json
{
  "scripts": {
    "backfill":  "tsx scripts/backfill.ts",
    "reconcile": "tsx scripts/reconcile.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

### Step 4 — Automate with GitHub Actions

```yaml
# .github/workflows/reconcile.yml
name: Daily reconciliation
on:
  schedule:
    - cron: "0 3 * * *"  # 03:00 UTC daily
  workflow_dispatch:

jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run reconcile
        env:
          UPSTASH_REDIS_REST_URL:    ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN:  ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
          SUPABASE_URL:              ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - name: Notify on failure
        if: failure()
        uses: some-email-action
        with: { to: admin@example.com, subject: "Reconciliation drift detected" }
```

## Acceptance Criteria

- [ ] `scripts/backfill.ts` exists and is idempotent
- [ ] `scripts/reconcile.ts` exists and exits with correct codes
- [ ] Both scripts cover: credits, bookings, audit log
- [ ] npm scripts added
- [ ] Backfill run once against production Redis → Supabase populated
- [ ] GitHub Actions workflow runs daily
- [ ] First reconciliation run after backfill shows zero drift
- [ ] Drift on a subsequent run triggers alert
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **5. Migration Plan → Step 2-3**.

## Testing

Test the backfill script in the preview environment before running against production:

1. Populate preview Redis with known data
2. Run `npm run backfill`
3. Verify Supabase state matches

Test reconciliation:

1. Run `npm run reconcile` against synced stores → exit 0
2. Manually introduce drift (delete one Supabase row) → exit 1 + detailed report

## Out of Scope

- Auto-healing drift (not safe without human review — a missing Supabase row might indicate a recent deletion that shouldn't be re-added)
- Continuous replay of missed shadow writes — if drift is small, manual Supabase edits are fine; if large, re-run backfill

## Rollback

Scripts only; no production code changes. If a script has bugs, fix it and re-run.
