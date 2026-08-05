/*
 * COURSE-P4-02 — the pure state behind `useCourseProgress`.
 *
 * Split out for the same reason `quiz/state.ts` (P3-01) and `code/challenge-state.ts`
 * (P3-02) were: this repo has no jsdom and no React Testing Library, so the logic
 * that actually carries risk — how an HTTP response becomes UI state, and how an
 * optimistic tick is applied and rolled back — lives here where it can be tested
 * directly, with no DOM and no fetch.
 *
 * Every transition returns the PREVIOUS object when nothing changed, so React can
 * skip a re-render on a redundant update.
 */

import type { CourseProgressDetail, ExerciseAttemptHistory, LessonProgressDetail } from "@/domain/types";

/** `loading` until the first read answers; `untracked` means no progress UI. */
export type ProgressStatus = "loading" | "untracked" | "ready";

export interface ProgressSnapshot {
  status:             ProgressStatus;
  totalLessons:       number;
  completed:          ReadonlySet<string>;
  lastSeenLessonSlug: string | null;
  /** COURSE-P4-04: this lesson's exercise history, by quiz/challenge id. Always
   *  empty unless the request named a lesson AND the reader is signed in. */
  exercises:          ReadonlyMap<string, ExerciseAttemptHistory>;
}

const EMPTY: ReadonlySet<string> = new Set();
const NO_EXERCISES: ReadonlyMap<string, ExerciseAttemptHistory> = new Map();

export const LOADING_SNAPSHOT: ProgressSnapshot = {
  status:             "loading",
  totalLessons:       0,
  completed:          EMPTY,
  lastSeenLessonSlug: null,
  exercises:          NO_EXERCISES,
};

export const UNTRACKED_SNAPSHOT: ProgressSnapshot = {
  ...LOADING_SNAPSHOT,
  status: "untracked",
};

/**
 * Interprets one `GET /api/courses/progress` response.
 *
 * `204` (signed out) and any non-OK status collapse to the same outcome on purpose:
 * both mean "no progress UI", and the reader must not be able to tell a signed-out
 * visit from a failed request — progress is a convenience, the lesson is the product.
 */
export function snapshotFromResponse(
  httpStatus: number,
  body: CourseProgressDetail | LessonProgressDetail | null,
): ProgressSnapshot {
  const ok = httpStatus >= 200 && httpStatus < 300;
  if (!ok || httpStatus === 204 || body === null) return UNTRACKED_SNAPSHOT;

  // `exercises` rides along only when the request named a lesson (P4-04); the
  // landing page's course-wide read legitimately has none.
  const exercises = "exercises" in body ? body.exercises : [];

  return {
    status:             "ready",
    totalLessons:       body.totalLessons,
    completed:          new Set(body.completedLessonSlugs),
    lastSeenLessonSlug: body.lastSeenLessonSlug,
    exercises:          new Map(exercises.map((e) => [e.quizId, e])),
  };
}

/** Optimistic tick. */
export function withCompleted(prev: ProgressSnapshot, lessonSlug: string): ProgressSnapshot {
  if (prev.completed.has(lessonSlug)) return prev;
  const completed = new Set(prev.completed);
  completed.add(lessonSlug);
  return { ...prev, completed };
}

/** Rollback when the write failed — without this the sidebar lies until a refresh. */
export function withoutCompleted(prev: ProgressSnapshot, lessonSlug: string): ProgressSnapshot {
  if (!prev.completed.has(lessonSlug)) return prev;
  const completed = new Set(prev.completed);
  completed.delete(lessonSlug);
  return { ...prev, completed };
}

/** One attempt as the client just observed it, before the server has seen it. */
export interface LocalAttempt {
  quizId:      string;
  correct:     boolean;
  /** The same JSONB payload the POST carries, so a re-hydrate restores what was given. */
  answer:      unknown;
  attemptedAt: string;
}

/*
 * COURSE-P4-04 — the optimistic twin of `summariseAttempts` (services/CourseService.ts).
 *
 * `exercises` used to be written exactly once, by the initial GET, and never again:
 * answering a quiz POSTed the attempt and returned. So the end-of-lesson counter read
 * "0 de 4" for a student who had just solved all four, and only told the truth on a
 * later visit, once the GET had the rows. This is the missing merge.
 *
 * It must agree with `summariseAttempts` row for row, because the two produce the same
 * history from the same attempts by two different routes — this session's optimistic
 * one, and the next session's read from Postgres. Two rules carry that agreement:
 *
 *   - `solved` is STICKY. Correct on any attempt means solved, even if a later retry
 *     slipped; `lastCorrect` is what describes the most recent one.
 *   - `attempts` is COUNTED HERE, not taken from the caller. The server counts rows,
 *     so counting locally is what keeps the two definitions the same one.
 *
 * Untracked snapshots are returned unchanged: a signed-out reader records nothing, and
 * a counter that moved for them would promise a save that never happened.
 */
export function withExerciseAttempt(
  prev: ProgressSnapshot,
  attempt: LocalAttempt,
): ProgressSnapshot {
  if (prev.status !== "ready") return prev;

  const previous = prev.exercises.get(attempt.quizId);
  const exercises = new Map(prev.exercises);
  exercises.set(attempt.quizId, {
    quizId:          attempt.quizId,
    attempts:        (previous?.attempts ?? 0) + 1,
    solved:          (previous?.solved ?? false) || attempt.correct,
    lastCorrect:     attempt.correct,
    lastAnswer:      attempt.answer ?? null,
    lastAttemptedAt: attempt.attemptedAt,
  });

  return { ...prev, exercises };
}

export interface DerivedProgress {
  tracking:         boolean;
  loading:          boolean;
  completedLessons: number;
  percentComplete:  number;
}

/** Counts are derived from the set, so an optimistic tick moves the bar too. */
export function derive(snapshot: ProgressSnapshot): DerivedProgress {
  const completedLessons = snapshot.completed.size;
  return {
    tracking: snapshot.status === "ready",
    loading:  snapshot.status === "loading",
    completedLessons,
    percentComplete:
      snapshot.totalLessons > 0
        ? Math.round((completedLessons / snapshot.totalLessons) * 100)
        : 0,
  };
}
