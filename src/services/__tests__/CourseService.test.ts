// COURSE-P4-01: CourseService against the in-memory repository and a fake catalog.
//
// The catalog fake is what makes the percentage assertions readable: the
// denominator is the array passed to `FakeCourseCatalog`, so "drafts are
// excluded" is expressed by leaving a slug out rather than by building an MDX
// tree and re-pointing the registry.
import type { QuizAttempt } from "@/domain/types";
import { CourseService, summariseAttempts } from "../CourseService";
import { UserService }   from "../UserService";
import { InMemoryCourseRepository } from "@/__tests__/fixtures/InMemoryCourseRepository";
import { FakeCourseCatalog }        from "@/__tests__/fixtures/FakeCourseCatalog";
import { InMemoryUserRepository }   from "@/__tests__/fixtures/InMemoryUserRepository";

const EMAIL  = "student@example.com";
const COURSE = "dl-nlp";

function makeService(published: string[] = ["l1", "l2", "l3", "l4"]) {
  const courses  = new InMemoryCourseRepository();
  const userRepo = new InMemoryUserRepository();
  const catalog  = new FakeCourseCatalog({ [COURSE]: published });
  const service  = new CourseService(courses, catalog, new UserService(userRepo));
  return { service, courses, userRepo };
}

describe("CourseService.enroll", () => {
  it("is idempotent — a second call neither throws nor re-dates the enrolment", async () => {
    const { service } = makeService();

    await service.enroll(EMAIL, COURSE);
    const first = await service.getCourseProgress(EMAIL, COURSE);

    await service.enroll(EMAIL, COURSE);
    const second = await service.getCourseProgress(EMAIL, COURSE);

    expect(first.enrolledAt).not.toBeNull();
    expect(second.enrolledAt).toBe(first.enrolledAt);
  });

  it("drops the write for an unknown course without throwing", async () => {
    const { service, courses } = makeService();

    await expect(service.enroll(EMAIL, "no-such-course")).resolves.toBeUndefined();
    expect(await courses.listEnrollments("anything")).toEqual([]);
  });
});

describe("CourseService.markLessonSeen", () => {
  it("auto-enrols on the first lesson view", async () => {
    const { service } = makeService();

    await service.markLessonSeen(EMAIL, COURSE, "l1");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.enrolledAt).not.toBeNull();
    expect(summary.lastSeenLessonSlug).toBe("l1");
    expect(summary.completedLessons).toBe(0);
  });

  it("tracks the most recently seen lesson", async () => {
    const { service } = makeService();

    await service.markLessonSeen(EMAIL, COURSE, "l1");
    await service.markLessonSeen(EMAIL, COURSE, "l2");
    await service.markLessonSeen(EMAIL, COURSE, "l1");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.lastSeenLessonSlug).toBe("l1");
  });

  it("does NOT regress a completed lesson back to started", async () => {
    // The most likely real bug in this phase: re-opening a finished lesson (two
    // tabs, a back button) must move `lastSeenAt` and nothing else.
    const { service, courses, userRepo } = makeService();

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    const user   = (await userRepo.findByEmail(EMAIL))!;
    const before = (await courses.listLessonProgress(user.id, COURSE))[0];

    await service.markLessonSeen(EMAIL, COURSE, "l1");
    const after = (await courses.listLessonProgress(user.id, COURSE))[0];

    expect(after.status).toBe("completed");
    expect(after.completedAt).toBe(before.completedAt);
    expect(after.lastSeenAt > before.lastSeenAt).toBe(true);
    expect((await service.getCourseProgress(EMAIL, COURSE)).completedLessons).toBe(1);
  });

  it("drops the write for an unpublished (draft) lesson", async () => {
    const { service } = makeService(["l1", "l2"]);

    await service.markLessonSeen(EMAIL, COURSE, "draft-lesson");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.enrolledAt).toBeNull();
    expect(summary.lastSeenLessonSlug).toBeNull();
  });
});

