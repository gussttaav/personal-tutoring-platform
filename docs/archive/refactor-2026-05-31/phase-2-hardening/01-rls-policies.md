# Task P2-01 — Define explicit RLS policies (deny-anon)

**Severity:** 🟡 Medium
**Effort:** 1 hour
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

Every table has `ENABLE ROW LEVEL SECURITY` but **zero policies are defined**. The current architecture is safe because all DB access goes through the service-role key (which bypasses RLS). The day someone adds the anon key to a client component, every table becomes wide-open.

This task adds explicit deny-anon policies so the intent is in the schema and the trap is defused.

## Context

### The current state

```sql
-- supabase/migrations/0001_complete_schema.sql:15131
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
-- ... and others added later
```

The comment in the original migration says:

> No policies defined — server-side code uses the service role key, which bypasses RLS. When adding client-side access (future), define explicit policies here.

This is fine **as a comment**. It is **not fine as security policy**.

### The risk

Any of these would break the implicit safety:

- A junior dev imports the Supabase JS client into a client component using `NEXT_PUBLIC_SUPABASE_ANON_KEY` for "just a quick lookup"
- Supabase Realtime added in Phase 3 (Task 01) uses the anon key by default
- A future migration to Supabase Auth integrates with the JWT and uses anon-key flow

In any of these cases, RLS is now enforced **and there are zero policies, so everything is denied** — *that's actually safe* — but the moment someone adds a generous policy because "RLS is denying my queries", the whole table becomes accessible.

This task makes that footgun visible by **explicitly denying anon** so the intent is in source.

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0007_rls_deny_anon.sql` | **NEW** — one DENY policy per table |
| `supabase/README.md` | Add a section explaining the RLS strategy |

## The change

### 1. New migration: `supabase/migrations/0007_rls_deny_anon.sql`

```sql
-- REFACTOR-P2-01: Explicit deny-anon RLS policies.
--
-- Context: this codebase uses the SERVICE ROLE key for all DB access from the
-- backend, which bypasses RLS entirely. The anon key is never used. RLS is
-- still ENABLED on every table as a defense-in-depth: if anyone ever adds the
-- anon key to a client component, accidentally exposes a table via Realtime,
-- or integrates Supabase Auth, every table would suddenly be RLS-evaluated
-- with no policies — which denies everything (safe).
--
-- The risk we're defending against is the NEXT step: someone running into
-- "RLS is denying my queries", adding a permissive policy without realizing
-- it opens the table to anon. By writing explicit DENY policies here, anyone
-- adding a permissive policy later sees both — and the conflict (or the
-- realization that they should add a USING (auth.uid() = user_id) policy
-- instead) becomes obvious in code review.
--
-- If you genuinely need anon access to a table, DROP this policy AND add a
-- restrictive policy in its place. Do not just DROP.

-- ── helper macro --------------------------------------------------------------
-- We can't use a true Postgres MACRO, so the pattern is repeated per-table.
-- ──────────────────────────────────────────────────────────────────────────────

-- users
CREATE POLICY deny_anon_users_select   ON users FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_users_insert   ON users FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_users_update   ON users FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_users_delete   ON users FOR DELETE TO anon USING (false);

-- credit_packs
CREATE POLICY deny_anon_credit_packs_select   ON credit_packs FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_credit_packs_insert   ON credit_packs FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_credit_packs_update   ON credit_packs FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_credit_packs_delete   ON credit_packs FOR DELETE TO anon USING (false);

-- bookings
CREATE POLICY deny_anon_bookings_select   ON bookings FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_bookings_insert   ON bookings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_bookings_update   ON bookings FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_bookings_delete   ON bookings FOR DELETE TO anon USING (false);

-- zoom_sessions
CREATE POLICY deny_anon_zoom_sessions_select   ON zoom_sessions FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_zoom_sessions_insert   ON zoom_sessions FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_zoom_sessions_update   ON zoom_sessions FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_zoom_sessions_delete   ON zoom_sessions FOR DELETE TO anon USING (false);

-- payments
CREATE POLICY deny_anon_payments_select   ON payments FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_payments_insert   ON payments FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_payments_update   ON payments FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_payments_delete   ON payments FOR DELETE TO anon USING (false);

-- audit_log
CREATE POLICY deny_anon_audit_log_select   ON audit_log FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_audit_log_insert   ON audit_log FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_audit_log_update   ON audit_log FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_audit_log_delete   ON audit_log FOR DELETE TO anon USING (false);

-- session_messages
CREATE POLICY deny_anon_session_messages_select   ON session_messages FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_session_messages_insert   ON session_messages FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_session_messages_update   ON session_messages FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_session_messages_delete   ON session_messages FOR DELETE TO anon USING (false);

