-- REFACTOR-R4-P1-04: cancel + credit restore in ONE transaction, restoring to the pack
-- the class was paid from (bookings.credit_pack_id, BOOKING-PACKLINK-01) first.
--
-- Before this, BookingService flipped the booking to 'cancelled' (consumeCancelToken)
-- and then, as a SEPARATE write, called restore_credit(user_id) — which picks the
-- earliest-expiring pack with room, not the one the class was paid from, and returns
-- ok:false (silently treated as success) when none qualifies. A failed restore after
-- the flip returned 500 while the retry got CANCEL_TOKEN_CONSUMED: the credit was lost.
--
-- Decision (Gustavo, see docs/refactor/PLAN.md) — default implemented here:
--   1. originating pack, if still redeemable and not full
--   2. else the earliest-expiring active pack with room (the pre-0023 behaviour)
--   3. else nothing — and the result says so ('restored': false)
--
-- The originating pack can be expired at cancel time: decrement_credit only requires
-- expires_at > now() at BOOKING time, so a class booked on day 170 of a 180-day pack
-- for day 185 is valid, and cancelling it on day 182 finds its pack expired.
--
-- cancel_booking trusts the token it is given. The HMAC check stays in the app
-- (SupabaseBookingRepository.findByCancelToken), which BookingService runs first.
--
-- restore_credit(UUID) stays: its only remaining caller is the booking saga's
-- compensation for a pack decrement that returned no pack id.

CREATE OR REPLACE FUNCTION restore_credit_to_pack(p_pack_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE credit_packs
  SET credits_remaining = credits_remaining + 1
  WHERE id = p_pack_id
    AND credits_remaining < pack_size
    AND expires_at > now();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

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

-- SEC-RPC-01 convention (0018): no PUBLIC / anon / authenticated EXECUTE.
REVOKE ALL ON FUNCTION restore_credit_to_pack(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION restore_credit_to_pack(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_credit_to_pack(UUID) TO service_role;

REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking(TEXT) TO service_role;
