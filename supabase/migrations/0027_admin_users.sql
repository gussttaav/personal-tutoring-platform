-- ADMIN-USERS-01: the admin «Usuarios» list and the per-course reader views.
--
-- Replaces admin_list_students (0024). That list held STUDENTS only (a booking or a credit
-- pack), from the days when signing in meant booking a class. An account now also exists to
-- keep course progress or to receive blog / course emails, in any mix, so the list holds
-- EVERY user except the admin's own account (users.role = 'admin'), and a tab picks the
-- relationship:
--
--   all         everyone                                     newest account first
--   credits     credits not yet booked: unexpired packs with credit expiring soonest first
--               credits_remaining > 0. A credit is spent when
--               a class is BOOKED, so what is left is classes
--               still to book.
--   upcoming    a confirmed booking that has not started     next class soonest first
--   booked      at least one booking that was not cancelled, most recently booked first
--               the free 15-min call included (Gustavo,
--               2026-10-23)
--   courses     enrolled in at least one course              latest course activity first
--   subscribed  a blog or courses opt-in                     latest opt-in first
--
-- An unknown p_segment reads as 'all'. The low-credit tab and count (<= 1 credit across
-- students, which caught everyone who never bought a pack) are gone.
--
-- Counts: one call carries every tab count, over the users matching p_query, taken BEFORE
-- the segment filter and the page window. Same shape as 0024: the page is LEFT JOINed onto
-- a one-row counts CTE, so a page with no rows (an empty tab, an offset past the end,
-- p_limit = 0) still returns ONE row, user columns NULL and counts filled in. Callers drop
-- the rows whose email is NULL.
--
-- Course progress: the database does not know how many lessons a course has. That lives in
-- the content registry (COURSE-P4-01: no courses or lessons tables), so the caller passes the
-- published lesson slugs, per course in p_course_lessons ({"dl-nlp": ["slug", …]}) and as
-- p_lessons for one course. Only completed lessons on that list count, which keeps the
-- figure equal to the one the reader sees (CourseService.summarise). Activity (sorting, the
-- 30-day "inactive" cut) counts any lesson view, published or not.
--
-- p_query is bound as a parameter, never interpolated. ILIKE wildcards in it (`%`, `_`)
-- only broaden the admin's own search.
--
-- Performance: correlated subqueries per user, on idx_credit_packs_user / idx_bookings_user
-- (0001), idx_subscriptions_user_id (0003) and the (user_id, …) UNIQUE indexes of enrollments
-- and lesson_progress (0016). The per-course JSON is built for the page rows only. Fine at
-- thousands of users; revisit if that changes.
--
-- Additive on purpose: admin_list_students (0024) stays, unused by this code, so applying
-- this migration before the deploy (the safe order) cannot break the admin page of the code
-- still running, here or on a preview that shares the database. Drop it in a later
-- migration once this has shipped everywhere.