describe("CourseService.markLessonCompleted", () => {
  it("auto-enrols and counts the lesson once", async () => {
    const { service } = makeService();

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.markLessonCompleted(EMAIL, COURSE, "l1");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.enrolledAt).not.toBeNull();
    expect(summary.completedLessons).toBe(1);
  });

  it("sets completed_at once — a second call does not move the timestamp", async () => {
    const { service, courses, userRepo } = makeService();

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    const user  = (await userRepo.findByEmail(EMAIL))!;
    const first = (await courses.listLessonProgress(user.id, COURSE))[0].completedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    const second = (await courses.listLessonProgress(user.id, COURSE))[0].completedAt;

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("completes the course when the last published lesson is finished", async () => {
    const { service } = makeService(["l1", "l2"]);

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    expect((await service.getCourseProgress(EMAIL, COURSE)).completedAt).toBeNull();

    await service.markLessonCompleted(EMAIL, COURSE, "l2");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.percentComplete).toBe(100);
    expect(summary.completedAt).not.toBeNull();
  });

  it("does not move the course completion date once set", async () => {
    const { service } = makeService(["l1"]);

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    const first = (await service.getCourseProgress(EMAIL, COURSE)).completedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    const second = (await service.getCourseProgress(EMAIL, COURSE)).completedAt;

    expect(second).toBe(first);
  });

  it("drops the write for an unknown lesson without throwing", async () => {
    const { service } = makeService();

    await expect(service.markLessonCompleted(EMAIL, COURSE, "ghost")).resolves.toBeUndefined();
    expect((await service.getCourseProgress(EMAIL, COURSE)).completedLessons).toBe(0);
  });
});

describe("CourseService.getCourseProgress", () => {
  it("reports 0% for a user who has done nothing", async () => {
    const { service } = makeService(["l1", "l2", "l3", "l4"]);

    const summary = await service.getCourseProgress(EMAIL, COURSE);

    expect(summary).toEqual({
      courseSlug:         COURSE,
      totalLessons:       4,
      completedLessons:   0,
      percentComplete:    0,
      lastSeenLessonSlug: null,
      enrolledAt:         null,
      completedAt:        null,
    });
  });

  it("reports a partial percentage against the registry denominator", async () => {
    const { service } = makeService(["l1", "l2", "l3", "l4"]);

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.markLessonCompleted(EMAIL, COURSE, "l2");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.totalLessons).toBe(4);
    expect(summary.completedLessons).toBe(2);
    expect(summary.percentComplete).toBe(50);
  });

  it("excludes drafts from the denominator", async () => {
    // Same two completions, but only three lessons are published: the draft
    // fourth lesson must not dilute the percentage.
    const { service } = makeService(["l1", "l2", "l3"]);

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.markLessonCompleted(EMAIL, COURSE, "l2");

    const summary = await service.getCourseProgress(EMAIL, COURSE);
    expect(summary.totalLessons).toBe(3);
    expect(summary.percentComplete).toBe(67);
  });

  it("ignores progress rows whose lesson is no longer published", async () => {
    // Complete two lessons, then unpublish one of them (the catalog shrinks).
    const courses  = new InMemoryCourseRepository();
    const userRepo = new InMemoryUserRepository();
    const before   = new CourseService(
      courses,
      new FakeCourseCatalog({ [COURSE]: ["l1", "l2"] }),
      new UserService(userRepo),
    );
    await before.markLessonCompleted(EMAIL, COURSE, "l1");
    await before.markLessonCompleted(EMAIL, COURSE, "l2");

    const after = new CourseService(
      courses,
      new FakeCourseCatalog({ [COURSE]: ["l1"] }),
      new UserService(userRepo),
    );

    const summary = await after.getCourseProgress(EMAIL, COURSE);
    expect(summary.totalLessons).toBe(1);
    expect(summary.completedLessons).toBe(1);
    expect(summary.percentComplete).toBe(100);
  });

  it("returns a zeroed summary for an unknown course", async () => {
    const { service } = makeService();

    const summary = await service.getCourseProgress(EMAIL, "no-such-course");
    expect(summary.totalLessons).toBe(0);
    expect(summary.percentComplete).toBe(0);
    expect(summary.enrolledAt).toBeNull();
  });

  it("returns a zeroed summary for an unknown user without creating one", async () => {
    const { service, userRepo } = makeService();

    const summary = await service.getCourseProgress("stranger@example.com", COURSE);

    expect(summary.completedLessons).toBe(0);
    expect(await userRepo.findByEmail("stranger@example.com")).toBeNull();
  });
});

