// COURSE-P1-03 — `formatBlockDuration`, the syllabus's minutes-or-hours split.
//
// COURSE-BUILD-01: the `groupLessonsByBlock` cases that used to live here moved to
// src/lib/courses/__tests__/course-build.test.ts along with the function itself — and with the
// rule they pinned inverted (a block with no published lessons is now RENDERED, as «próximamente»,
// instead of being omitted). What is left is this file's other export, which is pure formatting
// and stayed in the component.

import { formatBlockDuration } from "@/features/courses/landing/SyllabusAccordion";

describe("formatBlockDuration", () => {
  it("keeps totals under an hour in minutes", () => {
    expect(formatBlockDuration(0)).toEqual({ kind: "minutes", minutes: 0 });
    expect(formatBlockDuration(48)).toEqual({ kind: "minutes", minutes: 48 });
    expect(formatBlockDuration(59)).toEqual({ kind: "minutes", minutes: 59 });
  });

  it("splits totals of an hour or more into hours + minutes", () => {
    expect(formatBlockDuration(60)).toEqual({ kind: "hours", hours: 1, minutes: 0 });
    expect(formatBlockDuration(168)).toEqual({ kind: "hours", hours: 2, minutes: 48 });
    expect(formatBlockDuration(125)).toEqual({ kind: "hours", hours: 2, minutes: 5 });
  });
});
