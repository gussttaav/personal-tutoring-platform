# P4-01 — Schema, repository and CourseService

**Tag:** `COURSE-P4-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Migration `0016_courses.sql` with three tables (`enrollments`, `lesson_progress`,
`quiz_attempts`), an `ICourseRepository` interface, its Supabase implementation, an in-memory
fake, and `CourseService`. Pure backend — no UI, no routes.

## Context

- Existing pattern to follow exactly: `ISubscriptionRepository` /
  `SupabaseSubscriptionRepository` / `SubscriptionService`, wired in `src/services/index.ts`.
- All DB access uses the **service-role key**, which bypasses RLS. RLS is still enabled with
  explicit deny-anon policies as defence in depth — see `supabase/migrations/0007_rls_deny_anon.sql`
  for the pattern and the reasoning comment.
- Last applied migration is `0015`. Never edit applied migrations.
- `users.id` is a UUID; the app resolves it from the session email via `IUserRepository`.
- Regenerate `src/infrastructure/supabase/types.ts` after applying the migration.

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0016_courses.sql` (new) | Three tables, indexes, RLS |
| `src/infrastructure/supabase/types.ts` | Regenerated |
| `src/domain/types.ts` | + `Enrollment`, `LessonProgress`, `LessonStatus`, `QuizAttempt`, `CourseProgressSummary` |
| `src/domain/repositories/ICourseRepository.ts` (new) | The interface |
| `src/infrastructure/supabase/SupabaseCourseRepository.ts` (new) | Implementation |
| `src/services/CourseService.ts` (new) | Business logic |
| `src/services/index.ts` | Wire it up |
| `src/__tests__/fixtures/InMemoryCourseRepository.ts` (new) | Test fake |
| `src/services/__tests__/CourseService.test.ts` (new) | Service tests |

## Schema

```sql
CREATE TABLE enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  course_slug  TEXT NOT NULL,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, course_slug)
);

CREATE TABLE lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  course_slug  TEXT NOT NULL,
  lesson_slug  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'started'
                 CHECK (status IN ('started','completed')),
  completed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_slug, lesson_slug)
);

CREATE TABLE quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  course_slug  TEXT NOT NULL,
  lesson_slug  TEXT NOT NULL,
  quiz_id      TEXT NOT NULL,
  correct      BOOLEAN NOT NULL,
  answer       JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Indexes: `(user_id, course_slug)` on both progress tables;
`(course_slug, lesson_slug)` on `lesson_progress` for future drop-off analytics.

RLS: enable on all three, with the four explicit deny-anon policies each, copying the
`0007` comment header so the reasoning travels with the code.

**No `courses` or `lessons` table.** Slugs are `TEXT`. Content lives in git.

**`quiz_attempts` is append-only** — every attempt is a row. That's what makes the future
"which question does everyone get wrong" question answerable, and it's small (a few hundred
bytes per attempt).

## Service API

```ts
enroll(email, courseSlug): Promise<void>                       // idempotent
markLessonSeen(email, courseSlug, lessonSlug): Promise<void>    // upsert, auto-enrolls
markLessonCompleted(email, courseSlug, lessonSlug): Promise<void>
recordQuizAttempt(email, courseSlug, lessonSlug, quizId, correct, answer): Promise<void>
getCourseProgress(email, courseSlug): Promise<CourseProgressSummary>
listEnrollments(email): Promise<CourseProgressSummary[]>
```

**`CourseProgressSummary` is computed against the registry**, not from SQL:

```ts
{
  courseSlug, totalLessons, completedLessons, percentComplete,
  lastSeenLessonSlug,      // drives "continuar donde lo dejaste"
  enrolledAt, completedAt
}
```

`totalLessons` comes from the build-time registry (published lessons only), `completedLessons`
from the DB. This is the direct consequence of the content/state split — and it means adding a
lesson correctly *lowers* everyone's percentage rather than corrupting a stale denominator.

**Auto-enroll on first lesson view.** No explicit "enroll" button; `markLessonSeen` creates the
enrollment if absent. Fewer steps between a visitor and the content.

**Ignore unknown slugs.** If `lesson_slug` isn't in the registry, drop the write and log —
don't throw. A stale bookmark to a renamed lesson must never 500.

## Acceptance criteria

- [ ] Migration applies cleanly; `supabase gen types` regenerated and committed
- [ ] RLS enabled with deny-anon policies on all three tables
- [ ] `CourseService` imports **zero** infrastructure modules (repository injected)
- [ ] `enroll` is idempotent — calling twice does not throw or duplicate
- [ ] `markLessonSeen` auto-enrolls
- [ ] `markLessonCompleted` is idempotent and sets `completed_at` once (a second call does not move the timestamp)
- [ ] `percentComplete` uses the registry as denominator; drafts excluded
- [ ] Completing the last published lesson sets `enrollments.completed_at`
- [ ] Unknown course/lesson slug → no write, no throw
- [ ] In-memory fake implements the full interface and is used by the service tests
- [ ] File-top comment blocks carry `COURSE-P4-01`
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Service unit** (`CourseService.test.ts`, in-memory repo): idempotent enroll; auto-enroll on
  seen; completion sets timestamp once; percentage with 0 / partial / all lessons complete;
  percentage ignores drafts; last published lesson completes the course; unknown slug is a no-op;
  `listEnrollments` for a user with none returns `[]`.
- **Repository** (`src/infrastructure/supabase/__tests__/`): mirror the pattern used by the
  existing repository tests — mapping between DB rows and domain types, particularly
  **TIMESTAMPTZ normalisation** (`new Date(dbTimestamp).toISOString()`) per the CLAUDE.md rule.
- **Integration** (`src/__tests__/integration/`): enroll → complete two lessons → summary reports
  the right percentage.

## Notes / gotchas

- **Normalise timestamps.** PostgREST returns `+00:00`, JS produces `Z`. Every timestamp crossing
  the repository boundary goes through `new Date(x).toISOString()`. This has bitten this codebase
  before.
- Use a real upsert (`ON CONFLICT`) for `lesson_progress`, not read-then-write — two tabs open on
  the same lesson is a completely ordinary situation.
- `markLessonCompleted` must not regress a completed lesson to `started` if `markLessonSeen`
  fires afterwards. Guard the status transition explicitly; this is the most likely real bug in
  the whole phase.
- Don't add a `lesson_notes` or bookmarks table "while you're there".
- Redis is not involved. Progress is persistent data — Supabase only.

## Out of scope

- Any route or UI (P4-02/03).
- Certificates, streaks, gamification.
- `/admin/cursos` analytics — the schema supports it; the UI is not in this plan.