describe("CourseService.listEnrollments", () => {
  it("returns [] for a user with no enrolments", async () => {
    const { service } = makeService();
    expect(await service.listEnrollments(EMAIL)).toEqual([]);
  });

  it("returns one summary per enrolled course", async () => {
    const courses  = new InMemoryCourseRepository();
    const userRepo = new InMemoryUserRepository();
    const catalog  = new FakeCourseCatalog({ "dl-nlp": ["l1", "l2"], "otro": ["a"] });
    const service  = new CourseService(courses, catalog, new UserService(userRepo));

    await service.markLessonCompleted(EMAIL, "dl-nlp", "l1");
    await service.markLessonSeen(EMAIL, "otro", "a");

    const summaries = await service.listEnrollments(EMAIL);

    expect(summaries.map((s) => s.courseSlug)).toEqual(["dl-nlp", "otro"]);
    expect(summaries[0].percentComplete).toBe(50);
    expect(summaries[1].percentComplete).toBe(0);
    expect(summaries[1].lastSeenLessonSlug).toBe("a");
  });
});

describe("CourseService.recordQuizAttempt", () => {
  it("appends every attempt, including repeats of the same question", async () => {
    const { service, courses, userRepo } = makeService();

    await service.markLessonSeen(EMAIL, COURSE, "l1");
    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", false, { choice: 2 });
    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", true,  { choice: 1 });

    const user = (await userRepo.findByEmail(EMAIL))!;
    expect(courses.attempts).toHaveLength(2);
    expect(courses.attempts[0]).toMatchObject({
      userId:     user.id,
      courseSlug: COURSE,
      lessonSlug: "l1",
      quizId:     "q1",
      correct:    false,
      answer:     { choice: 2 },
    });
    expect(courses.attempts[1].correct).toBe(true);
  });

  it("drops the attempt for an unknown lesson", async () => {
    const { service, courses } = makeService();

    await service.recordQuizAttempt(EMAIL, COURSE, "ghost", "q1", true, null);

    expect(courses.attempts).toHaveLength(0);
  });
});

// COURSE-P4-02: the reader's read. Same two queries as getCourseProgress, plus the
// completed slugs the sidebar ticks — so the invariants that matter are that the
// list agrees with the count, and that it applies the same published-only filter.
describe("CourseService.getCourseProgressDetail", () => {
  it("returns no completed slugs before anything is finished", async () => {
    const { service } = makeService();

    await service.markLessonSeen(EMAIL, COURSE, "l1");
    const detail = await service.getCourseProgressDetail(EMAIL, COURSE);

    expect(detail.completedLessonSlugs).toEqual([]);
    expect(detail.completedLessons).toBe(0);
  });

  it("lists exactly the completed lessons, in reading order", async () => {
    const { service } = makeService();

    // Completed out of order on purpose — the list must follow the catalog, not
    // the order the student happened to finish them in.
    await service.markLessonCompleted(EMAIL, COURSE, "l3");
    await service.markLessonCompleted(EMAIL, COURSE, "l1");

    const detail = await service.getCourseProgressDetail(EMAIL, COURSE);

    expect(detail.completedLessonSlugs).toEqual(["l1", "l3"]);
    expect(detail.completedLessons).toBe(detail.completedLessonSlugs.length);
  });

  it("omits a lesson that has been seen but not completed", async () => {
    const { service } = makeService();

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.markLessonSeen(EMAIL, COURSE, "l2");

    const detail = await service.getCourseProgressDetail(EMAIL, COURSE);

    expect(detail.completedLessonSlugs).toEqual(["l1"]);
  });

  it("drops progress rows for lessons that are no longer published", async () => {
    const courses  = new InMemoryCourseRepository();
    const userRepo = new InMemoryUserRepository();
    const wide     = new FakeCourseCatalog({ [COURSE]: ["l1", "l2"] });
    const service  = new CourseService(courses, wide, new UserService(userRepo));

    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.markLessonCompleted(EMAIL, COURSE, "l2");

    // l2 is withdrawn: it must leave BOTH the list and the counts.
    const narrowed = new CourseService(
      courses,
      new FakeCourseCatalog({ [COURSE]: ["l1"] }),
      new UserService(userRepo),
    );
    const detail = await narrowed.getCourseProgressDetail(EMAIL, COURSE);

    expect(detail.completedLessonSlugs).toEqual(["l1"]);
    expect(detail.percentComplete).toBe(100);
  });

  it("returns an empty list for an unknown user without creating one", async () => {
    const { service, userRepo } = makeService();

    const detail = await service.getCourseProgressDetail("nobody@example.com", COURSE);

    expect(detail.completedLessonSlugs).toEqual([]);
    expect(detail.enrolledAt).toBeNull();
    expect(await userRepo.findByEmail("nobody@example.com")).toBeNull();
  });
});

// ─── COURSE-P4-04 ────────────────────────────────────────────────────────────

