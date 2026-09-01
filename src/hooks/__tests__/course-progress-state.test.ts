// COURSE-P4-02 — pure state behind `useCourseProgress`.
//
// The repo has no jsdom/RTL (see P2-01…P3-02), so this covers what a render test
// would have: how a response becomes UI state, and that an optimistic tick both
// applies and rolls back cleanly.
import type {
  CourseProgressDetail,
  ExerciseAttemptHistory,
  LessonProgressDetail,
  QuizAttempt,
} from "@/domain/types";
import {
  derive,
  snapshotFromResponse,
  withCompleted,
  withExerciseAttempt,
  withoutCompleted,
  LOADING_SNAPSHOT,
  UNTRACKED_SNAPSHOT,
  type LocalAttempt,
  type ProgressSnapshot,
} from "@/hooks/course-progress-state";
import { summariseAttempts } from "@/services/CourseService";

const detail = (over: Partial<CourseProgressDetail> = {}): CourseProgressDetail => ({
  courseSlug:           "dl-nlp",
  totalLessons:         4,
  completedLessons:     2,
  percentComplete:      50,
  lastSeenLessonSlug:   "l2",
  enrolledAt:           "2026-07-01T00:00:00.000Z",
  completedAt:          null,
  completedLessonSlugs: ["l1", "l2"],
  ...over,
});

const ready = (): ProgressSnapshot => snapshotFromResponse(200, detail());

describe("COURSE-P4-02: snapshotFromResponse", () => {
  it("maps a 200 into a ready snapshot", () => {
    const snap = snapshotFromResponse(200, detail());

    expect(snap.status).toBe("ready");
    expect(snap.totalLessons).toBe(4);
    expect(snap.lastSeenLessonSlug).toBe("l2");
    expect([...snap.completed].sort()).toEqual(["l1", "l2"]);
  });

  it("treats 204 (signed out) as untracked, not as an error", () => {
    const snap = snapshotFromResponse(204, null);

    expect(snap.status).toBe("untracked");
    expect(snap.totalLessons).toBe(0);
    expect(snap.completed.size).toBe(0);
  });

  it("collapses a failed request to the same untracked state as signed out", () => {
    // The reader must not be able to tell the two apart — no error UI either way.
    expect(snapshotFromResponse(500, null)).toEqual(snapshotFromResponse(204, null));
    expect(snapshotFromResponse(429, null).status).toBe("untracked");
  });
});

describe("COURSE-P4-02: optimistic completion", () => {
  it("ticks a lesson immediately", () => {
    const next = withCompleted(ready(), "l3");

    expect(next.completed.has("l3")).toBe(true);
    expect(derive(next).completedLessons).toBe(3);
  });

  it("rolls the tick back on failure, restoring the exact prior set", () => {
    const before = ready();
    const after  = withoutCompleted(withCompleted(before, "l3"), "l3");

    expect([...after.completed].sort()).toEqual([...before.completed].sort());
    expect(derive(after).completedLessons).toBe(2);
  });

  it("does not mutate the previous snapshot", () => {
    const before = ready();
    withCompleted(before, "l3");

    expect(before.completed.has("l3")).toBe(false);
  });

  it("returns the SAME object when nothing changes, so React can skip a render", () => {
    const snap = ready();

    expect(withCompleted(snap, "l1")).toBe(snap);      // already completed
    expect(withoutCompleted(snap, "l9")).toBe(snap);   // never completed
  });
});

describe("COURSE-P4-02: derive", () => {
  it("reports loading before the first response", () => {
    expect(derive(LOADING_SNAPSHOT)).toMatchObject({ loading: true, tracking: false });
  });

  it("computes the percentage from the set, so an optimistic tick moves the bar", () => {
    expect(derive(ready()).percentComplete).toBe(50);
    expect(derive(withCompleted(ready(), "l3")).percentComplete).toBe(75);
  });

  it("reports 0% rather than NaN when the course has no published lessons", () => {
    const empty = snapshotFromResponse(200, detail({ totalLessons: 0, completedLessonSlugs: [] }));

    expect(derive(empty).percentComplete).toBe(0);
  });
});

// ─── COURSE-P4-04 ────────────────────────────────────────────────────────────

describe("COURSE-P4-04: exercise history in the snapshot", () => {
  const exercise = (over: Partial<ExerciseAttemptHistory> = {}): ExerciseAttemptHistory => ({
    quizId:          "q1",
    attempts:        2,
    solved:          true,
    lastCorrect:     true,
    lastAnswer:      null,
    lastAttemptedAt: "2026-07-28T10:00:00.000Z",
    ...over,
  });

  const lessonDetail = (exercises: ExerciseAttemptHistory[]): LessonProgressDetail => ({
    ...detail(),
    lessonSlug: "l2",
    exercises,
  });

  it("indexes the lesson's exercises by id", () => {
    const snap = snapshotFromResponse(200, lessonDetail([exercise(), exercise({ quizId: "q2" })]));

    expect(snap.status).toBe("ready");
    expect(snap.exercises.get("q1")?.attempts).toBe(2);
    expect(snap.exercises.get("q2")?.solved).toBe(true);
    expect(snap.exercises.get("nope")).toBeUndefined();
  });

  it("is empty for the course-wide read, which carries no exercises", () => {
    expect(snapshotFromResponse(200, detail()).exercises.size).toBe(0);
  });

  it("is empty when signed out", () => {
    expect(snapshotFromResponse(204, null).exercises.size).toBe(0);
  });

  it("is empty when the request failed — the reader must not see a stale history", () => {
    expect(snapshotFromResponse(500, null).exercises.size).toBe(0);
  });

  it("survives an optimistic completion tick untouched", () => {
    const snap = withCompleted(snapshotFromResponse(200, lessonDetail([exercise()])), "l3");
    expect(snap.exercises.get("q1")?.attempts).toBe(2);
  });
});

