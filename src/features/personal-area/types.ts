import type { EnrolledCourseView } from "@/domain/types";

export interface UserBooking {
  eventId:     string;   // Google Calendar event id; lookup key consumed by the mobile app
  token:       string;
  joinToken:   string;
  sessionType: "free15min" | "session1h" | "session2h" | "pack";
  startsAt:    string;   // ISO 8601
  endsAt:      string;   // ISO 8601
  packSize?:   number;   // only for sessionType "pack"
}

export type BookingsState = "loading" | "error" | UserBooking[];

// ─── COURSE-P4-03 — "Mis cursos" panel ────────────────────────────────────────

export interface CourseProgressCardProps {
  view: EnrolledCourseView;
}

/** `"hidden"` covers every reason the panel renders nothing: the fetch failed, the
 *  session expired (204), or the response was unusable. Progress is a convenience —
 *  it must never break the page that shows a student's booked sessions. */
export type EnrollmentsState = "loading" | "hidden" | EnrolledCourseView[];
