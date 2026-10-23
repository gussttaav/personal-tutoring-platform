// REFACTOR-R4-P3-02: Supabase implementation of IAdminQueryRepository. Absorbs
// the admin panel's `_data.ts` (ADMIN-01, deleted), with two changes:
//   - the student list is the admin_list_students RPC (migration 0024): students only,
//     searched and paginated in Postgres, instead of `users ORDER BY email LIMIT 100`
//     filtered in the browser;
//   - read errors throw (repository convention) instead of rendering as empty lists and
//     zero counts.
// The bookings/payments lists keep their "latest N" shape unchanged.
//
// ADMIN-USERS-01: admin_list_students gave way to admin_list_users (every user but the
// admin, one tab at a time), and the course readers views read admin_list_course_users and
// admin_course_lesson_stats (migration 0027). Timestamps are normalised with
// `new Date(…).toISOString()` (PostgREST answers "+00:00", CLAUDE.md).
import type {
  IAdminQueryRepository,
  LessonStatRow,
  ListCourseReadersQuery,
  ListUsersQuery,
} from "@/domain/repositories/IAdminQueryRepository";
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminNavCounts,
  AdminPaymentRow,
  AdminUserCounts,
  AdminUserRow,
  AdminUserSubscription,
  AdminUserSubscriptionDetail,
  BlogArea,
  BookingRow,
  CourseReaderPage,
  CourseReaderStatus,
  CreditPackRow,
  StudentDetail,
  SubscriptionType,
} from "@/domain/types";
import { supabase } from "./client";

// The generated types mark every RETURNS TABLE column non-null. They are not: the dates
// are NULL for a user with no active pack / upcoming class, and a page with no rows comes
// back as one counts-only row whose user columns are all NULL (see 0027).
interface UserListRow {
  email:            string | null;
  name:             string | null;
  created_at:       string | null;
  unbooked_credits: number | null;
  earliest_expiry:  string | null;
  next_session:     string | null;
  bookings_count:   number | null;
  courses:          { slug: string; completed: number }[] | null;
  subscriptions:    { type: SubscriptionType; areas: BlogArea[] | null }[] | null;
  total_count:      number;
  credits_count:    number;
  upcoming_count:   number;
  booked_count:     number;
  courses_count:    number;
  subscribed_count: number;
}

interface CourseReaderListRow {
  email:             string | null;
  name:              string | null;
  enrolled_at:       string | null;
  completed_lessons: number | null;
  last_lesson_slug:  string | null;
  last_activity_at:  string | null;
  status:            CourseReaderStatus | null;
  total_count:       number;
  active_count:      number;
  finished_count:    number;
  inactive_count:    number;
  avg_completed:     number | string;
}

const iso = (ts: string): string => new Date(ts).toISOString();
const isoOrNull = (ts: string | null): string | null => (ts ? iso(ts) : null);

function userCounts(row: UserListRow | undefined): AdminUserCounts {
  return {
    all:        Number(row?.total_count ?? 0),
    credits:    Number(row?.credits_count ?? 0),
    upcoming:   Number(row?.upcoming_count ?? 0),
    booked:     Number(row?.booked_count ?? 0),
    courses:    Number(row?.courses_count ?? 0),
    subscribed: Number(row?.subscribed_count ?? 0),
  };
}

type JoinedUser = { email: string; name: string } | { email: string; name: string }[] | null;

function joinedUser(users: JoinedUser): { email: string; name: string } | null {
  return (Array.isArray(users) ? users[0] : users) ?? null;
}

