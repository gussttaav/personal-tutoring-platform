-- 0029_free_call_unique.sql
-- REFACTOR-R5-P1-03: at most one non-cancelled free15min booking per user — the DB
-- backstop behind BookingService's hasActiveFreeSession check (REFACTOR-R4-P1-01).
-- Predicate = hasActiveFreeSession's: confirmed, completed and no_show all count;
-- cancelling frees the allowance again (Gustavo, 2026-10-01).
--
-- Non-concurrent on purpose: CONCURRENTLY can't run inside the migration's transaction,
-- and the build's write lock on bookings lasts milliseconds at this table size.

DO $$
DECLARE v_dupes INT;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT user_id FROM bookings
    WHERE session_type = 'free15min' AND status <> 'cancelled'
    GROUP BY user_id HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION '0029: % user(s) hold more than one non-cancelled free15min booking; resolve them first (see docs/refactor/phase-1-correctness/03-free-call-unique-index.md)', v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX bookings_one_free_call_per_user
  ON bookings (user_id)
  WHERE session_type = 'free15min' AND status <> 'cancelled';
