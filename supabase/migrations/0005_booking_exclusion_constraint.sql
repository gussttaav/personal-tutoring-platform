-- REFACTOR-P1-01: DB-level safeguard against overlapping confirmed bookings.
-- The application uses acquire_slot_lock for the happy path, but a bug in the
-- lock-acquire code path would silently re-introduce the original race.
-- This constraint rejects any insert/update that would create overlapping
-- confirmed bookings, at the cost of a slightly more expensive index.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');
