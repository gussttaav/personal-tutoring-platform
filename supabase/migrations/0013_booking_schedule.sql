-- Admin-editable booking schedule: single source of truth for working hours,
-- minimum advance notice, and timezone. Replaces the values previously hardcoded
-- in src/lib/booking-config.ts (DAY_SCHEDULES + SCHEDULE).
--
-- Model: one row per time block. A day_of_week with zero rows = non-working day.
-- This literal start/end model intentionally DROPS the legacy "-15 minute morning
-- buffer" quirk from CalendarClient (MORNING_END_MINUTES = morningEnd*60 - 15).
-- The previous morningEnd 13.75 (13:45) minus 15 == 13:30, so we seed 540..810
-- (09:00..13:30) literally and the generated slots are unchanged.

CREATE TABLE working_hours (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun..6=Sat
  start_minute INTEGER  NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute   INTEGER  NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (end_minute > start_minute)
);
CREATE INDEX working_hours_dow_idx ON working_hours (day_of_week);

CREATE TABLE booking_settings (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone         TEXT    NOT NULL DEFAULT 'Europe/Madrid',
  min_notice_hours INTEGER NOT NULL DEFAULT 5 CHECK (min_notice_hours >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT
);

-- Seed settings (singleton).
INSERT INTO booking_settings (id, timezone, min_notice_hours) VALUES (1, 'Europe/Madrid', 5);

-- Seed blocks (minutes since midnight). The legacy -15 buffer is folded into the
-- literal morning end (13:30 = 810).
--   Mon/Wed (1,3):        09:00-13:30 (540-810) + 15:30-17:30 (930-1050)
--   Tue/Thu/Fri (2,4,5):  09:00-13:30 (540-810) + 15:30-18:30 (930-1110)
--   Sat/Sun (6,0):        11:00-15:00 (660-900)
INSERT INTO working_hours (day_of_week, start_minute, end_minute) VALUES
  (1, 540, 810), (1, 930, 1050),
  (2, 540, 810), (2, 930, 1110),
  (3, 540, 810), (3, 930, 1050),
  (4, 540, 810), (4, 930, 1110),
  (5, 540, 810), (5, 930, 1110),
  (6, 660, 900),
  (0, 660, 900);

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the tables deny everything if the anon key is ever used.
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_working_hours_select ON working_hours FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_working_hours_insert ON working_hours FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_working_hours_update ON working_hours FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_working_hours_delete ON working_hours FOR DELETE TO anon USING (false);

ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_booking_settings_select ON booking_settings FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_booking_settings_insert ON booking_settings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_booking_settings_update ON booking_settings FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_booking_settings_delete ON booking_settings FOR DELETE TO anon USING (false);
