import type { BookingHistoryEntry, EnrolledCourseView, UserBooking } from "@/domain/types";

// UserBooking moved to src/domain/types.ts so this feature and BookingService share
// one declaration. Re-exported so the local imports in this folder keep working.
export type { UserBooking };

export type BookingsState = "loading" | "error" | UserBooking[];

/** `"error"` keeps the History tab renderable while the rest of the page works. */
export type HistoryState = "loading" | "error" | BookingHistoryEntry[];

// ─── COURSE-P4-03 — enrolled courses ──────────────────────────────────────────

export interface CourseProgressCardProps {
  view: EnrolledCourseView;
}

/** `"hidden"` covers every reason the courses tab renders nothing: the fetch failed,
 *  the session expired (204), or the response was unusable. Progress is a
 *  convenience — it must never break the page that shows a student's sessions. */
export type EnrollmentsState = "loading" | "hidden" | EnrolledCourseView[];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type PersonalAreaTab = "upcoming" | "history" | "courses";
