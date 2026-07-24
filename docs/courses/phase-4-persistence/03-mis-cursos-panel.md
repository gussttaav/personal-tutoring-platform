# P4-03 — "Mis cursos" panel in /area-personal

**Tag:** `COURSE-P4-03` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Surface enrolled courses in the existing personal area: progress bar, lessons completed, and a
"continuar" link straight to `lastSeenLessonSlug`. Small task, but it is what makes the course
feel like part of the product rather than a blog section.

## Context

- `/area-personal` already exists (`src/features/personal-area/PersonalArea.tsx`) with
  `NextSessionCard`, `PackStatusCard`, `BookSessionsPanel`, `PersonalAreaCalendar`.
- It is **customer-facing**, therefore bilingual (unlike `/admin`).
- `listEnrollments(email)` from P4-01 already returns exactly what this needs.

## Files affected

| File | Change |
|------|--------|
| `src/features/personal-area/MyCoursesPanel.tsx` (new) | The panel |
| `src/features/personal-area/CourseProgressCard.tsx` (new) | Per-course card |
| `src/features/personal-area/PersonalArea.tsx` | Mount the panel |
| `src/features/personal-area/types.ts` | + panel props |
| `src/app/api/courses/progress/route.ts` | `GET` without `courseSlug` → all enrollments |
| `messages/es.json` + `messages/en.json` | + `areaPersonal.courses.*` (**both files**) |

## The change

**Card contents:** course title, progress bar with `x / n lecciones`, "continuar" →
`lastSeenLessonSlug` (or lesson 1 if none), and a completed badge when `completedAt` is set.

**Empty state matters more than the populated one.** Most personal-area visitors are booking
students who have never opened a course. Show a short invitation with a link to `/cursos` — this
panel is a genuinely useful cross-sell surface between the two halves of the site, and the empty
state is what most people will see. Don't render an empty box.

**Placement.** Below the session-related cards. Booking is the primary business; courses are the
funnel into it. Existing users shouldn't find their session info displaced.

**Cross-sell the other direction too:** on a *completed* course card, link to booking a 1:1
session. Someone who finished a 40-hour deep learning course is the best-qualified lead the site
will ever produce.

## Acceptance criteria

- [ ] Panel lists enrolled courses with accurate progress
- [ ] "Continuar" lands on `lastSeenLessonSlug`; falls back to the first lesson when null
- [ ] Empty state renders an invitation to `/cursos`, never a blank box
- [ ] Completed course shows a badge and a book-a-session CTA
- [ ] Panel appears **below** the existing session cards
- [ ] Progress fetch failure hides the panel rather than breaking the page
- [ ] Responsive at 360 / 768 / 1440, consistent with the existing cards
- [ ] All strings via `t()`, keys in **both** message files
- [ ] `pnpm lint` + `pnpm build` green

## Test plan

- **Unit:** card renders 0%, partial, 100%; continue-link fallback when `lastSeenLessonSlug` is null.
- **Manual:** personal area with no enrollments, one in progress, one completed; three viewports;
  both locales (the English UI chrome must exist even though no English course does).
- **E2E:** extend the existing personal-area spec to assert the panel renders for a user with an
  enrollment.

## Notes / gotchas

- Fetch enrollments **alongside** the existing personal-area data, not in a waterfall after it —
  the page already has several requests and this one is cheap.
- The panel needs the course *title*, which lives in the registry, not the DB. Resolve titles
  server-side from the registry and merge with the DB summaries; don't denormalise titles into
  Postgres just to make this query self-contained.
- A stale enrollment for a course that no longer exists in the registry must be skipped silently.
- Don't add streaks, badges or "days since last lesson". Gamification is a product decision that
  isn't part of this plan, and guilt-tripping messaging actively drives people away.

## Out of scope

- Certificates / completion downloads.
- Notifications or reminder emails.
- Per-lesson detail views inside the personal area (the sidebar in the reader is that).
- Admin-side course analytics.
