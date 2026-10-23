/*
 * REFACTOR-R4-P3-02 — read-only queries for the admin panel.
 *
 * Absorbs the admin panel's `_data.ts` (deleted), which queried Supabase directly from app/
 * and was imported by three API routes. Admin surfaces only: nothing customer-facing
 * reads through this port. Writes (credit adjustments) go through CreditService.
 *
 * ADMIN-USERS-01: the students list became a users list with tabs (listUsers), and the
 * course readers views (listCourseReaders, courseLessonStats) were added. Both take the
 * published lesson slugs from the caller: the content registry, not the database, knows
 * what a course has published (migration 0027).
 */
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminNavCounts,
  AdminPaymentRow,
  AdminUserCounts,
  AdminUserRow,
  AdminUserSegment,
  AdminUserSubscriptionDetail,
  BookingRow,
  CourseReaderFilter,
  CourseReaderPage,
  CreditPackRow,
  StudentDetail,
} from "../types";

export interface ListUsersQuery {
  /** Case-insensitive fragment of the email or name. Absent = every user. */
  query?:        string;
  /** The tab. The counts ignore it. */
  segment:       AdminUserSegment;
  /** Published lesson slugs per course slug: the progress numerator counts only these. */
  courseLessons: Record<string, string[]>;
  limit:         number;
  offset:        number;
}

export interface ListCourseReadersQuery {
  courseSlug:  string;
  /** The course's published lesson slugs (the progress denominator). */
  lessons:     string[];
  /** The tab. The counts and the average ignore it. */
  status:      CourseReaderFilter;
  /** Activity on or after this instant (ISO) keeps an unfinished reader "active". */
  activeSince: string;
  limit:       number;
  offset:      number;
}

/** Readers who opened / completed one lesson. Unpublished lessons may appear. */
export interface LessonStatRow {
  lessonSlug: string;
  started:    number;
  completed:  number;
}

export interface IAdminQueryRepository {
  /** Every user but the admin, filtered by tab; sort order per tab (migration 0027). */
  listUsers(opts: ListUsersQuery): Promise<{ rows: AdminUserRow[]; counts: AdminUserCounts }>;
  dashboardCounts(): Promise<AdminDashboardCounts>;
  /** ADMIN-02: the sidebar badges, read on every admin page — two head counts, no rows. */
  navCounts(): Promise<AdminNavCounts>;
  /** Sum of succeeded payments created after `sinceIso`, in cents. */
  sumRevenueSince(sinceIso: string): Promise<number>;
  /** Any user, student or not — the detail page is reachable by URL for everyone. */
  getStudent(email: string): Promise<StudentDetail | null>;
  /** Every pack the user ever held, expired included, soonest expiry first. */
  listCreditPacks(email: string): Promise<CreditPackRow[]>;
  /** The user's latest 50 bookings, newest start first. */
  listStudentBookings(email: string): Promise<BookingRow[]>;
  /** The latest `limit` bookings across all users, newest start first. */
  listAllBookings(limit: number): Promise<AdminBookingRow[]>;
  /** The latest `limit` payments across all users, newest first. */
  listPayments(limit: number): Promise<AdminPaymentRow[]>;
  /** ADMIN-USERS-01: one course's readers (not the admin), latest activity first. */
  listCourseReaders(opts: ListCourseReadersQuery): Promise<CourseReaderPage>;
  /** ADMIN-USERS-01: per-lesson open/complete counts for one course, in no order. */
  courseLessonStats(courseSlug: string): Promise<LessonStatRow[]>;
  /** ADMIN-USERS-01: the user's blog/courses opt-ins. `[]` for an unknown email. */
  listUserSubscriptions(email: string): Promise<AdminUserSubscriptionDetail[]>;
}
