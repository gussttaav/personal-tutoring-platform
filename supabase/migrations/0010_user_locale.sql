-- Adds an account-level locale preference to users, the source of truth for a
-- logged-in user's language across devices and for non-interactive (background)
-- emails that have no request cookie to read.
--
-- NULL = no known preference yet. The value is reconciled into the NEXT_LOCALE
-- cookie at login; page rendering and the Edge middleware keep reading the
-- cookie, so this column is never consulted on the render hot path. It is touched
-- only at three moments: explicit switch (logged in), login, and email send.
--
-- Backfill is intentionally skipped: existing rows stay NULL and are backfilled
-- to the user's effective locale on their next login.

ALTER TABLE users
  ADD COLUMN locale TEXT
  CHECK (locale IS NULL OR locale IN ('es', 'en'));
