// COURSE-P4-03 — where "continuar" points.
//
// No jsdom / RTL in this repo, so the card's only real decision is exported as a
// pure function and tested here (the pattern `groupLessonsByBlock` established in
// features/courses/landing/__tests__/SyllabusAccordion.test.ts).

import type { EnrolledCourseView } from "@/domain/types";
import { resumeHref } from "@/features/personal-area/CourseProgressCard";

const view = (over: Partial<EnrolledCourseView> = {}): EnrolledCourseView => ({
  courseSlug:       "dl-nlp",
  title:            "Deep Learning para NLP",
  totalLessons:     10,
  completedLessons: 3,
  percentComplete:  30,
  resumeLessonSlug: "backprop",
  completedAt:      null,
  contentLocale:    "es",
  ...over,
});

describe("resumeHref", () => {
  it("links the lesson to resume", () => {
    expect(resumeHref(view())).toBe("/cursos/dl-nlp/backprop");
  });

  it("falls back to the course landing when there is nothing to resume", () => {
    // `resumeLessonSlug` is already lastSeen → first published lesson server-side,
    // so `null` here means the course has no published lesson at all.
    expect(resumeHref(view({ resumeLessonSlug: null }))).toBe("/cursos/dl-nlp");
  });
});
