# P4-04 — Attempt history: read it back

**Tag:** `COURSE-P4-04` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`quiz_attempts` is written on every attempt and **never read**. Add the read path and hydrate the
two assessment cards from it, so a reader returning to a lesson sees what they answered, whether
they got it right, and how many attempts it took — and a code challenge they already solved does
not re-lock its reference solution.

No schema change, no new endpoint, no extra round trip.

## Context

P4-02 wired persistence: `CourseProgressProvider` POSTs to `/api/courses/attempt` on every
submission, and `0016_courses.sql` keeps `quiz_attempts` append-only — one row per attempt, failures
included, the answer in JSONB.

What it did not add is any way back:

- `ICourseRepository` has `recordQuizAttempt` and no `list…`.
- `CourseService` has no attempt read; `/api/courses/progress` has no attempt shape.
- `QuizCard` seeds from `initialQuizState` on every mount (`QuizCard.tsx:56`).
- `CodeChallengeCard` likewise, so `solved`, `failures` and `solutionRevealed` all reset — and the
  reference solution the reader **earned** is locked again on their next visit.

Completing a quiz is deliberately not required to move on (P3-01), which makes the card's own state
the reader's only signal that they did the work. Today that signal survives exactly one page view.

## Files affected

| File | Change |
|------|--------|
| `src/domain/types.ts` | + `ExerciseAttemptHistory`, `LessonProgressDetail` |
| `src/domain/repositories/ICourseRepository.ts` | + `listQuizAttempts` |
| `src/infrastructure/supabase/SupabaseCourseRepository.ts` | + `listQuizAttempts` + `toQuizAttempt` mapper |
| `src/__tests__/fixtures/InMemoryCourseRepository.ts` | mirror `listQuizAttempts` |
| `src/services/CourseService.ts` | + pure `summariseAttempts`, + `getLessonProgressDetail` |
| `src/lib/schemas.ts` | `CourseProgressQuerySchema` gains optional `lessonSlug` |
| `src/app/api/courses/progress/route.ts` | `GET` branches on `lessonSlug` |
| `src/hooks/course-progress-state.ts` | snapshot gains the exercises map |
| `src/hooks/useCourseProgress.ts` | send `lessonSlug`, expose `exercises` |
| `src/features/courses/reader/CourseProgressProvider.tsx` | + `AttemptHistoryContext` |
| `src/lib/courses/quiz/restore.ts` (new) | pure `restoreQuizAnswer` |
| `src/features/courses/quiz/state.ts` | + `hydrate` action, + `restored` flag |
| `src/features/courses/quiz/QuizCard.tsx` | dispatch hydrate; badge; sign-in nudge |
| `src/features/courses/code/challenge-state.ts` | + `hydrate` action |
| `src/features/courses/code/CodeChallengeCard.tsx` | dispatch hydrate; badge; sign-in nudge |
| `src/app/[locale]/cursos/[courseSlug]/[lessonSlug]/page.tsx` | collect placed exercise ids |
| `src/features/courses/reader/LessonLayout.tsx` | pass `exerciseIds` through |
| `src/features/courses/reader/LessonComplete.tsx` | "N de M ejercicios resueltos" |
| `messages/es.json` + `messages/en.json` | new keys (**both files**) |

## The change

### The read path

```ts
export interface ExerciseAttemptHistory {
  quizId:          string;   // quiz id OR challenge id — one column serves both
  attempts:        number;
  solved:          boolean;  // correct on ANY attempt (sticky)
  lastCorrect:     boolean;
  lastAnswer:      unknown;  // the JSONB payload; validated at the client boundary
  lastAttemptedAt: string;
}

export interface LessonProgressDetail extends CourseProgressDetail {
  lessonSlug: string;
  exercises:  ExerciseAttemptHistory[];
}
```

`LessonProgressDetail` **extends** rather than widens `CourseProgressDetail`, the same move P4-02
made over `CourseProgressSummary`: every caller gets exactly its declared shape and the P4-03 list
response is untouched.

`CourseService.getLessonProgressDetail` reuses the private `readProgress` and adds one attempts
query, so the reader still makes a single request. The aggregation is a pure `summariseAttempts`
sitting next to `summarise`: group by `quiz_id`, count, `solved` if ever correct, last row supplies
the rest.

