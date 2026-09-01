# P4-02 — Progress API + reader wiring

**Tag:** `COURSE-P4-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Thin route handlers over `CourseService`, plus the reader-side wiring: a "marcar como
completada" control, a progress indicator, and the callbacks from `Quiz` (P3-01) and
`CodeChallenge` (P3-02) persisting attempts.

**Reading never requires sign-in.** A signed-out visitor reads everything; progress is simply
not tracked. Gating the content behind auth would kill the SEO value and the funnel.

## Context

- Route handlers are thin dispatchers: parse → service → map errors (CLAUDE.md).
- CSRF: `isValidOrigin()` on every POST (`src/lib/csrf.ts`).
- Rate limiting: `src/lib/ratelimit.ts` — add a dedicated limiter, don't borrow another route's.
- Zod schemas in `src/lib/schemas.ts`, never inline.
- Auth: NextAuth v5, `session.user.email`.
- Lesson pages are **statically generated**. Progress is therefore client-fetched after
  hydration — it must never make the page dynamic.

## Files affected

| File | Change |
|------|--------|
| `src/app/api/courses/progress/route.ts` (new) | `POST` seen/completed; `GET` course summary |
| `src/app/api/courses/attempt/route.ts` (new) | `POST` quiz/challenge attempt |
| `src/lib/schemas.ts` | + `progressUpdateSchema`, `quizAttemptSchema` |
| `src/lib/ratelimit.ts` | + `courseProgressLimiter` |
| `src/hooks/useCourseProgress.ts` (new) | Client hook: fetch summary, optimistic complete |
| `src/features/courses/reader/LessonComplete.tsx` (new) | The mark-complete control |
| `src/features/courses/reader/LessonSidebar.tsx` | Completed markers |
| `src/features/courses/reader/MobileLessonBar.tsx` | Fill the progress slot left by P1-04 |
| `src/features/courses/quiz/Quiz.tsx` | Wire `onAnswered` → API |
| `src/features/courses/code/CodeChallenge.tsx` | Wire `onAnswered` → API |
| `messages/es.json` + `messages/en.json` | + `courses.progress.*` (**both files**) |

## The change

**Routes** — three, all thin:

| Route | Behaviour |
|---|---|
| `POST /api/courses/progress` | `{ courseSlug, lessonSlug, action: "seen" \| "completed" }` |
| `GET /api/courses/progress?courseSlug=` | `CourseProgressSummary` |
| `POST /api/courses/attempt` | `{ courseSlug, lessonSlug, quizId, correct, answer }` |

All require a session. **A signed-out request returns `204`, not `401`** — the client is
reporting progress, not requesting a resource, and a 401 in the console on every lesson view for
anonymous readers is noise that will train everyone to ignore the console.

**`markLessonSeen` fires once per lesson mount**, debounced. Not on scroll, not on an interval.
One write per lesson view is plenty to power "continuar donde lo dejaste", and anything more
turns a static page into a chatty one.

**Mark complete is explicit.** A button, not a scroll-depth heuristic. Students working through
a rigorous course often re-read; auto-completing on scroll would be both wrong and patronising.
Optimistic UI, reconciled on failure.

**Progress display:** completed ticks in the sidebar, an `x / n` + bar in the mobile bar and the
course landing hero (the slot P1-03 left), and "continuar donde lo dejaste" on the landing page
pointing at `lastSeenLessonSlug`.

**Failure is silent.** If the progress POST fails, log it and move on — never block reading,
never show an error toast. Progress is a convenience; the lesson is the product.

## Acceptance criteria

- [ ] Signed-out: lesson reads normally, no error UI, POSTs return `204`
- [ ] Signed-in: viewing a lesson auto-enrolls and records `seen` exactly once per mount
- [ ] Mark-complete persists across refresh and across devices
- [ ] Sidebar shows completed lessons; progress bar reflects the registry denominator
- [ ] Quiz and challenge attempts land in `quiz_attempts`, one row per attempt
- [ ] `isValidOrigin()` enforced on all three POST paths
- [ ] Rate limiter returns 429 under burst; limits are generous enough not to hit a normal reader (a student answering a 5-question quiz twice must never be limited)
- [ ] Lesson pages remain **statically generated** — verify the build output still marks them static
- [ ] Progress fetch failure degrades silently; the lesson stays readable
- [ ] Zod schemas in `src/lib/schemas.ts`, not inline
- [ ] All strings via `t()`, keys in **both** message files
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Route unit** (`src/app/api/courses/__tests__/`, following the `src/app/api/cancel/__tests__/`
  pattern): no session → 204, no service call; invalid body → 400; bad origin → 403; happy path
  calls the service with the parsed args; service throw → mapped via `http-errors`.
- **Hook unit:** optimistic update then rollback on failure; `seen` fires once per mount, not per render.
- **Integration:** POST completed → GET summary reflects it.
- **E2E** (`e2e/`): sign in, open a lesson, mark complete, reload, still complete. Note the known
  flakiness of the suite — re-run once before treating a failure as a regression.
- **Manual:** signed-out reading with the console open — **zero** errors.

## Notes / gotchas

- **Do not make the lesson page dynamic.** Progress is client-fetched post-hydration. If someone
  reaches for `cookies()` or `auth()` in the lesson server component, every lesson becomes a
  function invocation on every view — the exact cost this plan is built to avoid. Assert
  staticness in the acceptance check.
- Debounce `seen` so React Strict Mode's double-mount in dev doesn't double-write.
- The optimistic tick must reconcile if the write fails, or the sidebar lies after a refresh.
- Rate limits here are about abuse, not about normal use. Set them loosely and revisit only if a
  real problem appears.
- Don't persist student-edited code — it's a bigger design question (storage, size limits,
  restore semantics) and is not in this plan.

## Out of scope

- `/area-personal` panel (P4-03).
- Server-side re-grading of attempts.
- Admin analytics over `quiz_attempts`.
- Email reminders / drip campaigns.
