-- Admin-editable cancellation window: how close to a class's start a student may
-- still cancel OR reschedule it. Previously hardcoded as CANCEL_WINDOW_MS (2 hours)
-- in src/services/BookingService.ts and imported by AccountService for the
-- deletion-eligibility gate.
--
-- Lives on booking_settings (the schedule singleton) alongside min_notice_hours,
-- and is distinct from it: min_notice_hours governs how far in advance a class may
-- be BOOKED; cancel_min_notice_hours governs how close to its start it may still be
-- CANCELLED. Stored in whole hours to match min_notice_hours; the service converts
-- to milliseconds at the comparison sites.
--
-- The singleton row (id=1) already exists, so NOT NULL DEFAULT 2 backfills it to
-- the previous hardcoded value with no data migration.

ALTER TABLE booking_settings
  ADD COLUMN cancel_min_notice_hours INTEGER NOT NULL DEFAULT 2 CHECK (cancel_min_notice_hours >= 0);
