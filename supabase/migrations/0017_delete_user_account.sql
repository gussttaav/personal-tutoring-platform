-- ACCOUNT-DELETE-01: irreversible account + data deletion for a signed-in user.
--
-- Why a stored procedure instead of application-side deletes: 11 of the 13
-- user-linked tables carry RESTRICT or plain (no-action) foreign keys to
-- users(id) -- only google_review_prompts and session_messages cascade -- so a
-- plain DELETE FROM users fails outright, and a sequential application-side walk
-- would leave the account half-erased if any step threw. Inside a function the
-- whole walk is one transaction: it either erases everything or nothing.
--
-- The order below is the FK-safe order and is load-bearing. See the comment on
-- each step for what forces its position.

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

  DELETE FROM users WHERE id = v_user_id;

  RETURN jsonb_build_object('found', true) || v_counts;
END;
$$ LANGUAGE plpgsql;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and PostgREST
-- exposes every function at /rest/v1/rpc/<name>. NEXT_PUBLIC_SUPABASE_ANON_KEY
-- ships to the browser (Realtime backs the payment-confirmation channel), so
-- without this revoke anyone holding that public key could delete any account by
-- email. RLS does not protect functions -- only the grant does.
REVOKE ALL ON FUNCTION delete_user_account(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_user_account(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_user_account(TEXT) TO service_role;

-- Schema drift cleanup: delete_user_by_email(p_email) exists in the live database
-- (it appears in the generated src/infrastructure/supabase/types.ts) but has no
-- migration and no caller anywhere in the repo -- an undocumented destructive
-- function still carrying the default PUBLIC execute grant. delete_user_account
-- above replaces it.
DROP FUNCTION IF EXISTS delete_user_by_email(TEXT);