// The bug: `exercises` was written once by the GET and never again, so the counter at
// the foot of the lesson said "0 de N" to a student who had just solved all N.
describe("COURSE-P4-04: optimistic attempt merge", () => {
  const attempt = (over: Partial<LocalAttempt> = {}): LocalAttempt => ({
    quizId:      "q1",
    correct:     true,
    answer:      { kind: "quiz", value: "a" },
    attemptedAt: "2026-08-05T10:00:00.000Z",
    ...over,
  });

  const empty = (): ProgressSnapshot =>
    snapshotFromResponse(200, { ...detail(), lessonSlug: "l2", exercises: [] });

  it("records the first attempt on an exercise with no history", () => {
    const next = withExerciseAttempt(empty(), attempt());
    const q1 = next.exercises.get("q1");

    expect(q1).toMatchObject({ quizId: "q1", attempts: 1, solved: true, lastCorrect: true });
    expect(q1?.lastAttemptedAt).toBe("2026-08-05T10:00:00.000Z");
  });

  it("counts the solved exercise immediately — the whole point of the fix", () => {
    let snap = empty();
    for (const id of ["q1", "q2", "q3"]) {
      snap = withExerciseAttempt(snap, attempt({ quizId: id }));
    }

    const solved = ["q1", "q2", "q3"].filter((id) => snap.exercises.get(id)?.solved === true);
    expect(solved).toHaveLength(3);
  });

  it("keeps `solved` sticky when a later retry slips, exactly as the server does", () => {
    const solvedThenWrong = withExerciseAttempt(
      withExerciseAttempt(empty(), attempt({ correct: true })),
      attempt({ correct: false, answer: { kind: "quiz", value: "b" } }),
    );

    expect(solvedThenWrong.exercises.get("q1")).toMatchObject({
      attempts:    2,
      solved:      true,   // sticky
      lastCorrect: false,  // but the last answer is described honestly
      lastAnswer:  { kind: "quiz", value: "b" },
    });
  });

  it("counts attempts itself rather than trusting the caller", () => {
    const twice = withExerciseAttempt(withExerciseAttempt(empty(), attempt()), attempt());
    expect(twice.exercises.get("q1")?.attempts).toBe(2);
  });

  it("stores a missing answer as null, not undefined", () => {
    const next = withExerciseAttempt(empty(), attempt({ answer: undefined }));
    expect(next.exercises.get("q1")?.lastAnswer).toBeNull();
  });

  it("is a no-op while loading or signed out — nothing was saved, so nothing moves", () => {
    expect(withExerciseAttempt(LOADING_SNAPSHOT, attempt())).toBe(LOADING_SNAPSHOT);
    expect(withExerciseAttempt(UNTRACKED_SNAPSHOT, attempt())).toBe(UNTRACKED_SNAPSHOT);
  });

  it("does not mutate the previous snapshot", () => {
    const before = empty();
    withExerciseAttempt(before, attempt());

    expect(before.exercises.size).toBe(0);
  });

  it("leaves the completion set alone", () => {
    const next = withExerciseAttempt(withCompleted(empty(), "l3"), attempt());
    expect([...next.completed].sort()).toEqual(["l1", "l2", "l3"]);
  });

  // THE test. The same attempts reach the UI by two routes — this session's optimistic
  // merge, and the next session's read of `quiz_attempts` through `summariseAttempts`.
  // If the two ever disagree, the counter changes when the student reloads the page,
  // which is the original bug wearing a different hat.
  it("agrees with `summariseAttempts` on the same sequence of attempts", () => {
    const sequence: LocalAttempt[] = [
      attempt({ quizId: "q1", correct: false, answer: { v: 1 }, attemptedAt: "2026-08-05T10:00:00.000Z" }),
      attempt({ quizId: "q1", correct: true,  answer: { v: 2 }, attemptedAt: "2026-08-05T10:01:00.000Z" }),
      attempt({ quizId: "q1", correct: false, answer: { v: 3 }, attemptedAt: "2026-08-05T10:02:00.000Z" }),
      attempt({ quizId: "q2", correct: true,  answer: { v: 4 }, attemptedAt: "2026-08-05T10:03:00.000Z" }),
    ];

    const optimistic = sequence.reduce(withExerciseAttempt, empty()).exercises;

    const rows: QuizAttempt[] = sequence.map((a) => ({
      courseSlug: "dl-nlp",
      lessonSlug: "l2",
      quizId:     a.quizId,
      correct:    a.correct,
      answer:     a.answer,
      attemptedAt: a.attemptedAt,
    }));
    const fromServer = new Map(summariseAttempts(rows).map((e) => [e.quizId, e]));

    expect(Object.fromEntries(optimistic)).toEqual(Object.fromEntries(fromServer));
  });
});
