-- REFACTOR-R4-P3-02: the admin students list, server-side. Replaces a users-first
-- `LIMIT 100` (the deleted src/app/[locale]/admin/_data.ts) that hid every student past
-- #100 by email once course sign-ins grew the table, and searched in the browser over
-- those 100 only.
--
-- A STUDENT is a user with at least one booking or one credit pack. Course readers who
-- never booked or bought are left out of the list and of both counts; they stay reachable
-- at /admin/students/<email>. "Low credit" is <= 1 credit across non-expired packs, the
-- definition the dashboard card and the tab always used, now counted over students only.
--
-- Counts: total_count and low_credit_count cover every student matching p_query, BEFORE
-- the low-credit filter and the page window, so one call carries both tab counts whichever
-- tab is open. They come from a one-row CTE the page is LEFT JOINed onto: a page with no
-- rows (an empty tab, an offset past the end, p_limit = 0) still returns ONE row, with the
-- student columns NULL and the counts filled in. Callers drop the rows whose email is NULL.
--
-- p_query is bound as a parameter, never interpolated. ILIKE wildcards in it (`%`, `_`)
-- only broaden the admin's own search.
--
-- Performance: the correlated subqueries run per student (idx_credit_packs_user,
-- idx_bookings_user from 0001). Fine at hundreds of students; revisit if that changes.

CREATE OR REPLACE FUNCTION admin_list_students(
  p_query      TEXT    DEFAULT NULL,
  p_low_credit BOOLEAN DEFAULT FALSE,
  p_limit      INT     DEFAULT 50,
  p_offset     INT     DEFAULT 0
) RETURNS TABLE (
  email            TEXT,
  name             TEXT,
  total_credits    INT,
  earliest_expiry  TIMESTAMPTZ,
  next_session     TIMESTAMPTZ,
  total_count      BIGINT,
  low_credit_count BIGINT
) AS $$
  WITH students AS (
    SELECT u.id, u.email, u.name
    FROM users u
    WHERE (EXISTS (SELECT 1 FROM bookings b     WHERE b.user_id = u.id)
        OR EXISTS (SELECT 1 FROM credit_packs c WHERE c.user_id = u.id))
      AND (COALESCE(p_query, '') = ''
        OR u.email ILIKE '%' || p_query || '%'
        OR u.name  ILIKE '%' || p_query || '%')
  ), enriched AS (
    -- users.name is NOT NULL DEFAULT '', so an unnamed user falls back on NULLIF.
    SELECT s.email,
           COALESCE(NULLIF(s.name, ''), s.email) AS name,
           COALESCE((SELECT SUM(c.credits_remaining) FROM credit_packs c
                     WHERE c.user_id = s.id AND c.expires_at > now()), 0)::INT AS total_credits,
           (SELECT MIN(c.expires_at) FROM credit_packs c
             WHERE c.user_id = s.id AND c.expires_at > now() AND c.credits_remaining > 0) AS earliest_expiry,
           (SELECT MIN(b.starts_at) FROM bookings b
             WHERE b.user_id = s.id AND b.status = 'confirmed' AND b.starts_at > now()) AS next_session
    FROM students s
  ), counts AS (
    SELECT COUNT(*)                                      AS total_count,
           COUNT(*) FILTER (WHERE e.total_credits <= 1) AS low_credit_count
    FROM enriched e
  ), page AS (
    SELECT e.*
    FROM enriched e
    WHERE NOT p_low_credit OR e.total_credits <= 1
    ORDER BY e.email
    LIMIT p_limit OFFSET p_offset
  )
  SELECT p.email, p.name, p.total_credits, p.earliest_expiry, p.next_session,
         c.total_count, c.low_credit_count
  FROM counts c
  LEFT JOIN page p ON TRUE
  ORDER BY p.email;
$$ LANGUAGE sql STABLE;

-- 0018 pattern: the function returns every student's email, so only the service-role
-- client (src/infrastructure/supabase/client.ts) may call it.
REVOKE ALL ON FUNCTION admin_list_students(TEXT, BOOLEAN, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_students(TEXT, BOOLEAN, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_students(TEXT, BOOLEAN, INT, INT) TO service_role;
