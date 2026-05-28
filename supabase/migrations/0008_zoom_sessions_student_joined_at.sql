-- Adds attendance tracking to zoom_sessions. The session-cleanup cron uses
-- this column to decide whether to mark a past booking as 'completed'
-- (student_joined_at IS NOT NULL) or 'no_show' (IS NULL).
--
-- Backfill is intentionally skipped: all historical rows remain NULL.
-- For in-flight bookings deployed before this migration, the next join from
-- the student will populate the column; if the student never joins, the row
-- is correctly classified as a no_show by the cron.

ALTER TABLE zoom_sessions
  ADD COLUMN student_joined_at TIMESTAMPTZ NULL;
