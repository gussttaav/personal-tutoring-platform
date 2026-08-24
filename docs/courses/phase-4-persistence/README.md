# Phase 4 — Persistence

Enrollment, lesson progress and quiz attempts in Supabase, following the existing layering:
route handler → `CourseService` → `ICourseRepository` → Supabase impl, with an in-memory fake
for tests.

**Independent of Phases 2–3.** Progress tracking neither needs nor is needed by widgets, so
this phase can land in parallel with interactivity work.

## Tasks

1. [01-schema-and-service.md](01-schema-and-service.md) — `COURSE-P4-01` (M) — migration `0016`, repository, service
2. [02-progress-api.md](02-progress-api.md) — `COURSE-P4-02` (M) — API routes + reader wiring
3. [03-mis-cursos-panel.md](03-mis-cursos-panel.md) — `COURSE-P4-03` (M) — `/area-personal` panel

**Landing order:** strictly sequential.

## Exit criteria

- [ ] Migration `0016` applied; deny-anon RLS on all three tables per the `0007` pattern
- [ ] `CourseService` tested against in-memory fakes; **zero infrastructure imports**
- [ ] Completing a lesson survives a refresh and a different device
- [ ] Signed-out reading still works — progress is silently not tracked, never a blocked page
- [ ] `/area-personal` shows enrolled courses with % complete and a resume link
- [ ] `pnpm test` + `pnpm build` green

## The design constraint that shapes this phase

**Content lives in git; only user state lives in Postgres.** `course_slug` and `lesson_slug` are
plain `TEXT`, not foreign keys — there is no `courses` table to reference. Everything in this
phase follows from that: progress percentages are computed by joining DB rows against the
build-time registry, not by a SQL aggregate over a lessons table.