CREATE OR REPLACE FUNCTION admin_list_users(
  p_query          TEXT  DEFAULT NULL,
  p_segment        TEXT  DEFAULT 'all',
  p_course_lessons JSONB DEFAULT '{}'::jsonb,
  p_limit          INT   DEFAULT 50,
  p_offset         INT   DEFAULT 0
) RETURNS TABLE (
  email            TEXT,
  name             TEXT,
  created_at       TIMESTAMPTZ,
  unbooked_credits INT,
  earliest_expiry  TIMESTAMPTZ,
  next_session     TIMESTAMPTZ,
  bookings_count   INT,
  courses          JSONB,
  subscriptions    JSONB,
  total_count      BIGINT,
  credits_count    BIGINT,
  upcoming_count   BIGINT,
  booked_count     BIGINT,
  courses_count    BIGINT,
  subscribed_count BIGINT
) AS $$
  WITH matched AS (
    SELECT u.id, u.email, u.name, u.created_at
    FROM users u
    WHERE u.role <> 'admin'
      AND (COALESCE(p_query, '') = ''
        OR u.email ILIKE '%' || p_query || '%'
        OR u.name  ILIKE '%' || p_query || '%')
  ), enriched AS (
    -- users.name is NOT NULL DEFAULT '', so an unnamed user falls back on NULLIF.
    SELECT m.id,
           m.email,
           COALESCE(NULLIF(m.name, ''), m.email) AS name,
           m.created_at,
           COALESCE((SELECT SUM(c.credits_remaining) FROM credit_packs c
                     WHERE c.user_id = m.id AND c.expires_at > now()), 0)::INT AS unbooked_credits,
           (SELECT MIN(c.expires_at) FROM credit_packs c
             WHERE c.user_id = m.id AND c.expires_at > now() AND c.credits_remaining > 0) AS earliest_expiry,
           (SELECT MIN(b.starts_at) FROM bookings b
             WHERE b.user_id = m.id AND b.status = 'confirmed' AND b.starts_at > now()) AS next_session,
           (SELECT COUNT(*) FROM bookings b
             WHERE b.user_id = m.id AND b.status <> 'cancelled')::INT AS bookings_count,
           (SELECT MAX(b.created_at) FROM bookings b
             WHERE b.user_id = m.id AND b.status <> 'cancelled') AS last_booked_at,
           -- NULL exactly when the user has no enrollment: MAX over no rows.
           (SELECT MAX(GREATEST(e.enrolled_at,
                     (SELECT MAX(lp.last_seen_at) FROM lesson_progress lp
                       WHERE lp.user_id = e.user_id AND lp.course_slug = e.course_slug)))
              FROM enrollments e WHERE e.user_id = m.id) AS last_course_activity,
           (SELECT MAX(s.created_at) FROM subscriptions s
             WHERE s.user_id = m.id) AS last_subscribed_at
    FROM matched m
  ), counts AS (
    SELECT COUNT(*)                                                      AS total_count,
           COUNT(*) FILTER (WHERE e.unbooked_credits > 0)                AS credits_count,
           COUNT(*) FILTER (WHERE e.next_session IS NOT NULL)            AS upcoming_count,
           COUNT(*) FILTER (WHERE e.bookings_count > 0)                  AS booked_count,
           COUNT(*) FILTER (WHERE e.last_course_activity IS NOT NULL)    AS courses_count,
           COUNT(*) FILTER (WHERE e.last_subscribed_at IS NOT NULL)      AS subscribed_count
    FROM enriched e
  ), page AS (
    -- Every segment but 'all' sorts on its own column first; for the others that CASE is
    -- NULL on every row, so the tie-breakers (newest account, then email) decide.
    SELECT e.*,
           ROW_NUMBER() OVER (ORDER BY
             CASE WHEN p_segment = 'credits'    THEN e.earliest_expiry      END ASC  NULLS LAST,
             CASE WHEN p_segment = 'upcoming'   THEN e.next_session         END ASC  NULLS LAST,
             CASE WHEN p_segment = 'booked'     THEN e.last_booked_at       END DESC NULLS LAST,
             CASE WHEN p_segment = 'courses'    THEN e.last_course_activity END DESC NULLS LAST,
             CASE WHEN p_segment = 'subscribed' THEN e.last_subscribed_at   END DESC NULLS LAST,
             e.created_at DESC,
             e.email
           ) AS pos
    FROM enriched e
    WHERE CASE p_segment
            WHEN 'credits'    THEN e.unbooked_credits > 0
            WHEN 'upcoming'   THEN e.next_session IS NOT NULL
            WHEN 'booked'     THEN e.bookings_count > 0
            WHEN 'courses'    THEN e.last_course_activity IS NOT NULL
            WHEN 'subscribed' THEN e.last_subscribed_at IS NOT NULL
            ELSE TRUE
          END
    ORDER BY pos
    LIMIT p_limit OFFSET p_offset
  )
  SELECT p.email,
         p.name,
         p.created_at,
         p.unbooked_credits,
         p.earliest_expiry,
         p.next_session,
         p.bookings_count,
         -- [{ "slug": "dl-nlp", "completed": 12 }, …], oldest enrollment first.
         CASE WHEN p.id IS NULL THEN NULL ELSE
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'slug',      en.course_slug,
                     'completed', (SELECT COUNT(*) FROM lesson_progress lp
                                    WHERE lp.user_id = en.user_id
                                      AND lp.course_slug = en.course_slug
                                      AND lp.status = 'completed'
                                      AND lp.lesson_slug IN (
                                        SELECT jsonb_array_elements_text(
                                          COALESCE(p_course_lessons -> en.course_slug, '[]'::jsonb))))
                   ) ORDER BY en.enrolled_at), '[]'::jsonb)
              FROM enrollments en WHERE en.user_id = p.id)
         END AS courses,
         -- [{ "type": "blog", "areas": ["ia"] | null }, …]
         CASE WHEN p.id IS NULL THEN NULL ELSE
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('type', s.type, 'areas', s.areas)
                   ORDER BY s.type), '[]'::jsonb)
              FROM subscriptions s WHERE s.user_id = p.id)
         END AS subscriptions,
         c.total_count,
         c.credits_count,
         c.upcoming_count,
         c.booked_count,
         c.courses_count,
         c.subscribed_count
  FROM counts c
  LEFT JOIN page p ON TRUE
  ORDER BY p.pos;
$$ LANGUAGE sql STABLE;

