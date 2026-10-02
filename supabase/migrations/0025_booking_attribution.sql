-- BOOKING-ATTRIBUTION-01: where did the student who booked this class come from?
--
-- The browser keeps the FIRST attributed visit it saw (UTM tags, or else an external
-- referrer) and sends it with the booking; the mobile app sends nothing and is labelled
-- utm_source = 'mobile_app' server-side. All columns are nullable: rows booked before
-- this migration, and direct visits with no tags or referrer, simply have no source.
--
-- referrer_host is a hostname only (no path or query), landing_path a pathname only, so
-- nothing personal from the referring URL is kept. The CHECKs mirror the Zod limits in
-- src/lib/schemas.ts (AttributionSchema).

ALTER TABLE bookings
  ADD COLUMN utm_source    TEXT CHECK (char_length(utm_source)    <= 100),
  ADD COLUMN utm_medium    TEXT CHECK (char_length(utm_medium)    <= 100),
  ADD COLUMN utm_campaign  TEXT CHECK (char_length(utm_campaign)  <= 100),
  ADD COLUMN referrer_host TEXT CHECK (char_length(referrer_host) <= 200),
  ADD COLUMN landing_path  TEXT CHECK (char_length(landing_path)  <= 200);

-- "How many bookings did each source bring?" is the one query this exists for.
CREATE INDEX bookings_utm_source_idx ON bookings (utm_source) WHERE utm_source IS NOT NULL;