describe("summariseAttempts", () => {
  const attempt = (over: Partial<QuizAttempt> = {}): QuizAttempt => ({
    courseSlug:  COURSE,
    lessonSlug:  "l1",
    quizId:      "q1",
    correct:     false,
    answer:      null,
    attemptedAt: "2026-07-28T10:00:00.000Z",
    ...over,
  });

  it("returns nothing for a reader who has attempted nothing", () => {
    expect(summariseAttempts([])).toEqual([]);
  });

  it("groups by exercise and counts every attempt", () => {
    const history = summariseAttempts([
      attempt({ quizId: "q1" }),
      attempt({ quizId: "q2" }),
      attempt({ quizId: "q1" }),
    ]);

    expect(history).toHaveLength(2);
    expect(history.find((h) => h.quizId === "q1")?.attempts).toBe(2);
    expect(history.find((h) => h.quizId === "q2")?.attempts).toBe(1);
  });

  it("marks `solved` if ANY attempt was correct, and keeps the LAST one's answer", () => {
    const [history] = summariseAttempts([
      attempt({ correct: true,  answer: "first",  attemptedAt: "2026-07-28T10:00:00.000Z" }),
      attempt({ correct: false, answer: "second", attemptedAt: "2026-07-29T10:00:00.000Z" }),
    ]);

    // Solved once is solved; the card still shows what they actually left behind.
    expect(history.solved).toBe(true);
    expect(history.lastCorrect).toBe(false);
    expect(history.lastAnswer).toBe("second");
    expect(history.lastAttemptedAt).toBe("2026-07-29T10:00:00.000Z");
  });
});

describe("CourseService.getLessonProgressDetail", () => {
  const ANSWER = { kind: "quiz", questionType: "single", value: "b", hintUsed: false, attempt: 1 };

  it("returns this lesson's attempts alongside the usual progress detail", async () => {
    const { service } = makeService();

    await service.markLessonSeen(EMAIL, COURSE, "l1");
    await service.markLessonCompleted(EMAIL, COURSE, "l1");
    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", false, ANSWER);
    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", true, ANSWER);

    const detail = await service.getLessonProgressDetail(EMAIL, COURSE, "l1");

    expect(detail.lessonSlug).toBe("l1");
    expect(detail.completedLessonSlugs).toEqual(["l1"]);
    expect(detail.totalLessons).toBe(4);
    expect(detail.exercises).toEqual([
      expect.objectContaining({ quizId: "q1", attempts: 2, solved: true, lastCorrect: true }),
    ]);
  });

  it("does not leak another lesson's attempts", async () => {
    const { service } = makeService();

    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", true, ANSWER);
    await service.recordQuizAttempt(EMAIL, COURSE, "l2", "q2", true, ANSWER);

    const detail = await service.getLessonProgressDetail(EMAIL, COURSE, "l1");
    expect(detail.exercises.map((e) => e.quizId)).toEqual(["q1"]);
  });

  it("does not leak another reader's attempts", async () => {
    const { service } = makeService();

    await service.recordQuizAttempt("other@example.com", COURSE, "l1", "q1", true, ANSWER);

    const detail = await service.getLessonProgressDetail(EMAIL, COURSE, "l1");
    expect(detail.exercises).toEqual([]);
  });

  it("returns zeroes for a reader who has never touched the course", async () => {
    const { service } = makeService();

    const detail = await service.getLessonProgressDetail("nobody@example.com", COURSE, "l1");

    expect(detail.exercises).toEqual([]);
    expect(detail.completedLessonSlugs).toEqual([]);
    expect(detail.percentComplete).toBe(0);
  });

  it("answers for an unpublished lesson with an empty history instead of throwing", async () => {
    const { service } = makeService(["l1", "l2"]);

    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", true, ANSWER);

    // A stale bookmark to a withdrawn lesson is a no-op, never a 500 (P4-01 policy).
    const detail = await service.getLessonProgressDetail(EMAIL, COURSE, "withdrawn");
    expect(detail.exercises).toEqual([]);
    expect(detail.lessonSlug).toBe("withdrawn");
  });

  it("leaves `getCourseProgressDetail`'s shape alone — no exercises leak into it", async () => {
    const { service } = makeService();

    await service.recordQuizAttempt(EMAIL, COURSE, "l1", "q1", true, ANSWER);

    const detail = await service.getCourseProgressDetail(EMAIL, COURSE);
    expect(detail).not.toHaveProperty("exercises");
    expect(detail).not.toHaveProperty("lessonSlug");
  });
});
