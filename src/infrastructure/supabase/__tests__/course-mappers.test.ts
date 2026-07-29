// COURSE-P4-01: row → domain mapping for the course progress tables.
//
// A pure test (the `booking-history.test.ts` model), not a `describeDb` one: the
// mapping is where the TIMESTAMPTZ trap lives, and asserting it needs no database.
// PostgREST returns "…:43.13+00:00"; JavaScript produces "…:43.130Z". Anything
// serialised to a client — or compared against a JS-generated timestamp — has to
// be normalised first, per the CLAUDE.md rule.
import { toEnrollment, toLessonProgress } from "../SupabaseCourseRepository";

describe("toEnrollment", () => {
  it("normalises PostgREST timestamps to JavaScript's ISO format", () => {
    const enrollment = toEnrollment({
      course_slug:  "dl-nlp",
      enrolled_at:  "2026-07-29T10:04:43.13+00:00",
      completed_at: "2026-07-30T08:00:00+00:00",
    });

    expect(enrollment).toEqual({
      courseSlug:  "dl-nlp",
      enrolledAt:  "2026-07-29T10:04:43.130Z",
      completedAt: "2026-07-30T08:00:00.000Z",
    });
  });

  it("keeps a null completion date null", () => {
    const enrollment = toEnrollment({
      course_slug:  "dl-nlp",
      enrolled_at:  "2026-07-29T10:04:43.13+00:00",
      completed_at: null,
    });

    expect(enrollment.completedAt).toBeNull();
  });
});

describe("toLessonProgress", () => {
  it("maps a completed row, normalising both timestamps", () => {
    const progress = toLessonProgress({
      course_slug:  "dl-nlp",
      lesson_slug:  "pipeline",
      status:       "completed",
      completed_at: "2026-07-29T10:04:43.13+00:00",
      last_seen_at: "2026-07-29T11:30:00.5+00:00",
    });

    expect(progress).toEqual({
      courseSlug:  "dl-nlp",
      lessonSlug:  "pipeline",
      status:      "completed",
      completedAt: "2026-07-29T10:04:43.130Z",
      lastSeenAt:  "2026-07-29T11:30:00.500Z",
    });
  });

  it("maps a started row with no completion date", () => {
    const progress = toLessonProgress({
      course_slug:  "dl-nlp",
      lesson_slug:  "pipeline",
      status:       "started",
      completed_at: null,
      last_seen_at: "2026-07-29T11:30:00+00:00",
    });

    expect(progress.status).toBe("started");
    expect(progress.completedAt).toBeNull();
    expect(progress.lastSeenAt).toBe("2026-07-29T11:30:00.000Z");
  });
});
