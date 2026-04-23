# Supabase

## Local development
1. Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are in `.env.local`
2. Run `supabase start` for a local instance (optional; the remote dev project works too)

## Migrations
- `0001_complete_schema.sql` — consolidated full schema (tables, procedures, indexes, RLS)
- Future changes go in new numbered files: `0002_description.sql`, etc.
- **Never edit `0001_complete_schema.sql`** — it exists for fresh-instance setup only.
- Apply new migrations with `supabase db push`
- After schema changes, regenerate types:
  `supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts`

## RLS
All tables have RLS enabled but no policies — server-side code uses the service role key.
When adding client-side access, define explicit policies per table.