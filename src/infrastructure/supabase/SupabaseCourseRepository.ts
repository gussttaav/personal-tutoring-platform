/*
 * COURSE-P4-01 — Supabase implementation of ICourseRepository.
 *
 * Three tables from migration 0016: `enrollments`, `lesson_progress`,
 * `quiz_attempts`. No joins to content — slugs are opaque text here.
 *
 * TIMESTAMPTZ: PostgREST returns "2026-07-29T10:04:43.13+00:00" while JavaScript
 * produces "2026-07-29T10:04:43.130Z". Every timestamp crossing this boundary is
 * normalised with `new Date(x).toISOString()` (CLAUDE.md rule) so callers can
 * compare and serialise them without surprises.
 */
import type { ICourseRepository } from "@/domain/repositories/ICourseRepository";
import type { Enrollment, LessonProgress, LessonStatus, QuizAttempt } from "@/domain/types";
import { supabase } from "./client";
import type { Json } from "./types";

interface EnrollmentRow {
  course_slug:  string;
  enrolled_at:  string;
  completed_at: string | null;
}

interface LessonProgressRow {
  course_slug:  string;
  lesson_slug:  string;
  status:       string;
  completed_at: string | null;
  last_seen_at: string;
}

export function toEnrollment(row: EnrollmentRow): Enrollment {
  return {
    courseSlug:  row.course_slug,
    enrolledAt:  new Date(row.enrolled_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export function toLessonProgress(row: LessonProgressRow): LessonProgress {
  return {
    courseSlug:  row.course_slug,
    lessonSlug:  row.lesson_slug,
    status:      row.status as LessonStatus,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    lastSeenAt:  new Date(row.last_seen_at).toISOString(),
  };
}

// COURSE-P4-04
interface QuizAttemptRow {
  course_slug:  string;
  lesson_slug:  string;
  quiz_id:      string;
  correct:      boolean;
  answer:       Json | null;
  attempted_at: string;
}

export function toQuizAttempt(row: QuizAttemptRow): QuizAttempt {
  return {
    courseSlug:  row.course_slug,
    lessonSlug:  row.lesson_slug,
    quizId:      row.quiz_id,
    correct:     row.correct,
    answer:      row.answer ?? null,
    attemptedAt: new Date(row.attempted_at).toISOString(),
  };
}

const ENROLLMENT_COLUMNS = "course_slug, enrolled_at, completed_at";
const PROGRESS_COLUMNS   = "course_slug, lesson_slug, status, completed_at, last_seen_at";
const ATTEMPT_COLUMNS    = "course_slug, lesson_slug, quiz_id, correct, answer, attempted_at";

export class SupabaseCourseRepository implements ICourseRepository {
  async enroll(userId: string, courseSlug: string): Promise<void> {
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: userId, course_slug: courseSlug });

    // 23505 = unique_violation — already enrolled, treat as idempotent success.
    if (error && error.code !== "23505") throw error;
  }

  async findEnrollment(userId: string, courseSlug: string): Promise<Enrollment | null> {
    const { data, error } = await supabase
      .from("enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("user_id", userId)
      .eq("course_slug", courseSlug)
      .maybeSingle();

    if (error) throw error;
    return data ? toEnrollment(data) : null;
  }

  async listEnrollments(userId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from("enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toEnrollment);
  }

  async completeEnrollment(
    userId: string,
    courseSlug: string,
    completedAt: string,
  ): Promise<void> {
    // `.is("completed_at", null)` makes the second call a no-op: finishing a
    // course twice must not move the completion date.
    const { error } = await supabase
      .from("enrollments")
      .update({ completed_at: completedAt })
      .eq("user_id", userId)
      .eq("course_slug", courseSlug)
      .is("completed_at", null);

    if (error) throw error;
  }

  async touchLesson(userId: string, courseSlug: string, lessonSlug: string): Promise<void> {
    // `status` is deliberately absent from the payload. PostgREST builds the
    // ON CONFLICT DO UPDATE SET clause from the payload columns only, so an
    // existing `completed` row keeps its status while `last_seen_at` moves —
    // this is what stops a re-read from regressing a finished lesson. On insert
    // the column falls back to its DEFAULT 'started'.
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id:      userId,
          course_slug:  courseSlug,
          lesson_slug:  lessonSlug,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_slug,lesson_slug" },
      );

    if (error) throw error;
  }

  async completeLesson(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
    completedAt: string,
  ): Promise<void> {
    // Two statements, not one upsert: the row may not exist yet (a reader can
    // complete a lesson the same request it first opens it), and the completion
    // timestamp must survive a repeat call untouched.
    await this.touchLesson(userId, courseSlug, lessonSlug);

    const { error } = await supabase
      .from("lesson_progress")
      .update({ status: "completed", completed_at: completedAt })
      .eq("user_id", userId)
      .eq("course_slug", courseSlug)
      .eq("lesson_slug", lessonSlug)
      .is("completed_at", null);

    if (error) throw error;
  }

  async listLessonProgress(userId: string, courseSlug: string): Promise<LessonProgress[]> {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select(PROGRESS_COLUMNS)
      .eq("user_id", userId)
      .eq("course_slug", courseSlug);

    if (error) throw error;
    return (data ?? []).map(toLessonProgress);
  }

  async listAllLessonProgress(userId: string): Promise<LessonProgress[]> {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select(PROGRESS_COLUMNS)
      .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map(toLessonProgress);
  }

  async recordQuizAttempt(
    userId: string,
    attempt: Omit<QuizAttempt, "attemptedAt">,
  ): Promise<void> {
    const { error } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id:     userId,
        course_slug: attempt.courseSlug,
        lesson_slug: attempt.lessonSlug,
        quiz_id:     attempt.quizId,
        correct:     attempt.correct,
        answer:      (attempt.answer ?? null) as Json,
      });

    if (error) throw error;
  }

  // COURSE-P4-04: ascending, because `summariseAttempts` reads the LAST row as the
  // exercise's current state.
  async listQuizAttempts(
    userId: string,
    courseSlug: string,
    lessonSlug: string,
  ): Promise<QuizAttempt[]> {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(ATTEMPT_COLUMNS)
      .eq("user_id", userId)
      .eq("course_slug", courseSlug)
      .eq("lesson_slug", lessonSlug)
      .order("attempted_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toQuizAttempt);
  }
}