export class SupabaseAdminQueryRepository implements IAdminQueryRepository {
  async listUsers(opts: ListUsersQuery): Promise<{ rows: AdminUserRow[]; counts: AdminUserCounts }> {
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_query:          opts.query,
      p_segment:        opts.segment,
      p_course_lessons: opts.courseLessons,
      p_limit:          opts.limit,
      p_offset:         opts.offset,
    });
    if (error) throw error;

    const rows = (data ?? []) as unknown as UserListRow[];
    return {
      rows: rows
        .filter((r): r is UserListRow & { email: string; created_at: string } => r.email !== null)
        .map((r) => ({
          email:           r.email,
          name:            r.name ?? r.email,
          createdAt:       iso(r.created_at),
          unbookedCredits: r.unbooked_credits ?? 0,
          earliestExpiry:  isoOrNull(r.earliest_expiry),
          nextSession:     isoOrNull(r.next_session),
          bookingsCount:   r.bookings_count ?? 0,
          courses:         (r.courses ?? []).map((c) => ({ slug: c.slug, completedLessons: Number(c.completed) })),
          subscriptions:   (r.subscriptions ?? []).map((s): AdminUserSubscription => ({
            type:  s.type,
            areas: s.areas ?? null,
          })),
        })),
      counts: userCounts(rows[0]),
    };
  }

  async dashboardCounts(): Promise<AdminDashboardCounts> {
    const [upcoming, users, failed] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gt("starts_at", new Date().toISOString()),
      // p_limit 0: only the counts row comes back. No course map: no row needs progress.
      this.listUsers({ segment: "credits", courseLessons: {}, limit: 0, offset: 0 }),
      supabase
        .from("failed_bookings")
        .select("stripe_session_id", { count: "exact", head: true }),
    ]);
    if (upcoming.error) throw upcoming.error;
    if (failed.error) throw failed.error;

    return {
      upcomingBookings: upcoming.count ?? 0,
      usersWithCredits: users.counts.credits,
      failedBookings:   failed.count ?? 0,
    };
  }

  // ADMIN-02: the sidebar badges. Head counts only, so it stays cheap on every admin page.
  async navCounts(): Promise<AdminNavCounts> {
    const [failed, reports] = await Promise.all([
      supabase
        .from("failed_bookings")
        .select("stripe_session_id", { count: "exact", head: true }),
      supabase
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
    ]);
    if (failed.error) throw failed.error;
    if (reports.error) throw reports.error;

    return {
      failedBookings: failed.count ?? 0,
      openReports:    reports.count ?? 0,
    };
  }

  async sumRevenueSince(sinceIso: string): Promise<number> {
    const { data, error } = await supabase
      .from("payments")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gt("created_at", sinceIso);
    if (error) throw error;
    return (data ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  }

  async getStudent(email: string): Promise<StudentDetail | null> {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, created_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, email: data.email, name: data.name, createdAt: iso(data.created_at) };
  }

  async listCreditPacks(email: string): Promise<CreditPackRow[]> {
    const user = await this.getStudent(email);
    if (!user) return [];

    const { data, error } = await supabase
      .from("credit_packs")
      .select("id, pack_size, credits_remaining, expires_at, created_at, stripe_payment_id")
      .eq("user_id", user.id)
      .order("expires_at");
    if (error) throw error;
    return data ?? [];
  }

  async listStudentBookings(email: string): Promise<BookingRow[]> {
    const user = await this.getStudent(email);
    if (!user) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("id, session_type, starts_at, ends_at, status")
      .eq("user_id", user.id)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  }

  async listAllBookings(limit: number): Promise<AdminBookingRow[]> {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, join_token, session_type, starts_at, ends_at, status, users(email, name)")
      .order("starts_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? []).map((b) => {
      const user = joinedUser(b.users as JoinedUser);
      return {
        id:           b.id,
        join_token:   b.join_token ?? "",
        session_type: b.session_type,
        starts_at:    b.starts_at,
        ends_at:      b.ends_at,
        status:       b.status,
        email:        user?.email ?? "—",
        name:         user?.name ?? "—",
      };
    });
  }

  async listPayments(limit: number): Promise<AdminPaymentRow[]> {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount_cents, currency, status, checkout_type, created_at, stripe_payment_id, users(email, name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? []).map((p) => {
      const user = joinedUser(p.users as JoinedUser);
      return {
        id:                p.id,
        amount_cents:      p.amount_cents,
        currency:          p.currency,
        status:            p.status,
        checkout_type:     p.checkout_type,
        created_at:        p.created_at,
        stripe_payment_id: p.stripe_payment_id,
        email:             user?.email ?? "—",
        name:              user?.name ?? "—",
      };
    });
  }

  async listCourseReaders(opts: ListCourseReadersQuery): Promise<CourseReaderPage> {
    const { data, error } = await supabase.rpc("admin_list_course_users", {
      p_course_slug:  opts.courseSlug,
      p_lessons:      opts.lessons,
      p_status:       opts.status,
      p_active_since: opts.activeSince,
      p_limit:        opts.limit,
      p_offset:       opts.offset,
    });
    if (error) throw error;

    const rows  = (data ?? []) as unknown as CourseReaderListRow[];
    const first = rows[0];
    return {
      rows: rows
        .filter((r): r is CourseReaderListRow & {
          email: string; enrolled_at: string; last_activity_at: string; status: CourseReaderStatus;
        } => r.email !== null)
        .map((r) => ({
          email:            r.email,
          name:             r.name ?? r.email,
          enrolledAt:       iso(r.enrolled_at),
          completedLessons: r.completed_lessons ?? 0,
          lastLessonSlug:   r.last_lesson_slug,
          lastActivityAt:   iso(r.last_activity_at),
          status:           r.status,
        })),
      counts: {
        all:      Number(first?.total_count ?? 0),
        active:   Number(first?.active_count ?? 0),
        finished: Number(first?.finished_count ?? 0),
        inactive: Number(first?.inactive_count ?? 0),
      },
      // NUMERIC arrives as a string through PostgREST.
      avgCompletedLessons: Number(first?.avg_completed ?? 0),
    };
  }

  async courseLessonStats(courseSlug: string): Promise<LessonStatRow[]> {
    const { data, error } = await supabase.rpc("admin_course_lesson_stats", {
      p_course_slug: courseSlug,
    });
    if (error) throw error;

    return (data ?? []).map((r) => ({
      lessonSlug: r.lesson_slug,
      started:    Number(r.started_count),
      completed:  Number(r.completed_count),
    }));
  }

  async listUserSubscriptions(email: string): Promise<AdminUserSubscriptionDetail[]> {
    const user = await this.getStudent(email);
    if (!user) return [];

    const { data, error } = await supabase
      .from("subscriptions")
      .select("type, areas, created_at")
      .eq("user_id", user.id)
      .order("type");
    if (error) throw error;

    return (data ?? []).map((s) => ({
      type:      s.type as SubscriptionType,
      areas:     (s.areas as BlogArea[] | null) ?? null,
      createdAt: iso(s.created_at),
    }));
  }
}
