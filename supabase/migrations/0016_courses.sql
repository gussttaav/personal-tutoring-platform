-- COURSE-P4-01: course progress persistence.
--
-- The content/state split (docs/courses/PLAN.md) is load-bearing here: prose,
-- lesson structure, quizzes and challenges live in git under content/courses/
-- and are read by the build-time registry (src/lib/courses/registry.ts). Postgres
-- holds ONLY user state. That is why `course_slug` / `lesson_slug` are plain TEXT
-- and NOT foreign keys — there is deliberately no `courses` or `lessons` table to
-- reference. Renaming or unpublishing a lesson is a content edit, never a migration.
--
-- The consequence for reads: the progress DENOMINATOR (how many lessons a course
-- has) comes from the registry, not from SQL. Adding a lesson correctly lowers
-- everyone's percentage instead of corrupting a stale stored total.
--
-- `quiz_attempts` is append-only: one row per attempt, never updated. That is what
-- makes "which question does everyone get wrong" answerable later, and it costs a
-- few hundred bytes per attempt.

CREATE TABLE enrollments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  course_slug  TEXT        NOT NULL,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, course_slug)
);

CREATE TABLE lesson_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  course_slug  TEXT        NOT NULL,
  lesson_slug  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'started'
                             CHECK (status IN ('started','completed')),
  completed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_slug, lesson_slug)
);

CREATE TABLE quiz_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  course_slug  TEXT        NOT NULL,
  lesson_slug  TEXT        NOT NULL,
  quiz_id      TEXT        NOT NULL,
  correct      BOOLEAN     NOT NULL,
  answer       JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read patterns:
--   "this user's progress in this course"  → enrollments UNIQUE (user_id, course_slug)
--                                            and lesson_progress UNIQUE (user_id, ...)
--   "who dropped off at which lesson"      → idx_lesson_progress_course_lesson
--   "this user's attempts in this course"  → idx_quiz_attempts_user_course
--
-- No separate (user_id, course_slug) index on lesson_progress: it is a strict prefix
-- of the UNIQUE (user_id, course_slug, lesson_slug) index Postgres already builds, so
-- the planner uses that one. Adding it would cost writes and buy nothing.
CREATE INDEX idx_lesson_progress_course_lesson ON lesson_progress (course_slug, lesson_slug);
CREATE INDEX idx_quiz_attempts_user_course     ON quiz_attempts   (user_id, course_slug);

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the tables deny everything if the anon key is ever used.
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_enrollments_select   ON enrollments FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_enrollments_insert   ON enrollments FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_enrollments_update   ON enrollments FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_enrollments_delete   ON enrollments FOR DELETE TO anon USING (false);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_lesson_progress_select   ON lesson_progress FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_lesson_progress_insert   ON lesson_progress FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_lesson_progress_update   ON lesson_progress FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_lesson_progress_delete   ON lesson_progress FOR DELETE TO anon USING (false);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_quiz_attempts_select   ON quiz_attempts FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_quiz_attempts_insert   ON quiz_attempts FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_quiz_attempts_update   ON quiz_attempts FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_quiz_attempts_delete   ON quiz_attempts FOR DELETE TO anon USING (false);
