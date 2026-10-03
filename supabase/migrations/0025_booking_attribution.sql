-- BOOKING-ATTRIBUTION-01: where did each student come from, and what did they book first?
--
-- Recorded ONCE per student, on the users row, at their first booking — the only one that
-- answers "which channel brought this student in?". Later bookings never touch it.
--
--   first_booking_type  free15min | session1h | session2h | pack
--   first_booked_at     when that first booking was made
--   utm_source          from the browser's first-touch tags; 'mobile_app' for the app
--   utm_medium / utm_campaign
--   referrer_host       hostname of the external site they came from (no path / query)
--   landing_path        pathname of the first page they landed on
--
-- The browser keeps the FIRST attributed visit (UTM tags, or else an external referrer)
-- and sends it with the booking. All columns are nullable: users who never booked, and
-- direct visits with no tags or referrer, simply have none. The CHECKs mirror the Zod
-- limits in src/lib/schemas.ts (AttributionSchema).

ALTER TABLE users
  ADD COLUMN first_booking_type TEXT CHECK (first_booking_type IN ('free15min', 'session1h', 'session2h', 'pack')),
  ADD COLUMN first_booked_at    TIMESTAMPTZ,
  ADD COLUMN utm_source         TEXT CHECK (char_length(utm_source)    <= 100),
  ADD COLUMN utm_medium         TEXT CHECK (char_length(utm_medium)    <= 100),
  ADD COLUMN utm_campaign       TEXT CHECK (char_length(utm_campaign)  <= 100),
  ADD COLUMN referrer_host      TEXT CHECK (char_length(referrer_host) <= 200),
  ADD COLUMN landing_path       TEXT CHECK (char_length(landing_path)  <= 200);

-- Backfill: students who booked before this migration get their real first booking
-- (source unknown, left NULL). Without it their NEXT booking would be recorded as
-- their first, with a source that did not bring them in.
UPDATE users u
SET    first_booking_type = b.session_type,
       first_booked_at    = b.created_at
FROM  (
  SELECT DISTINCT ON (user_id) user_id, session_type, created_at
  FROM   bookings
  ORDER  BY user_id, created_at
) b
WHERE  b.user_id = u.id
  AND  u.first_booked_at IS NULL;

-- "How many students did each source bring?" is the one query this exists for.
CREATE INDEX users_utm_source_idx ON users (utm_source) WHERE utm_source IS NOT NULL;
