-- SESSION-JOIN-01: classroom join window + tutor-absent alert.
--
-- On 2026-10-27 a student opened the classroom link right after booking, ~19 h
-- before the class. Nothing checked the time, so they entered, left, saw the
-- post-class review and rated it, which marked the booking 'completed' and hid
-- it from the admin agenda and the email link. The classroom now opens a
-- configurable number of minutes before the start (the tutor is exempt).
--
-- booking_settings (the schedule singleton, edited at /admin/schedule):
--   join_open_minutes_before   — how many minutes before a class's start the
--                                student may enter the classroom.
--   tutor_absent_alert_minutes — minutes after the start with the student in the
--                                room and no tutor before the admin is emailed.
-- The singleton row (id=1) already exists, so NOT NULL DEFAULT backfills it.
--
-- zoom_sessions:
--   tutor_joined_at          — first time the tutor was issued a join token for
--                              this session (mirrors student_joined_at, 0008).
--   tutor_absent_alerted_at  — set once when the alert email is claimed; the
--                              IS NULL guard makes the alert send at most once.

ALTER TABLE booking_settings
  ADD COLUMN join_open_minutes_before INTEGER NOT NULL DEFAULT 15
    CHECK (join_open_minutes_before BETWEEN 0 AND 1440),
  ADD COLUMN tutor_absent_alert_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (tutor_absent_alert_minutes BETWEEN 1 AND 120);

ALTER TABLE zoom_sessions
  ADD COLUMN tutor_joined_at         TIMESTAMPTZ NULL,
  ADD COLUMN tutor_absent_alerted_at TIMESTAMPTZ NULL;
