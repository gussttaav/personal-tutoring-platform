/*
 * COURSE-P4-01 — persistence port for course progress.
 *
 * Every method takes a RESOLVED `userId` (the `users.id` UUID), never an email:
 * email → id resolution is the service's job, via `UserService`. Slugs are plain
 * strings and are never validated here — the registry is the only authority on
 * what exists, and `CourseService` checks against it before calling.
 *
 * Two write rules the implementation must honour, because the domain depends on
 * them and the in-memory fake mirrors them:
 *   1. `touchLesson` NEVER writes `status`. Re-opening a completed lesson must
 *      not regress it to `started`.
 *   2. `completeLesson` / `completeEnrollment` set their timestamp only when it
 *      is still NULL. A second call is a no-op, not a new timestamp.
 */
import type { Enrollment, LessonProgress, QuizAttempt } from "../types";

export interface ICourseRepository {
  /** Idempotent — a second call for the same (user, course) does nothing. */
  enroll(userId: string, courseSlug: string): Promise<void>;

  findEnrollment(userId: string, courseSlug: string): Promise<Enrollment | null>;

  listEnrollments(userId: string): Promise<Enrollment[]>;

  /** Sets `completed_at` only if it is still NULL. */
  completeEnrollment(userId: string, courseSlug: string, completedAt: string): Promise<void>;

  /** Upsert of `last_seen_at` only. Must not touch `status` (see file header). */
  touchLesson(userId: string, courseSlug: string, lessonSlug: string): Promise<void>;

  /** Marks the lesson completed, setting `completed_at` only if still NULL. */
  completeLesson(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
    completedAt: string,
  ): Promise<void>;

  listLessonProgress(userId: string, courseSlug: string): Promise<LessonProgress[]>;

  /** Every course at once — lets `listEnrollments` build N summaries with 2 queries. */
  listAllLessonProgress(userId: string): Promise<LessonProgress[]>;

  /** Append-only: one row per attempt, never an update. */
  recordQuizAttempt(userId: string, attempt: Omit<QuizAttempt, "attemptedAt">): Promise<void>;

  /**
   * COURSE-P4-04 — the only READ of that append-only table, and it is scoped to one
   * lesson: a reader looking at a page needs that page's history, not the course's.
   * Ordered by `attemptedAt` ascending, because the service's aggregation takes the
   * LAST row as the current state.
   */
  listQuizAttempts(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
  ): Promise<QuizAttempt[]>;
}