-- The readers of one course. Every enrolled user but the admin falls in exactly one status:
--
--   finished  every published lesson (p_lessons) completed. For a course still being
--             written this means "caught up", and the admin panel says so.
--   active    not finished, some activity (enrollment or a lesson view) since p_active_since
--   inactive  not finished, no activity since p_active_since
--
-- p_status 'all' (or anything else) lists all three. Counts and the average number of
-- completed published lessons cover every reader, before the status filter and the page
-- window, with the same one-row counts CTE as admin_list_users. p_limit = 0 gives the
-- counts alone (the /admin/courses overview).
CREATE OR REPLACE FUNCTION admin_list_course_users(
  p_course_slug  TEXT,
  p_lessons      TEXT[]      DEFAULT '{}',
  p_status       TEXT        DEFAULT 'all',
  p_active_since TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days',
  p_limit        INT         DEFAULT 50,
  p_offset       INT         DEFAULT 0
) RETURNS TABLE (
  email             TEXT,
  name              TEXT,
  enrolled_at       TIMESTAMPTZ,
  completed_lessons INT,
  last_lesson_slug  TEXT,
  last_activity_at  TIMESTAMPTZ,
  status            TEXT,
  total_count       BIGINT,
  active_count      BIGINT,
  finished_count    BIGINT,
  inactive_count    BIGINT,
  avg_completed     NUMERIC
) AS $$
  WITH enrolled AS (
    SELECT u.email,
           COALESCE(NULLIF(u.name, ''), u.email) AS name,
           e.enrolled_at,
           (SELECT COUNT(*) FROM lesson_progress lp
             WHERE lp.user_id = e.user_id AND lp.course_slug = e.course_slug
               AND lp.status = 'completed'
               AND lp.lesson_slug = ANY(COALESCE(p_lessons, '{}')))::INT AS completed_lessons,
           -- The most recently viewed PUBLISHED lesson: its title comes from the registry.
           (SELECT lp.lesson_slug FROM lesson_progress lp
             WHERE lp.user_id = e.user_id AND lp.course_slug = e.course_slug
               AND lp.lesson_slug = ANY(COALESCE(p_lessons, '{}'))
             ORDER BY lp.last_seen_at DESC
             LIMIT 1) AS last_lesson_slug,
           -- GREATEST ignores the NULL of a reader with no lesson view yet.
           GREATEST(e.enrolled_at,
             (SELECT MAX(lp.last_seen_at) FROM lesson_progress lp
               WHERE lp.user_id = e.user_id AND lp.course_slug = e.course_slug)) AS last_activity_at
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    WHERE e.course_slug = p_course_slug
      AND u.role <> 'admin'
  ), classified AS (
    SELECT en.*,
           CASE
             WHEN cardinality(COALESCE(p_lessons, '{}')) > 0
              AND en.completed_lessons >= cardinality(p_lessons) THEN 'finished'
             WHEN en.last_activity_at >= p_active_since          THEN 'active'
             ELSE 'inactive'
           END AS status
    FROM enrolled en
  ), counts AS (
    SELECT COUNT(*)                                       AS total_count,
           COUNT(*) FILTER (WHERE c.status = 'active')    AS active_count,
           COUNT(*) FILTER (WHERE c.status = 'finished')  AS finished_count,
           COUNT(*) FILTER (WHERE c.status = 'inactive')  AS inactive_count,
           COALESCE(AVG(c.completed_lessons), 0)          AS avg_completed
    FROM classified c
  ), page AS (
    SELECT c.*
    FROM classified c
    WHERE COALESCE(p_status, 'all') NOT IN ('active', 'finished', 'inactive')
       OR c.status = p_status
    ORDER BY c.last_activity_at DESC, c.email
    LIMIT p_limit OFFSET p_offset
  )
  SELECT p.email,
         p.name,
         p.enrolled_at,
         p.completed_lessons,
         p.last_lesson_slug,
         p.last_activity_at,
         p.status,
         k.total_count,
         k.active_count,
         k.finished_count,
         k.inactive_count,
         k.avg_completed
  FROM counts k
  LEFT JOIN page p ON TRUE
  ORDER BY p.last_activity_at DESC, p.email;
$$ LANGUAGE sql STABLE;

-- How far readers get, lesson by lesson: who opened each lesson (any progress row) and who
-- completed it. Rows for lessons no longer published come back too; the caller keeps only
-- the published spine, in reading order, from the registry. The admin is left out.
CREATE OR REPLACE FUNCTION admin_course_lesson_stats(
  p_course_slug TEXT
) RETURNS TABLE (
  lesson_slug     TEXT,
  started_count   BIGINT,
  completed_count BIGINT
) AS $$
  SELECT lp.lesson_slug,
         COUNT(*)                                        AS started_count,
         COUNT(*) FILTER (WHERE lp.status = 'completed') AS completed_count
  FROM lesson_progress lp
  JOIN users u ON u.id = lp.user_id
  WHERE lp.course_slug = p_course_slug
    AND u.role <> 'admin'
  GROUP BY lp.lesson_slug;
$$ LANGUAGE sql STABLE;

-- 0018 pattern: these return users' emails and reading activity, so only the service-role
-- client (src/infrastructure/supabase/client.ts) may call them.
REVOKE ALL ON FUNCTION admin_list_users(TEXT, TEXT, JSONB, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_users(TEXT, TEXT, JSONB, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, TEXT, JSONB, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION admin_list_course_users(TEXT, TEXT[], TEXT, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_course_users(TEXT, TEXT[], TEXT, TIMESTAMPTZ, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_course_users(TEXT, TEXT[], TEXT, TIMESTAMPTZ, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION admin_course_lesson_stats(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_course_lesson_stats(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_course_lesson_stats(TEXT) TO service_role;
