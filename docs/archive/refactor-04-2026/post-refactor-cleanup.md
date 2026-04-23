# Post-Refactor Cleanup Guide

**Context:** The full 4-phase refactorization is complete. Supabase is the primary
source of truth and has been stable for weeks. Redis remains only for ephemeral
state (rate limiting, slot locks, in-session chat, availability cache). This
document covers the cleanup tasks to finalize the migration and establish the
ongoing maintenance workflow.

---

## 1. Removing Dual-Write Infrastructure

### What to remove

```
src/infrastructure/dual-write/         ← entire directory
  DualAuditRepository.ts
  DualBookingRepository.ts
  DualCreditsRepository.ts
  DualPaymentRepository.ts
  DualSessionRepository.ts
  index.ts
  __tests__/dual-write.test.ts
```

### What to remove from Redis infrastructure

After dual-write is gone, the Redis repositories for persistent data are dead code:

```
src/infrastructure/redis/
  RedisAuditRepository.ts              ← DELETE
  RedisBookingRepository.ts            ← DELETE
  RedisCreditsRepository.ts            ← DELETE
  RedisPaymentRepository.ts            ← DELETE
  RedisSessionRepository.ts            ← DELETE (if sessions are now in Supabase)
  booking-tokens.ts                    ← DELETE (if token logic moved to Supabase repo)
  credits-store.ts                     ← DELETE (if credit logic moved to Supabase repo)
  __tests__/RedisCreditsRepository.test.ts ← DELETE
```

### What to KEEP in Redis infrastructure

```
src/infrastructure/redis/
  client.ts                            ← KEEP — kv singleton, used by rate limiting
  slot-lock.ts                         ← KEEP — ephemeral slot locks
  index.ts                             ← KEEP — update exports to only export what remains
```

### How to update `src/services/index.ts`

Currently it has conditional logic like:

```ts
const DUAL_WRITE_ENABLED = process.env.ENABLE_DUAL_WRITE === "true";
const creditsRepo = DUAL_WRITE_ENABLED
  ? new DualCreditsRepository(supabaseCreditsRepository, redisCreditsRepo)
  : redisCreditsRepo;
```

Replace with direct Supabase wiring:

```ts
import {
  supabaseCreditsRepository,
  supabaseBookingRepository,
  supabaseSessionRepository,
  supabasePaymentRepository,
  supabaseAuditRepository,
} from "@/infrastructure/supabase";
import { slotLockRepository } from "@/infrastructure/redis";

export const creditService = new CreditService(
  supabaseCreditsRepository,
  supabaseAuditRepository,
);

export const bookingService = new BookingService(
  supabaseBookingRepository,
  supabaseSessionRepository,
  creditService,
  calendarClient,
  zoomClient,
  scheduler,
  emailClient,
);
// ... etc, no dual-write wrappers, no conditional logic
```

### Environment variables to remove

- `ENABLE_DUAL_WRITE` — no longer needed

### Update `src/lib/startup-checks.ts`

Remove the conditional check for Supabase vars behind `ENABLE_DUAL_WRITE`. Make
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unconditionally required.

---

## 2. The `docs/refactor/` Directory

**Move to `docs/archive/refactor-04-2026/`, don't delete.**

The refactoring documents have historical value — they explain *why* architectural
decisions were made, which matters when a future contributor (or future you) asks
"why is there a repository pattern here?" or "why did we choose dual-write over
big-bang migration?"

```bash
mkdir -p docs/archive
mv docs/refactor docs/archive/refactor-04-2026
```

---

## 3. The `scripts/` Directory

**Delete `scripts/backfill.ts` and `scripts/reconcile.ts`.**

These are one-shot migration tools that have served their purpose. If you ever
need a similar script (e.g., for a future migration), writing one from scratch
is faster than adapting the old one to a changed schema.

```bash
rm -rf scripts/
```

Also remove the npm scripts from `package.json`:

```diff
- "backfill":  "tsx scripts/backfill.ts",
- "reconcile": "tsx scripts/reconcile.ts"
```

And remove `tsx` from devDependencies if nothing else uses it.

---

## 4. Supabase Migrations

**Merge the three migration files into one for clarity, but keep the folder.**

The `supabase/migrations/` directory is the canonical schema definition. Anyone
who wants to set up a fresh Supabase instance (new developer, staging environment,
CI test database) should be able to run these migrations and get a working schema.

### Approach

Create a single consolidated migration:

```bash
# 1. Combine into one
cat supabase/migrations/0001_initial.sql \
    supabase/migrations/0002_credit_procedures.sql \
    supabase/migrations/0003_additional_tables.sql \
  > supabase/migrations/0001_complete_schema.sql

# 2. Remove the old files
rm supabase/migrations/0001_initial.sql
rm supabase/migrations/0002_credit_procedures.sql
rm supabase/migrations/0003_additional_tables.sql
```

Edit the combined file to also apply the cleanup from §6 (removing the `source`
column, etc.).

**Keep `supabase/README.md`** — update it to reflect the current state.

Future schema changes get their own numbered migration files:
`0002_add_session_recordings.sql`, etc. Never edit an applied migration; only
add new ones.

---

## 5. Database Cleanup — Remove Migration Columns

### Columns to remove

Two columns were added for the dual-write tracking:

```sql
-- These exist only to distinguish Redis-backfilled data from Supabase-native data
ALTER TABLE credit_packs DROP COLUMN IF EXISTS source;
ALTER TABLE bookings     DROP COLUMN IF EXISTS source;
```

Create a new migration file for this:

```sql
-- supabase/migrations/0002_remove_migration_columns.sql
--
-- Cleanup: remove dual-write tracking columns added during Redis→Supabase
-- migration. All data is now Supabase-native.

ALTER TABLE credit_packs DROP COLUMN IF EXISTS source;
ALTER TABLE bookings     DROP COLUMN IF EXISTS source;
```

Apply it:

```bash
supabase db push
```

### Also check for

- Any `DEFAULT 'supabase'` clauses that reference the old column
- Any Supabase repository code that writes to `source` — remove those writes
- Any admin dashboard queries that filter by `source` — remove those filters

---

## Execution Order

Do the cleanup as a single focused session:

1. **Remove dual-write** — delete the directory, update services/index.ts, update
   startup-checks.ts, remove ENABLE_DUAL_WRITE env var
2. **Remove Redis persistent-data repos** — delete the 5 repository files + tests
3. **Clean up Redis index.ts** — export only what remains (client, slot-lock)
4. **Database cleanup** — create migration 0002, apply it, update Supabase repo
   code to stop writing `source`
5. **Merge migrations** — combine 0001–0003 + 0002-cleanup into one file
6. **Archive refactor docs** — move to docs/archive/
7. **Delete scripts/** — remove backfill + reconcile + package.json scripts
8. **Run full test suite** — `npm run build && npm test && npm run test:e2e`

