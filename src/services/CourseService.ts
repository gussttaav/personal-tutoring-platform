/*
 * COURSE-P4-01 — course progress business logic.
 *
 * The join between the two halves of the course feature lives here: the repository
 * supplies the numerator (which lessons this user finished), the injected catalog
 * supplies the denominator (which lessons are published today). Nothing about the
 * percentage is stored, so publishing a lesson lowers everyone's progress instead
 * of leaving a stale total behind — that is the intended behaviour, not a bug.
 *
 * Two policies worth stating out loud:
 *
 *   Auto-enrolment. There is no enrol button. `markLessonSeen` creates the
 *   enrolment if it is missing, so the only thing between a visitor and the
 *   content is signing in.
 *
 *   Unknown slugs are dropped, not rejected. A bookmark to a lesson that was
 *   renamed or unpublished must never 500; the write is skipped and logged. Reads
 *   of an unknown course return a zeroed summary for the same reason.
 */
import type { ICourseRepository } from "@/domain/repositories/ICourseRepository";
import type { ICourseCatalog } from "@/domain/repositories/ICourseCatalog";
import type { CourseProgressSummary, Enrollment, LessonProgress } from "@/domain/types";
import { log } from "@/lib/logger";
import { UserService } from "./UserService";

/** Builds the summary from the two halves. Pure — no I/O, no clock. */
function summarise(
  courseSlug: string,
  publishedSlugs: string[],
  progress: LessonProgress[],
  enrollment: Enrollment | null,
): CourseProgressSummary {
  const published = new Set(publishedSlugs);
  // Progress rows for lessons that are no longer published are ignored on BOTH
  // sides of the fraction, so a renamed lesson can never push it past 100%.
  const relevant = progress.filter((p) => published.has(p.lessonSlug));

  const totalLessons     = publishedSlugs.length;
  const completedLessons = relevant.filter((p) => p.status === "completed").length;

  const lastSeen = relevant.reduce<LessonProgress | null>(
    (latest, p) => (!latest || p.lastSeenAt > latest.lastSeenAt ? p : latest),
    null,
  );

  return {
    courseSlug,
    totalLessons,
    completedLessons,
    percentComplete:    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    lastSeenLessonSlug: lastSeen?.lessonSlug ?? null,
    enrolledAt:         enrollment?.enrolledAt  ?? null,
    completedAt:        enrollment?.completedAt ?? null,
  };
}

export class CourseService {
  constructor(
    private readonly courses:     ICourseRepository,
    private readonly catalog:     ICourseCatalog,
    private readonly userService: UserService,
  ) {}

  async enroll(email: string, courseSlug: string): Promise<void> {
    if (!this.knownCourse(courseSlug, "enroll")) return;

    const userId = await this.userService.ensureUser(email);
    await this.courses.enroll(userId, courseSlug);
  }

  async markLessonSeen(email: string, courseSlug: string, lessonSlug: string): Promise<void> {
    if (!this.knownLesson(courseSlug, lessonSlug, "markLessonSeen")) return;

    const userId = await this.userService.ensureUser(email);
    await this.courses.enroll(userId, courseSlug);
    await this.courses.touchLesson(userId, courseSlug, lessonSlug);
  }

  async markLessonCompleted(email: string, courseSlug: string, lessonSlug: string): Promise<void> {
    if (!this.knownLesson(courseSlug, lessonSlug, "markLessonCompleted")) return;

    const userId = await this.userService.ensureUser(email);
    await this.courses.enroll(userId, courseSlug);

    const now = new Date().toISOString();
    await this.courses.completeLesson(userId, courseSlug, lessonSlug, now);

    // Finishing the last published lesson finishes the course. Re-derived from
    // the DB rather than counted incrementally, so it self-corrects when lessons
    // are added or unpublished between two completions.
    const publishedSlugs = this.catalog.listLessonSlugs(courseSlug);
    const progress       = await this.courses.listLessonProgress(userId, courseSlug);
    const summary        = summarise(courseSlug, publishedSlugs, progress, null);

    if (summary.totalLessons > 0 && summary.completedLessons === summary.totalLessons) {
      await this.courses.completeEnrollment(userId, courseSlug, now);
    }
  }

  async recordQuizAttempt(
    email: string,
    courseSlug: string,
    lessonSlug: string,
    quizId: string,
    correct: boolean,
    answer: unknown,
  ): Promise<void> {
    if (!this.knownLesson(courseSlug, lessonSlug, "recordQuizAttempt")) return;

    const userId = await this.userService.ensureUser(email);
    await this.courses.recordQuizAttempt(userId, {
      courseSlug,
      lessonSlug,
      quizId,
      correct,
      answer,
    });
  }

  async getCourseProgress(email: string, courseSlug: string): Promise<CourseProgressSummary> {
    const publishedSlugs = this.catalog.listLessonSlugs(courseSlug);

    const user = await this.userService.findByEmail(email);
    if (!user) return summarise(courseSlug, publishedSlugs, [], null);

    const [enrollment, progress] = await Promise.all([
      this.courses.findEnrollment(user.id, courseSlug),
      this.courses.listLessonProgress(user.id, courseSlug),
    ]);

    return summarise(courseSlug, publishedSlugs, progress, enrollment);
  }

  async listEnrollments(email: string): Promise<CourseProgressSummary[]> {
    const user = await this.userService.findByEmail(email);
    if (!user) return [];

    // Two queries for N courses — the per-course progress is grouped in memory
    // rather than fetched per enrolment.
    const [enrollments, progress] = await Promise.all([
      this.courses.listEnrollments(user.id),
      this.courses.listAllLessonProgress(user.id),
    ]);

    const byCourse = new Map<string, LessonProgress[]>();
    for (const row of progress) {
      const bucket = byCourse.get(row.courseSlug);
      if (bucket) bucket.push(row);
      else byCourse.set(row.courseSlug, [row]);
    }

    return enrollments.map((enrollment) =>
      summarise(
        enrollment.courseSlug,
        this.catalog.listLessonSlugs(enrollment.courseSlug),
        byCourse.get(enrollment.courseSlug) ?? [],
        enrollment,
      ),
    );
  }

  // ─── Slug guards ────────────────────────────────────────────────────────────

  private knownCourse(courseSlug: string, op: string): boolean {
    if (this.catalog.courseExists(courseSlug)) return true;
    log("warn", "Unknown course slug — course progress write dropped", {
      service: "courses",
      op,
      courseSlug,
    });
    return false;
  }

  private knownLesson(courseSlug: string, lessonSlug: string, op: string): boolean {
    if (!this.knownCourse(courseSlug, op)) return false;
    if (this.catalog.listLessonSlugs(courseSlug).includes(lessonSlug)) return true;

    log("warn", "Unknown or unpublished lesson slug — course progress write dropped", {
      service: "courses",
      op,
      courseSlug,
      lessonSlug,
    });
    return false;
  }
}
