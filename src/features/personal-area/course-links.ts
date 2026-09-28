/**
 * course-links.ts — where a course card's «continuar» points.
 *
 * COURSE-P4-03 logic, moved out of CourseProgressCard.tsx: the card now reaches the booking
 * context (useBookingActions.ts → BookingProvider → next-auth/react), which Jest's `node`
 * project cannot parse, and this repo has no jsdom — so the one decision the card makes lives
 * in a pure module its test can import (the `session-display.ts` / `booking-intent.ts` pattern).
 */

import type { EnrolledCourseView } from "@/domain/types";

export function resumeHref(view: EnrolledCourseView): string {
  return view.resumeLessonSlug
    ? `/cursos/${view.courseSlug}/${view.resumeLessonSlug}`
    : `/cursos/${view.courseSlug}`;
}
