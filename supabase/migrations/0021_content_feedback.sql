-- CONTENT-FEEDBACK-01: reader feedback on course lessons and blog posts.
--
-- Two tables behind the footer row every lesson and post now carries
-- ("¿Te ha sido útil?" 👍 👎 · Compartir · Reportar un error):
--
--   content_votes    one row per (content, voter) — the LAST submission wins, so a
--                    👍→👎 switch or a follow-up comment updates the row instead of
--                    adding another. `comment` is the optional free text asked after 👎.
--   content_reports  append-only error reports with an open/resolved status, listed
--                    at /admin/feedback and mailed to NOTIFY_EMAIL on creation.
--
-- content_type + content_key identify the page: 'lesson' with "<courseSlug>/<lessonSlug>"
-- or 'post' with "<postSlug>". Keys are plain TEXT, not foreign keys — lessons and posts
-- live in git, not in a table (same rule as 0016_courses.sql). The service verifies the
-- key against the content registries before writing.
--
-- Anonymous participation is allowed (reading needs no account), so voter_key is either
-- "user:<users.id>" for a signed-in reader or "anon:<client uuid>" for a random id the
-- browser keeps in localStorage. No IP address is stored anywhere; abuse is bounded by
-- the per-IP rate limiter and by the fact that no counts are ever shown publicly.
--
-- user_id is nullable and ON DELETE CASCADE. The account-deletion procedure below is
-- ALSO extended with two explicit DELETEs — 0017 set the precedent with
-- google_review_prompts ("explicit … so the returned counts are complete").

CREATE TABLE content_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT        NOT NULL CHECK (content_type IN ('lesson', 'post')),
  content_key  TEXT        NOT NULL CHECK (char_length(content_key) <= 200),
  locale       TEXT        NOT NULL CHECK (locale IN ('es', 'en')),
  voter_key    TEXT        NOT NULL CHECK (char_length(voter_key) <= 100),
  user_id      UUID        REFERENCES users(id) ON DELETE CASCADE,
  vote         SMALLINT    NOT NULL CHECK (vote IN (1, -1)),
  comment      TEXT        CHECK (char_length(comment) <= 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_key, voter_key)
);

CREATE INDEX idx_content_votes_content ON content_votes (content_type, content_key);
CREATE INDEX idx_content_votes_user    ON content_votes (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE content_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   TEXT        NOT NULL CHECK (content_type IN ('lesson', 'post')),
  content_key    TEXT        NOT NULL CHECK (char_length(content_key) <= 200),
  locale         TEXT        NOT NULL CHECK (locale IN ('es', 'en')),
  -- Derived server-side from (content_type, content_key, locale); never client-sent.
  page_url       TEXT        NOT NULL,
  message        TEXT        NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  -- Session email when signed in; the optional address an anonymous reporter typed otherwise.
  reporter_email TEXT,
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  user_agent     TEXT        CHECK (char_length(user_agent) <= 512),
  status         TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX idx_content_reports_status_created ON content_reports (status, created_at DESC);
CREATE INDEX idx_content_reports_user           ON content_reports (user_id) WHERE user_id IS NOT NULL;

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the tables deny everything if the anon key is ever used.
ALTER TABLE content_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_content_votes_select ON content_votes FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_content_votes_insert ON content_votes FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_content_votes_update ON content_votes FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_content_votes_delete ON content_votes FOR DELETE TO anon USING (false);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_content_reports_select ON content_reports FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_content_reports_insert ON content_reports FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_content_reports_update ON content_reports FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_content_reports_delete ON content_reports FOR DELETE TO anon USING (false);

-- ACCOUNT-DELETE-01 procedure, re-declared with the two new tables in the walk.
-- Body is 0017 verbatim plus step 7; the REVOKE/GRANT set from 0017 survives
-- CREATE OR REPLACE untouched. The walk now covers 15 user-linked tables.

CREATE OR REPLACE FUNCTION delete_user_account(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_counts  JSONB := '{}'::JSONB;
  v_n       INT;
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE email = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- 1. pending_terminations has NO foreign key at all -- it is keyed by
  --    bookings.calendar_event_id. It must be swept BEFORE the bookings rows that
  --    name those event ids disappear, or the daily /api/internal/session-cleanup
  --    cron is left chasing a booking that no longer exists.
  DELETE FROM pending_terminations
  WHERE event_id IN (
    SELECT calendar_event_id FROM bookings
    WHERE user_id = v_user_id AND calendar_event_id IS NOT NULL
  );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('pending_terminations', v_n);

  -- 2. zoom_sessions does not cascade from bookings. It does cascade to
  --    session_messages, so those go with it.
  DELETE FROM zoom_sessions
  WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = v_user_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('zoom_sessions', v_n);

  -- 3. reviews.user_id is ON DELETE RESTRICT (0004), so it cannot ride the
  --    booking_id CASCADE -- it has to go explicitly, and before users.
  DELETE FROM reviews WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('reviews', v_n);

  -- 4. bookings MUST precede credit_packs: bookings.credit_pack_id references
  --    credit_packs(id) with no cascade.
  DELETE FROM bookings WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('bookings', v_n);

  DELETE FROM credit_packs WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('credit_packs', v_n);

  -- 5. Remaining direct references. failed_bookings and subscriptions are
  --    explicit ON DELETE RESTRICT (0003); the rest are plain no-action.
  DELETE FROM payments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('payments', v_n);

  DELETE FROM audit_log WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('audit_log', v_n);

  DELETE FROM failed_bookings WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('failed_bookings', v_n);

  DELETE FROM subscriptions WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('subscriptions', v_n);

  DELETE FROM enrollments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('enrollments', v_n);

  DELETE FROM lesson_progress WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('lesson_progress', v_n);

  DELETE FROM quiz_attempts WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('quiz_attempts', v_n);

  -- 6. google_review_prompts would cascade from users; explicit for readability
  --    and so the returned counts are complete.
  DELETE FROM google_review_prompts WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('google_review_prompts', v_n);

  -- 7. CONTENT-FEEDBACK-01: both cascade from users; explicit for the same reason
  --    as step 6. Anonymous rows (user_id IS NULL) are untouched by design.
  DELETE FROM content_votes WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('content_votes', v_n);

  DELETE FROM content_reports WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('content_reports', v_n);

  DELETE FROM users WHERE id = v_user_id;

  RETURN jsonb_build_object('found', true) || v_counts;
END;
$$ LANGUAGE plpgsql;
