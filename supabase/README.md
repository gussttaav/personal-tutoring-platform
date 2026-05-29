# Supabase

## Local development
1. Ensure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are in `.env.local`
2. Run `supabase start` for a local instance (optional; the remote dev project works too)

## Migrations
- `0001_complete_schema.sql` — consolidated full schema (tables, procedures, indexes, RLS)
- Future changes go in new numbered files: `0002_description.sql`, etc.
- **Never edit `0001_complete_schema.sql`** — it exists for fresh-instance setup only.
- Apply new migrations with `supabase db push`
- After schema changes, regenerate types:
  `supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts`

## Row-Level Security strategy

**All backend access uses the service-role key**, which bypasses RLS entirely.
Code outside of `src/infrastructure/supabase/` should never directly access the
database. Routes call services; services call repositories; repositories call
the service-role-key client.

RLS is enabled with **explicit deny-anon policies** on every table (see
migration `0007_rls_deny_anon.sql`). This is defense-in-depth: if the anon
key is ever introduced (Realtime, Supabase Auth, a client-side query), the
default behavior is denial, not exposure.

**To grant anon access to a specific table:**

1. Drop the relevant `deny_anon_<table>_<op>` policy
2. Add a restrictive policy: `CREATE POLICY ... USING (auth.uid() = user_id)`
3. Add a code-review note explaining why

**Never add `CREATE POLICY ... USING (true)` without a CHECK constraint.**