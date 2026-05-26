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
