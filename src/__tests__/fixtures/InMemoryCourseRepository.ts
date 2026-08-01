// COURSE-P4-01: In-memory implementation of ICourseRepository.
//
// Mirrors the two write rules the Supabase implementation enforces in SQL, since
// the service tests assert them here:
//   1. `touchLesson` moves `lastSeenAt` and never writes `status`.
//   2. `completeLesson` / `completeEnrollment` set their timestamp only when it is
//      still null.
//
// The clock advances one millisecond per call so `lastSeenAt` ordering is
// deterministic — two touches inside the same real millisecond would otherwise
// tie and make "which lesson was seen last" a coin flip.
import type { ICourseRepository } from "@/domain/repositories/ICourseRepository";
import type { Enrollment, LessonProgress, LessonStatus, QuizAttempt } from "@/domain/types";

interface EnrollmentRecord {
  userId:      string;
  courseSlug:  string;
  enrolledAt:  string;
  completedAt: string | null;
}

interface ProgressRecord {
  userId:      string;
  courseSlug:  string;
  lessonSlug:  string;
  status:      LessonStatus;
  completedAt: string | null;
  lastSeenAt:  string;
}

export class InMemoryCourseRepository implements ICourseRepository {
  private enrollments = new Map<string, EnrollmentRecord>();
  private progress    = new Map<string, ProgressRecord>();
  /** Every attempt, in order — the table is append-only. */
  readonly attempts: (QuizAttempt & { userId: string })[] = [];

  private tick = 0;

  private now(): string {
    return new Date(Date.UTC(2026, 0, 1) + this.tick++).toISOString();
  }

  private enrollmentKey(userId: string, courseSlug: string): string {
    return `${userId}::${courseSlug}`;
  }

  private progressKey(userId: string, courseSlug: string, lessonSlug: string): string {
    return `${userId}::${courseSlug}::${lessonSlug}`;
  }

  async enroll(userId: string, courseSlug: string): Promise<void> {
    const key = this.enrollmentKey(userId, courseSlug);
    if (this.enrollments.has(key)) return; // idempotent
    this.enrollments.set(key, {
      userId,
      courseSlug,
      enrolledAt:  this.now(),
      completedAt: null,
    });
  }

  async findEnrollment(userId: string, courseSlug: string): Promise<Enrollment | null> {
    const rec = this.enrollments.get(this.enrollmentKey(userId, courseSlug));
    return rec ? toEnrollment(rec) : null;
  }

  async listEnrollments(userId: string): Promise<Enrollment[]> {
    return [...this.enrollments.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))
      .map(toEnrollment);
  }

  async completeEnrollment(
    userId: string,
    courseSlug: string,
    completedAt: string,
  ): Promise<void> {
    const rec = this.enrollments.get(this.enrollmentKey(userId, courseSlug));
    if (!rec || rec.completedAt !== null) return; // set once, never moved
    rec.completedAt = completedAt;
  }

  async touchLesson(userId: string, courseSlug: string, lessonSlug: string): Promise<void> {
    const key = this.progressKey(userId, courseSlug, lessonSlug);
    const rec = this.progress.get(key);

    if (rec) {
      rec.lastSeenAt = this.now(); // status deliberately untouched
      return;
    }

    this.progress.set(key, {
      userId,
      courseSlug,
      lessonSlug,
      status:      "started",
      completedAt: null,
      lastSeenAt:  this.now(),
    });
  }

  async completeLesson(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
    completedAt: string,
  ): Promise<void> {
    await this.touchLesson(userId, courseSlug, lessonSlug);
    const rec = this.progress.get(this.progressKey(userId, courseSlug, lessonSlug))!;
    if (rec.completedAt !== null) return; // set once, never moved
    rec.status      = "completed";
    rec.completedAt = completedAt;
  }

  async listLessonProgress(userId: string, courseSlug: string): Promise<LessonProgress[]> {
    return [...this.progress.values()]
      .filter((p) => p.userId === userId && p.courseSlug === courseSlug)
      .map(toLessonProgress);
  }

  async listAllLessonProgress(userId: string): Promise<LessonProgress[]> {
    return [...this.progress.values()]
      .filter((p) => p.userId === userId)
      .map(toLessonProgress);
  }

  async recordQuizAttempt(
    userId: string,
    attempt: Omit<QuizAttempt, "attemptedAt">,
  ): Promise<void> {
    this.attempts.push({ ...attempt, userId, attemptedAt: this.now() });
  }

  // COURSE-P4-04: insertion order IS `attemptedAt` order here (the clock ticks once
  // per write), so the ascending guarantee the interface makes holds for free.
  async listQuizAttempts(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
  ): Promise<QuizAttempt[]> {
    return this.attempts
      .filter(
        (a) => a.userId === userId && a.courseSlug === courseSlug && a.lessonSlug === lessonSlug,
      )
      .map(({ userId: _userId, ...attempt }) => attempt);
  }
}

function toEnrollment(rec: EnrollmentRecord): Enrollment {
  return {
    courseSlug:  rec.courseSlug,
    enrolledAt:  rec.enrolledAt,
    completedAt: rec.completedAt,
  };
}

function toLessonProgress(rec: ProgressRecord): LessonProgress {
  return {
    courseSlug:  rec.courseSlug,
    lessonSlug:  rec.lessonSlug,
    status:      rec.status,
    completedAt: rec.completedAt,
    lastSeenAt:  rec.lastSeenAt,
  };
}
