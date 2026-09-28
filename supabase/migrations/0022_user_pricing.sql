-- PRICING-STUDENT-01: per-student price overrides.
--
-- The `pricing` table (0011) holds the PUBLIC price of each of the four priced
-- products. This table holds a private price for one student, so the tutor can
-- hand a specific person a different rate without touching the public prices.
--
-- Sparse by design: a row exists ONLY for an overridden product. A student with
-- a cheaper 10h pack but standard single classes has exactly one row here, and
-- everything else falls back to `pricing`. Clearing the field in the admin panel
-- DELETEs the row rather than writing a copy of the default -- so a later change
-- to the public price still reaches that student.
--
-- No expiry column: the override is active until an admin removes it. This is
-- deliberately unlike credit_packs.expires_at (write-once, frozen at purchase) --
-- a price is a standing arrangement, not a purchased artifact.
--
-- The merge lives in exactly one place, PricingService.resolve(), which both the
-- charge path (getAmount) and the display path (getPublicPricing) read through.

CREATE TABLE user_pricing (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_key  TEXT NOT NULL
                 CHECK (product_key IN ('session1h','session2h','pack5','pack10')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency     TEXT NOT NULL DEFAULT 'eur',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   TEXT,
  PRIMARY KEY (user_id, product_key)
);

-- No separate index on user_id: the composite PK already leads on it, so
-- "all overrides for this student" is an index scan on the PK.

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the table denies everything if the anon key is ever used.
-- Extra weight here: these rows reveal which students pay a non-public price.
ALTER TABLE user_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_user_pricing_select ON user_pricing FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_user_pricing_insert ON user_pricing FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_user_pricing_update ON user_pricing FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_user_pricing_delete ON user_pricing FOR DELETE TO anon USING (false);

-- ACCOUNT-DELETE-01 procedure, re-declared with user_pricing in the walk.
-- Body is 0021 verbatim plus step 8; the REVOKE/GRANT set from 0017 survives
-- CREATE OR REPLACE untouched. The walk now covers 16 user-linked tables.

CREATE OR REPLACE FUNCTION delete_user_account(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_counts  JSONB := '{}'::JSONB;
  v_n       INT;
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE email = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- 1. pending_terminations has NO foreign key at all -- it is keyed by
  --    bookings.calendar_event_id. It must be swept BEFORE the bookings rows that
  --    name those event ids disappear, or the daily /api/internal/session-cleanup
  --    cron is left chasing a booking that no longer exists.
  DELETE FROM pending_terminations
  WHERE event_id IN (
    SELECT calendar_event_id FROM bookings
    WHERE user_id = v_user_id AND calendar_event_id IS NOT NULL
  );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('pending_terminations', v_n);

  -- 2. zoom_sessions does not cascade from bookings. It does cascade to
  --    session_messages, so those go with it.
  DELETE FROM zoom_sessions
  WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = v_user_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('zoom_sessions', v_n);

  -- 3. reviews.user_id is ON DELETE RESTRICT (0004), so it cannot ride the
  --    booking_id CASCADE -- it has to go explicitly, and before users.
  DELETE FROM reviews WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('reviews', v_n);

  -- 4. bookings MUST precede credit_packs: bookings.credit_pack_id references
  --    credit_packs(id) with no cascade.
  DELETE FROM bookings WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('bookings', v_n);

  DELETE FROM credit_packs WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('credit_packs', v_n);

  -- 5. Remaining direct references. failed_bookings and subscriptions are
  --    explicit ON DELETE RESTRICT (0003); the rest are plain no-action.
  DELETE FROM payments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('payments', v_n);

  DELETE FROM audit_log WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('audit_log', v_n);

  DELETE FROM failed_bookings WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('failed_bookings', v_n);

  DELETE FROM subscriptions WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('subscriptions', v_n);

  DELETE FROM enrollments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('enrollments', v_n);

  DELETE FROM lesson_progress WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('lesson_progress', v_n);

  DELETE FROM quiz_attempts WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('quiz_attempts', v_n);

  -- 6. google_review_prompts would cascade from users; explicit for readability
  --    and so the returned counts are complete.
  DELETE FROM google_review_prompts WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('google_review_prompts', v_n);

  -- 7. CONTENT-FEEDBACK-01: both cascade from users; explicit for the same reason
  --    as step 6. Anonymous rows (user_id IS NULL) are untouched by design.
  DELETE FROM content_votes WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('content_votes', v_n);

  DELETE FROM content_reports WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('content_reports', v_n);

  -- 8. PRICING-STUDENT-01: cascades from users; explicit for the same reason as
  --    step 6, and so an admin can see in the returned counts whether the deleted
  --    student had been on a custom price.
  DELETE FROM user_pricing WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('user_pricing', v_n);

  DELETE FROM users WHERE id = v_user_id;

  RETURN jsonb_build_object('found', true) || v_counts;
END;
$$ LANGUAGE plpgsql;