`GET /api/courses/progress?courseSlug=…&lessonSlug=…` returns the new shape. Without `lessonSlug`
nothing changes — same 204-when-signed-out, same limiter, same P4-03 list branch.

### Hydration

`CourseProgressProvider` publishes `AttemptHistoryContext` —
`{ status: "loading" | "untracked" | "ready", byId }` — beside the two write-side contexts P3-01 and
P3-02 left behind. It is a context for the same reason those are: the cards are rendered from the
server MDX map, so a prop cannot reach them. The `status` is load-bearing — without it a card would
paint "unanswered" and then jump when the fetch lands.

**Quiz:** the reducer gains `hydrate` and a `restored` flag. It restores the attempt count, the hint
flag and the selection, then **re-grades locally** with `gradeQuestion`, so the verdict always
matches the current answer key rather than a stored `correct` that a later content fix invalidated.
`restoreQuizAnswer` (new pure module) unwraps the JSONB, rejects a `questionType` that no longer
matches and validates the value against the current question; when it returns `null` the card falls
back to a badge with live inputs.

**Challenge:** `hydrate` restores `attempts`, `failures`, `solved` and `solutionRevealed` and never
touches `outcome`/`result`. There is nothing else to restore — P4-02 deliberately persists the
outcome, never the student's code — and the reveal gate needs no change: restoring `solved` and
`failures` is what keeps the solution unlocked.

**Anonymous readers** get a quiet "sign in to save your answers" line, and only after their first
submission. Before that the page stays exactly as clean as it is today (`LessonComplete`'s
no-sign-in-nag rule).

**The counter** next to mark-complete reads the ids actually **placed in the body** — via the
existing `findQuizRefs` / `findChallengeRefs` extractors — not the frontmatter list, which may
declare a question that is never placed and would inflate the denominator.

## Acceptance criteria

- [ ] Answer a quiz, reload: the answer, verdict, explanation and attempt count all return
- [ ] A retry after a reload records exactly ONE new row — page loads record none
- [ ] Solve a challenge, reload: the badge shows and the reference solution stays unlocked
- [ ] A stored answer that no longer fits the question degrades to the badge, never to a wrong verdict
- [ ] Answering before the history fetch lands is never overwritten by it
- [ ] Signed-out: no history, no errors, nudge only after a submission
- [ ] "N de M ejercicios resueltos" counts placed exercises only
- [ ] Lesson pages remain **statically generated**
- [ ] All strings via `t()`, keys in **both** message files
- [ ] `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Test plan

- **Pure units** (no jsdom, per the P2-02 discipline): `summariseAttempts`; `restoreQuizAnswer` over
  all five question types plus every drift case; the quiz reducer's hydrate rules including
  "a restored result does not report"; the challenge reducer's hydrate; the snapshot's exercises map.
- **Service:** `getLessonProgressDetail` against `InMemoryCourseRepository` + `FakeCourseCatalog`.
- **Route:** 204 signed out, 400 on a malformed `lessonSlug`, body shape on the happy path.
- **Mapper:** `attempted_at` TIMESTAMPTZ normalisation (`course-mappers.test.ts`).
- **E2E:** extend `e2e/courses-progress.spec.ts` — answer, reload, still answered. Keep the 30s
  timeouts and the comment explaining why (P4-02).

## Notes / gotchas

- ⚠️ **The duplicate-write trap.** `QuizCard` fires `onAnswered(state.result)` on every new result
  object. A hydrated result would POST a fresh row **on every page load**, corrupting the history
  being read. Hence the `restored` flag and its test.
- The JSONB `answer` is `unknown`. It must never enter the reducer unvalidated — that is what
  `restore.ts` is for, and why content drift degrades to a badge instead of a wrong verdict.
- Do not make the lesson page dynamic. The history is client-fetched post-hydration like the rest of
  progress.
- History is scoped to one lesson deliberately: a course-wide read is a much larger payload.

## Out of scope

- Persisting student-edited challenge code (P4-02's explicit decision).
- A sidebar marker for unsolved quizzes — needs course-wide attempt data.
- A local (sessionStorage) history for anonymous readers.
- Server-side re-grading and `/admin/cursos` analytics over `quiz_attempts` (still PLAN.md's).
- **Known edge, not fixed here:** `CourseAttemptSchema` caps the serialised answer at 2000 chars and
  rejects the whole request past it, so a very long `predict-output` answer loses its row entirely.
  The badge-only fallback covers the display side.
