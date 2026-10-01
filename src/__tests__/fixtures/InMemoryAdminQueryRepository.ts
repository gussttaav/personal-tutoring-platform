// REFACTOR-R4-P3-02: In-memory IAdminQueryRepository. listStudents mirrors the
// admin_list_students RPC (migration 0024): students are users with a booking or a pack,
// credits count non-expired packs only, both counts are taken before the low-credit
// filter and the page window. SupabaseAdminQueryRepository.test.ts pins the SQL itself.
import type { IAdminQueryRepository, ListStudentsQuery } from "@/domain/repositories/IAdminQueryRepository";
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminPaymentRow,
  BookingRow,
  CreditPackRow,
  StudentDetail,
  StudentListPage,
  StudentSummary,
} from "@/domain/types";

type StoredPack    = CreditPackRow & { user_id: string };
type StoredBooking = BookingRow & { user_id: string; join_token: string };
type StoredPayment = Omit<AdminPaymentRow, "email" | "name"> & { user_id: string };

export class InMemoryAdminQueryRepository implements IAdminQueryRepository {
  private users:    StudentDetail[] = [];
  private packs:    StoredPack[]    = [];
  private bookings: StoredBooking[] = [];
  private payments: StoredPayment[] = [];
  failedBookings = 0;
  /** Every listStudents call, so tests can assert the page → offset mapping. */
  readonly listCalls: ListStudentsQuery[] = [];

  // ─── Seeding (fixture-only) ─────────────────────────────────────────────────

  addUser(email: string, name = ""): string {
    const id = `user-${this.users.length + 1}`;
    this.users.push({ id, email, name });
    return id;
  }

  addPack(email: string, pack: { credits: number; expiresAt: string; packSize?: number }): void {
    this.packs.push({
      id:                `pack-${this.packs.length + 1}`,
      user_id:           this.idOf(email),
      pack_size:         pack.packSize ?? 5,
      credits_remaining: pack.credits,
      expires_at:        pack.expiresAt,
      created_at:        new Date().toISOString(),
      stripe_payment_id: `pi_${this.packs.length + 1}`,
    });
  }

  addBooking(email: string, booking: { startsAt: string; status?: string }): void {
    const n = this.bookings.length + 1;
    this.bookings.push({
      id:           `booking-${n}`,
      user_id:      this.idOf(email),
      join_token:   `join-${n}`,
      session_type: "session1h",
      starts_at:    booking.startsAt,
      ends_at:      new Date(new Date(booking.startsAt).getTime() + 3_600_000).toISOString(),
      status:       booking.status ?? "confirmed",
    });
  }

  addPayment(email: string, payment: { amountCents: number; status?: string; createdAt: string }): void {
    const n = this.payments.length + 1;
    this.payments.push({
      id:                `payment-${n}`,
      user_id:           this.idOf(email),
      amount_cents:      payment.amountCents,
      currency:          "eur",
      status:            payment.status ?? "succeeded",
      checkout_type:     "single",
      created_at:        payment.createdAt,
      stripe_payment_id: `pi_pay_${n}`,
    });
  }

  private idOf(email: string): string {
    const user = this.users.find((u) => u.email === email);
    if (!user) throw new Error(`InMemoryAdminQueryRepository: no user ${email}`);
    return user.id;
  }

  // ─── IAdminQueryRepository ──────────────────────────────────────────────────

  async listStudents(opts: ListStudentsQuery): Promise<StudentListPage> {
    this.listCalls.push(opts);
    const now = Date.now();
    const q   = opts.query?.toLowerCase();

    const students: StudentSummary[] = this.users
      .filter((u) =>
        this.bookings.some((b) => b.user_id === u.id) || this.packs.some((p) => p.user_id === u.id))
      .filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .map((u) => {
        const active   = this.packs.filter((p) => p.user_id === u.id && new Date(p.expires_at).getTime() > now);
        const expiries = active.filter((p) => p.credits_remaining > 0).map((p) => p.expires_at).sort();
        const upcoming = this.bookings
          .filter((b) => b.user_id === u.id && b.status === "confirmed" && new Date(b.starts_at).getTime() > now)
          .map((b) => b.starts_at)
          .sort();
        return {
          email:          u.email,
          name:           u.name || u.email,
          totalCredits:   active.reduce((sum, p) => sum + p.credits_remaining, 0),
          earliestExpiry: expiries[0] ?? null,
          nextSession:    upcoming[0] ?? null,
        };
      })
      .sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0));

    const low     = students.filter((s) => s.totalCredits <= 1);
    const visible = opts.lowCredit ? low : students;
    return {
      rows:           visible.slice(opts.offset, opts.offset + opts.limit),
      total:          students.length,
      lowCreditTotal: low.length,
    };
  }

  async dashboardCounts(): Promise<AdminDashboardCounts> {
    const now = Date.now();
    const { lowCreditTotal } = await this.listStudents({ lowCredit: true, limit: 0, offset: 0 });
    return {
      upcomingBookings:  this.bookings.filter(
        (b) => b.status === "confirmed" && new Date(b.starts_at).getTime() > now,
      ).length,
      lowCreditStudents: lowCreditTotal,
      failedBookings:    this.failedBookings,
    };
  }

  async sumRevenueSince(sinceIso: string): Promise<number> {
    const since = new Date(sinceIso).getTime();
    return this.payments
      .filter((p) => p.status === "succeeded" && new Date(p.created_at).getTime() > since)
      .reduce((sum, p) => sum + p.amount_cents, 0);
  }

  async getStudent(email: string): Promise<StudentDetail | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async listCreditPacks(email: string): Promise<CreditPackRow[]> {
    const user = await this.getStudent(email);
    if (!user) return [];
    return this.packs
      .filter((p) => p.user_id === user.id)
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
      .map(({ user_id: _userId, ...row }) => row);
  }

  async listStudentBookings(email: string): Promise<BookingRow[]> {
    const user = await this.getStudent(email);
    if (!user) return [];
    return this.bookings
      .filter((b) => b.user_id === user.id)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, 50)
      .map(({ user_id: _userId, join_token: _joinToken, ...row }) => row);
  }

  async listAllBookings(limit: number): Promise<AdminBookingRow[]> {
    return [...this.bookings]
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, limit)
      .map(({ user_id, ...row }) => {
        const user = this.users.find((u) => u.id === user_id);
        return { ...row, email: user?.email ?? "—", name: user?.name ?? "—" };
      });
  }

  async listPayments(limit: number): Promise<AdminPaymentRow[]> {
    return [...this.payments]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(({ user_id, ...row }) => {
        const user = this.users.find((u) => u.id === user_id);
        return { ...row, email: user?.email ?? "—", name: user?.name ?? "—" };
      });
  }
}
