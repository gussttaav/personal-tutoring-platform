# Task 4.1 — Supabase Setup + Schema

**Fix ID:** `DB-01`
**Priority:** P3
**Est. effort:** 3 hours

## Problem

No persistent database exists. All business data (credits, bookings, payments, audit) lives in Upstash Redis with TTLs — which means:

- Booking history is lost when tokens expire (30 days)
- Audit log is capped at 100 entries per student
- Disputes older than a month are unrecoverable
- No queryable data for analytics or reporting

This task sets up Supabase and applies the schema from `docs/refactor/PLAN.md` §4. No code integration yet — that's Task 4.2. This is purely "the database exists and has the right tables."

## Scope

**External:**
- Create Supabase project (free tier is sufficient for starting)
- Configure connection credentials in Vercel env vars

**Create in repo:**
- `supabase/migrations/0001_initial.sql` — the full schema
- `supabase/README.md` — setup instructions
- `.env.local.example` — document the new env vars

**Do not touch:**
- Any application code — this task is schema-only
- Existing Redis data

## Approach

### Step 1 — Create the Supabase project

Go to supabase.com, create a new project in a region close to Vercel's deployment (e.g., Frankfurt if Vercel is in Western Europe). Save the credentials:

- Project URL → `SUPABASE_URL`
- Anon/public key → `SUPABASE_ANON_KEY`
- Service role key → `SUPABASE_SERVICE_ROLE_KEY` (**server-side only; never expose**)

Add all three to Vercel env vars for Preview and Production, and to `.env.local` for development.

### Step 2 — Write the initial migration

Copy the SQL from `docs/refactor/PLAN.md` §4 into `supabase/migrations/0001_initial.sql`. The schema creates:

- `users`
- `credit_packs`
- `bookings`
- `zoom_sessions`
- `payments`
- `audit_log`

With all foreign keys and indexes as specified.

### Step 3 — Additional schema concerns

Add these that were not in the PLAN for operational robustness:

```sql
-- Track data source during migration, drop after flip (Task 4.5)
ALTER TABLE credit_packs ADD COLUMN source TEXT NOT NULL DEFAULT 'supabase';
ALTER TABLE bookings     ADD COLUMN source TEXT NOT NULL DEFAULT 'supabase';
-- 'redis' for rows written from Redis → Supabase backfill,
-- 'supabase' for rows written directly. Dropped after Phase 4.

-- Updated-at triggers (Supabase convention)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER credit_packs_updated_at BEFORE UPDATE ON credit_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at     BEFORE UPDATE ON bookings     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Step 4 — Row Level Security (RLS)

Enable RLS on all tables. The service role key bypasses RLS, so server-side code works unchanged, but any future direct-from-browser access requires explicit policies:

```sql
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- No policies defined — server-side code uses the service role key,
-- which bypasses RLS. When adding client-side access (future), define
-- explicit policies here.
```

### Step 5 — Apply migration

Using the Supabase CLI locally:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Verify in the Supabase dashboard that all tables exist with the correct columns and indexes.

### Step 6 — Document

`supabase/README.md`:

```markdown
# Supabase

## Local development
1. Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are in `.env.local`
2. Run `supabase start` for a local instance (optional; the remote dev project works too)

## Migrations
New migrations go in `supabase/migrations/` with filename format `NNNN_description.sql`
Apply with `supabase db push`

## RLS
All tables have RLS enabled but no policies — server-side code uses the service role key.
When adding client-side access, define explicit policies per table.
```

## Acceptance Criteria

- [ ] Supabase project exists
- [ ] All six tables exist with correct columns, types, constraints
- [ ] All indexes exist
- [ ] Foreign keys enforced
- [ ] RLS enabled on all tables
- [ ] `updated_at` triggers installed on mutable tables
- [ ] `source` column added to `credit_packs` and `bookings`
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are in Vercel env (Preview + Production) and `.env.local`
- [ ] `.env.local.example` documents the new vars
- [ ] `supabase/migrations/0001_initial.sql` exists in the repo
- [ ] `supabase/README.md` documents setup
- [ ] Manual verification: Supabase dashboard shows all tables populated with the correct schema

## Reference

See `docs/refactor/PLAN.md` → section **4. Future Database Schema**.

## Testing

No application-code testing in this task. Verify by inspection:

```bash
supabase db remote commit  # generates a migration from remote state
diff supabase/migrations/0001_initial.sql supabase/.temp/schema.sql
```

The generated schema should match the committed migration.

## Out of Scope

- Writing TypeScript types for the schema (Task 4.2)
- Implementing repository adapters (Task 4.2)
- Any dual-write behavior (Task 4.3)
- Defining RLS policies for client-side access (future)

## Rollback

Zero production impact. If the schema needs revision, write a new migration file (`0002_fix_whatever.sql`) — never modify an applied migration. If the Supabase project is misconfigured, delete it and re-create; no app code depends on it yet.
