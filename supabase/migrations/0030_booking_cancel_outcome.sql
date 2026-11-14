-- 0030_booking_cancel_outcome.sql
-- REFACTOR-R5-P2-02: record WHY a booking is cancelled, so the email and the history
-- stop guessing. credit_restored: pack rows only (true/false), NULL otherwise and for rows
-- cancelled before this migration. rescheduled: the original of a reschedule (set by
-- SupabaseBookingRepository.claimForReschedule, reset by reinstateBooking).
--
-- No backfill: legacy cancelled rows keep credit_restored NULL and rescheduled false, and
-- read exactly as before. cancel_booking below is 0023's body verbatim plus the one UPDATE
-- after the credit branch.

ALTER TABLE bookings ADD COLUMN credit_restored BOOLEAN;
ALTER TABLE bookings ADD COLUMN rescheduled     BOOLEAN NOT NULL DEFAULT false;

-- Returns {consumed:false} when no confirmed booking carries the token (already
-- cancelled, or a concurrent cancel won the row lock). Otherwise
-- {consumed:true, restored, restoredPackId, fromOriginating, credits}, where
-- `credits` is the user's total across active packs after the restore. Non-pack
-- bookings are cancelled with restored:false and no credit write.
CREATE OR REPLACE FUNCTION cancel_booking(p_cancel_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_id      UUID;
  v_user    UUID;
  v_type    TEXT;
  v_pack    UUID;
  v_target  UUID;
  v_total   INT;
BEGIN
  -- WHERE status = 'confirmed' + the row lock make this the compare-and-swap:
  -- a concurrent call blocks, re-evaluates, matches nothing and reports consumed:false.
  UPDATE bookings
  SET status = 'cancelled', cancel_token = NULL, join_token = NULL
  WHERE cancel_token = p_cancel_token AND status = 'confirmed'
  RETURNING id, user_id, session_type, credit_pack_id
  INTO v_id, v_user, v_type, v_pack;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false);
  END IF;

  IF v_type = 'pack' THEN
    IF v_pack IS NOT NULL AND restore_credit_to_pack(v_pack) THEN
      v_target := v_pack;
    ELSE
      SELECT id INTO v_target
      FROM credit_packs
      WHERE user_id = v_user AND credits_remaining < pack_size AND expires_at > now()
      ORDER BY expires_at ASC
      LIMIT 1
      FOR UPDATE;
      IF v_target IS NOT NULL THEN
        UPDATE credit_packs SET credits_remaining = credits_remaining + 1 WHERE id = v_target;
      END IF;
    END IF;
  END IF;

  -- REFACTOR-R5-P2-02: persist the outcome on the row (pack classes only).
  IF v_type = 'pack' THEN
    UPDATE bookings SET credit_restored = (v_target IS NOT NULL) WHERE id = v_id;
  END IF;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs WHERE user_id = v_user AND expires_at > now();

  RETURN jsonb_build_object(
    'consumed',        true,
    'restored',        v_target IS NOT NULL,
    'restoredPackId',  v_target,
    -- IS NOT DISTINCT FROM, not '=': a legacy booking has no credit_pack_id, and
    -- `v_target = NULL` would put a JSON null here instead of false.
    'fromOriginating', v_target IS NOT NULL AND v_target IS NOT DISTINCT FROM v_pack,
    'credits',         v_total
  );
END;
$$ LANGUAGE plpgsql;

-- SEC-RPC-01 convention (0018): no PUBLIC / anon / authenticated EXECUTE. CREATE OR REPLACE
-- keeps the grants, but they are repeated (the 0021/0022 precedent).
REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking(TEXT) TO service_role;
