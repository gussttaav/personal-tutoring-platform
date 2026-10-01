/*
 * REFACTOR-R4-P3-02 — read-only queries for the admin panel.
 *
 * Absorbs the admin panel's `_data.ts` (deleted), which queried Supabase directly from app/
 * and was imported by three API routes. Admin surfaces only: nothing customer-facing
 * reads through this port. Writes (credit adjustments) go through CreditService.
 */
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminPaymentRow,
  BookingRow,
  CreditPackRow,
  StudentDetail,
  StudentListPage,
} from "../types";

export interface ListStudentsQuery {
  /** Case-insensitive fragment of the email or name. Absent = every student. */
  query?:    string;
  /** Only students with <= 1 active credit. The page's counts ignore it. */
  lowCredit: boolean;
  limit:     number;
  offset:    number;
}

export interface IAdminQueryRepository {
  /** Students (users with a booking or a credit pack), ordered by email. */
  listStudents(opts: ListStudentsQuery): Promise<StudentListPage>;
  dashboardCounts(): Promise<AdminDashboardCounts>;
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
}