-- slot_locks
CREATE POLICY deny_anon_slot_locks_select   ON slot_locks FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_slot_locks_insert   ON slot_locks FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_slot_locks_update   ON slot_locks FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_slot_locks_delete   ON slot_locks FOR DELETE TO anon USING (false);

-- webhook_events
CREATE POLICY deny_anon_webhook_events_select   ON webhook_events FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_webhook_events_insert   ON webhook_events FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_webhook_events_update   ON webhook_events FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_webhook_events_delete   ON webhook_events FOR DELETE TO anon USING (false);

-- failed_bookings
CREATE POLICY deny_anon_failed_bookings_select   ON failed_bookings FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_failed_bookings_insert   ON failed_bookings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_failed_bookings_update   ON failed_bookings FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_failed_bookings_delete   ON failed_bookings FOR DELETE TO anon USING (false);

-- subscriptions
CREATE POLICY deny_anon_subscriptions_select   ON subscriptions FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_subscriptions_insert   ON subscriptions FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_subscriptions_update   ON subscriptions FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_subscriptions_delete   ON subscriptions FOR DELETE TO anon USING (false);

-- reviews
CREATE POLICY deny_anon_reviews_select   ON reviews FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_reviews_insert   ON reviews FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_reviews_update   ON reviews FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_reviews_delete   ON reviews FOR DELETE TO anon USING (false);

-- google_review_prompts
CREATE POLICY deny_anon_google_review_prompts_select   ON google_review_prompts FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_google_review_prompts_insert   ON google_review_prompts FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_google_review_prompts_update   ON google_review_prompts FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_google_review_prompts_delete   ON google_review_prompts FOR DELETE TO anon USING (false);

-- pending_terminations (added in REFACTOR-P1-04)
CREATE POLICY deny_anon_pending_terminations_select   ON pending_terminations FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_pending_terminations_insert   ON pending_terminations FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_pending_terminations_update   ON pending_terminations FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_pending_terminations_delete   ON pending_terminations FOR DELETE TO anon USING (false);
```

If P1-04 hasn't merged yet, omit the `pending_terminations` block — it will fail because the table doesn't exist.

### 2. `supabase/README.md` — add a section

```markdown
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
```

## Acceptance criteria

- [ ] Migration applied; `\dp` in psql shows policies on every table
- [ ] Anon REST query against any table returns empty/401:
  ```bash
  curl -H "apikey: $SUPABASE_ANON_KEY" \
       -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
       "$SUPABASE_URL/rest/v1/users?select=email"
  # Expected: []
  ```
- [ ] Service-role queries still work (verify by running the test suite — it uses service role)
- [ ] `supabase/README.md` includes the RLS strategy section

## Test plan

### Existing tests

All existing tests use the service role key, so they should all pass unchanged.

```bash
pnpm test
pnpm test:integration
```

### Manual verification

```bash
# Step 1: anon-key read on every table should return [] or 401
for table in users credit_packs bookings zoom_sessions payments audit_log \
             session_messages slot_locks webhook_events failed_bookings \
             subscriptions reviews google_review_prompts; do
  echo "=== $table ==="
  curl -s -H "apikey: $SUPABASE_ANON_KEY" \
       -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
       "$SUPABASE_URL/rest/v1/$table?select=*&limit=1"
  echo
done
# Every line should be: []
```

```bash
# Step 2: service-role key still works
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/users?select=email&limit=1"
# Expected: [{"email": "..."}]
```

## Notes / gotchas

- **Why `FOR ALL` is not used:** splitting into SELECT/INSERT/UPDATE/DELETE lets you grant fine-grained access later (e.g. "anon can SELECT public bookings but never INSERT") by dropping just one policy. Less surgery later.
- **`auth.uid()` requires Supabase Auth:** if/when you migrate to Supabase Auth, you can replace the `false` with `auth.uid() = user_id` for per-row access. Today, with NextAuth, you'd need to forward the user's id to Supabase via a custom JWT, which is more work than warranted.
- **`authenticated` role is also there:** Supabase has three default roles — `anon`, `authenticated`, `service_role`. We only deny `anon` here. If you ever start issuing Supabase JWTs (Supabase Auth or custom), `authenticated` would also need policies. Not now.
- **Cost:** zero. Empty policies (`USING (false)`) are evaluated in O(1).

## Out of scope

- Migrating to Supabase Auth — separate decision.
- Per-row RLS policies (e.g. "user X can read only their own bookings"). Backend service-role architecture makes these unnecessary.
- Auditing for any sneaky anon-key usage in client components — do a quick `grep -r NEXT_PUBLIC_SUPABASE` to verify, but if there are none today, the deny policies catch any future ones.
