// REFACTOR-R4-P3-02: Supabase implementation of IAdminQueryRepository. Absorbs
// the admin panel's `_data.ts` (ADMIN-01, deleted), with two changes:
//   - the student list is the admin_list_students RPC (migration 0024): students only,
//     searched and paginated in Postgres, instead of `users ORDER BY email LIMIT 100`
//     filtered in the browser;
//   - read errors throw (repository convention) instead of rendering as empty lists and
//     zero counts.
// The bookings/payments lists keep their "latest N" shape unchanged.
import type { IAdminQueryRepository, ListStudentsQuery } from "@/domain/repositories/IAdminQueryRepository";
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminPaymentRow,
  BookingRow,
  CreditPackRow,
  StudentDetail,
  StudentListPage,
} from "@/domain/types";
import { supabase } from "./client";

// The generated types mark every RETURNS TABLE column non-null. They are not: the dates
// are NULL for a student with no active pack / upcoming class, and a page with no rows
// comes back as one counts-only row whose student columns are all NULL (see 0024).
interface StudentListRow {
  email:            string | null;
  name:             string | null;
  total_credits:    number | null;
  earliest_expiry:  string | null;
  next_session:     string | null;
  total_count:      number;
  low_credit_count: number;
}

type JoinedUser = { email: string; name: string } | { email: string; name: string }[] | null;

function joinedUser(users: JoinedUser): { email: string; name: string } | null {
  return (Array.isArray(users) ? users[0] : users) ?? null;
}

export class SupabaseAdminQueryRepository implements IAdminQueryRepository {
  async listStudents(opts: ListStudentsQuery): Promise<StudentListPage> {
    const { data, error } = await supabase.rpc("admin_list_students", {
      p_query:      opts.query,
      p_low_credit: opts.lowCredit,
      p_limit:      opts.limit,
      p_offset:     opts.offset,
    });
    if (error) throw error;

    const rows = (data ?? []) as StudentListRow[];
    return {
      rows: rows
        .filter((r): r is StudentListRow & { email: string } => r.email !== null)
        .map((r) => ({
          email:          r.email,
          name:           r.name ?? r.email,
          totalCredits:   r.total_credits ?? 0,
          earliestExpiry: r.earliest_expiry,
          nextSession:    r.next_session,
        })),
      total:          Number(rows[0]?.total_count ?? 0),
      lowCreditTotal: Number(rows[0]?.low_credit_count ?? 0),
    };
  }

  async dashboardCounts(): Promise<AdminDashboardCounts> {
    const [upcoming, students, failed] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gt("starts_at", new Date().toISOString()),
      // p_limit 0: only the counts row comes back.
      this.listStudents({ lowCredit: true, limit: 0, offset: 0 }),
      supabase
        .from("failed_bookings")
        .select("stripe_session_id", { count: "exact", head: true }),
    ]);
    if (upcoming.error) throw upcoming.error;
    if (failed.error) throw failed.error;

    return {
      upcomingBookings:  upcoming.count ?? 0,
      lowCreditStudents: students.lowCreditTotal,
      failedBookings:    failed.count ?? 0,
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
      .select("id, email, name")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
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
}
