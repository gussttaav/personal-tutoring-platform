-- BOOKING-PACKLINK-01: decrement_credit now also returns the id of the pack it
-- decremented from. BookingService writes it to bookings.credit_pack_id so a pack
-- booking is linked to the pack that paid for it — the join that surfaces packSize
-- (and, once payments are recorded, the per-class price) in /api/my-bookings and
-- /api/my-bookings/history. The id MUST come from this function's FOR UPDATE
-- selection: re-querying afterwards could pick a different pack.
--
-- Additive: the returned JSONB gains a `pack_id` field; existing `ok`, `remaining`
-- and `pack_size` are unchanged.

CREATE OR REPLACE FUNCTION decrement_credit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_pack_id   UUID;
  v_pack_size INT;
  v_total     INT;
BEGIN
  SELECT id, pack_size INTO v_pack_id, v_pack_size
  FROM credit_packs
  WHERE user_id          = p_user_id
    AND credits_remaining > 0
    AND expires_at        > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pack_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'remaining', 0, 'pack_size', NULL, 'pack_id', NULL);
  END IF;

  UPDATE credit_packs
  SET credits_remaining = credits_remaining - 1
  WHERE id = v_pack_id;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs
  WHERE user_id   = p_user_id
    AND expires_at > now();

  RETURN jsonb_build_object(
    'ok',        true,
    'remaining', v_total,
    'pack_size', v_pack_size,
    'pack_id',   v_pack_id  -- BOOKING-PACKLINK-01
  );
END;
$$ LANGUAGE plpgsql;
