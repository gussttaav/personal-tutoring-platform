// REFACTOR-R4-P3-02: In-memory IAdminQueryRepository.
// SupabaseAdminQueryRepository.test.ts pins the SQL itself.
//
// ADMIN-USERS-01: listUsers mirrors admin_list_users (migration 0027): every user but the
// admin, the tab counts taken before the tab filter and the page window, the per-tab sort
// orders, and course progress counting only the published lessons the caller passes.
// listCourseReaders / courseLessonStats mirror admin_list_course_users /
// admin_course_lesson_stats.
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
  AdminUserSegment,
  AdminUserSubscriptionDetail,
  BlogArea,
  BookingRow,
  CourseReaderPage,
  CourseReaderRow,
  CourseReaderStatus,
  CreditPackRow,
  StudentDetail,
  SubscriptionType,
} from "@/domain/types";

type StoredUser    = StudentDetail & { role: "student" | "admin" };
type StoredPack    = CreditPackRow & { user_id: string };
type StoredBooking = BookingRow & { user_id: string; join_token: string; created_at: string };
type StoredPayment = Omit<AdminPaymentRow, "email" | "name"> & { user_id: string };

interface StoredEnrollment { userId: string; courseSlug: string; enrolledAt: string }
interface StoredProgress {
  userId:     string;
  courseSlug: string;
  lessonSlug: string;
  status:     "started" | "completed";
  lastSeenAt: string;
}
interface StoredSubscription {
  userId:    string;
  type:      SubscriptionType;
  areas:     BlogArea[] | null;
  createdAt: string;
}

type Enriched = AdminUserRow & {
  id:                 string;
  lastBookedAt:       string | null;
  lastCourseActivity: string | null;
  lastSubscribedAt:   string | null;
};

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : NaN);
const maxIso = (values: (string | null | undefined)[]): string | null =>
  values.filter((v): v is string => !!v).sort().at(-1) ?? null;
const minIso = (values: (string | null | undefined)[]): string | null =>
  values.filter((v): v is string => !!v).sort()[0] ?? null;

/** a before b → negative, NULLs last (ASC). */
const asc = (a: string | null, b: string | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1;
/** a after b → negative, NULLs last (DESC). */
const desc = (a: string | null, b: string | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a > b ? -1 : 1;

export class InMemoryAdminQueryRepository implements IAdminQueryRepository {
  private users:         StoredUser[]         = [];
  private packs:         StoredPack[]         = [];
  private bookings:      StoredBooking[]      = [];
  private payments:      StoredPayment[]      = [];
  private enrollments:   StoredEnrollment[]   = [];
  private progress:      StoredProgress[]     = [];
  private subscriptions: StoredSubscription[] = [];
  failedBookings = 0;
  openReports    = 0;
  /** ADMIN-02: set to make navCounts() reject, as a Supabase read error would. */
  navCountsError: Error | null = null;
  /** Every listUsers / listCourseReaders call, so tests can assert what the service sent. */
  readonly listCalls:       ListUsersQuery[]         = [];
  readonly courseListCalls: ListCourseReadersQuery[] = [];

  // ─── Seeding (fixture-only) ─────────────────────────────────────────────────

  addUser(
    email: string,
    name = "",
    opts: { createdAt?: string; role?: "student" | "admin" } = {},
  ): string {
    const id = `user-${this.users.length + 1}`;
    // Distinct, increasing timestamps by default, so "newest account first" is decidable.
    const createdAt = opts.createdAt ?? new Date(Date.UTC(2026, 0, 1) + this.users.length * 60_000).toISOString();
    this.users.push({ id, email, name, createdAt, role: opts.role ?? "student" });
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

  addBooking(
    email: string,
    booking: { startsAt: string; status?: string; sessionType?: string; createdAt?: string },
  ): void {
    const n = this.bookings.length + 1;
    this.bookings.push({
      id:           `booking-${n}`,
      user_id:      this.idOf(email),
      join_token:   `join-${n}`,
      session_type: booking.sessionType ?? "session1h",
      starts_at:    booking.startsAt,
      ends_at:      new Date(new Date(booking.startsAt).getTime() + 3_600_000).toISOString(),
      status:       booking.status ?? "confirmed",
      created_at:   booking.createdAt ?? new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
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

  addEnrollment(email: string, courseSlug: string, enrolledAt: string): void {
    this.enrollments.push({ userId: this.idOf(email), courseSlug, enrolledAt });
  }

  /** A lesson view (`started`) or completion. Enrolls the user first if needed, like
   *  CourseService does. */
  addLessonProgress(
    email: string,
    courseSlug: string,
    lessonSlug: string,
    progress: { status?: "started" | "completed"; lastSeenAt: string },
  ): void {
    const userId = this.idOf(email);
    if (!this.enrollments.some((e) => e.userId === userId && e.courseSlug === courseSlug)) {
      this.enrollments.push({ userId, courseSlug, enrolledAt: progress.lastSeenAt });
    }
    this.progress.push({
      userId, courseSlug, lessonSlug,
      status:     progress.status ?? "started",
      lastSeenAt: progress.lastSeenAt,
    });
  }

  addSubscription(email: string, type: SubscriptionType, opts: { areas?: BlogArea[] | null; createdAt?: string } = {}): void {
    this.subscriptions.push({
      userId:    this.idOf(email),
      type,
      areas:     opts.areas ?? null,
      createdAt: opts.createdAt ?? new Date(Date.UTC(2026, 0, 1) + this.subscriptions.length * 60_000).toISOString(),
    });
  }

  private idOf(email: string): string {
    const user = this.users.find((u) => u.email === email);
    if (!user) throw new Error(`InMemoryAdminQueryRepository: no user ${email}`);
    return user.id;
  }

  private findUser(email: string): StoredUser | undefined {
    return this.users.find((u) => u.email === email);
  }

  // ─── IAdminQueryRepository ──────────────────────────────────────────────────

  async listUsers(opts: ListUsersQuery): Promise<{ rows: AdminUserRow[]; counts: AdminUserCounts }> {
    this.listCalls.push(opts);
    const now = Date.now();
    const q   = opts.query?.toLowerCase();

    const enriched: Enriched[] = this.users
      .filter((u) => u.role !== "admin")
      .filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .map((u) => {
        const active   = this.packs.filter((p) => p.user_id === u.id && time(p.expires_at) > now);
        const kept     = this.bookings.filter((b) => b.user_id === u.id && b.status !== "cancelled");
        const upcoming = this.bookings.filter(
          (b) => b.user_id === u.id && b.status === "confirmed" && time(b.starts_at) > now,
        );
        const enrolled = this.enrollments.filter((e) => e.userId === u.id);
        const subs     = this.subscriptions.filter((s) => s.userId === u.id);

        return {
          id:              u.id,
          email:           u.email,
          name:            u.name || u.email,
          createdAt:       u.createdAt,
          unbookedCredits: active.reduce((sum, p) => sum + p.credits_remaining, 0),
          earliestExpiry:  minIso(active.filter((p) => p.credits_remaining > 0).map((p) => p.expires_at)),
          nextSession:     minIso(upcoming.map((b) => b.starts_at)),
          bookingsCount:   kept.length,
          lastBookedAt:    maxIso(kept.map((b) => b.created_at)),
          lastCourseActivity: enrolled.length === 0 ? null : maxIso(
            enrolled.flatMap((e) => [
              e.enrolledAt,
              ...this.progress
                .filter((p) => p.userId === u.id && p.courseSlug === e.courseSlug)
                .map((p) => p.lastSeenAt),
            ]),
          ),
          lastSubscribedAt: maxIso(subs.map((s) => s.createdAt)),
          courses: [...enrolled]
            .sort((a, b) => asc(a.enrolledAt, b.enrolledAt))
            .map((e) => {
              const published = new Set(opts.courseLessons[e.courseSlug] ?? []);
              return {
                slug:             e.courseSlug,
                completedLessons: this.progress.filter(
                  (p) => p.userId === u.id && p.courseSlug === e.courseSlug
                    && p.status === "completed" && published.has(p.lessonSlug),
                ).length,
              };
            }),
          subscriptions: [...subs]
            .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))
            .map((s) => ({ type: s.type, areas: s.areas })),
        };
      });

    const inSegment: Record<AdminUserSegment, (e: Enriched) => boolean> = {
      all:        () => true,
      credits:    (e) => e.unbookedCredits > 0,
      upcoming:   (e) => e.nextSession !== null,
      booked:     (e) => e.bookingsCount > 0,
      courses:    (e) => e.lastCourseActivity !== null,
      subscribed: (e) => e.lastSubscribedAt !== null,
    };
    const order: Partial<Record<AdminUserSegment, (a: Enriched, b: Enriched) => number>> = {
      credits:    (a, b) => asc(a.earliestExpiry, b.earliestExpiry),
      upcoming:   (a, b) => asc(a.nextSession, b.nextSession),
      booked:     (a, b) => desc(a.lastBookedAt, b.lastBookedAt),
      courses:    (a, b) => desc(a.lastCourseActivity, b.lastCourseActivity),
      subscribed: (a, b) => desc(a.lastSubscribedAt, b.lastSubscribedAt),
    };
    const byTab = order[opts.segment];

    const counts = Object.fromEntries(
      (Object.keys(inSegment) as AdminUserSegment[]).map((s) => [s, enriched.filter(inSegment[s]).length]),
    ) as AdminUserCounts;

    const rows = enriched
      .filter(inSegment[opts.segment] ?? inSegment.all)
      .sort((a, b) =>
        (byTab?.(a, b) || 0)
        || desc(a.createdAt, b.createdAt)
        || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
      .slice(opts.offset, opts.offset + opts.limit)
      .map(({ id: _id, lastBookedAt: _b, lastCourseActivity: _c, lastSubscribedAt: _s, ...row }) => row);

    return { rows, counts };
  }

  async dashboardCounts(): Promise<AdminDashboardCounts> {
    const now = Date.now();
    const { counts } = await this.listUsers({ segment: "credits", courseLessons: {}, limit: 0, offset: 0 });
    return {
      upcomingBookings: this.bookings.filter(
        (b) => b.status === "confirmed" && time(b.starts_at) > now,
      ).length,
      usersWithCredits: counts.credits,
      failedBookings:   this.failedBookings,
    };
  }

  async navCounts(): Promise<AdminNavCounts> {
    if (this.navCountsError) throw this.navCountsError;
    return { failedBookings: this.failedBookings, openReports: this.openReports };
  }

  async sumRevenueSince(sinceIso: string): Promise<number> {
    const since = time(sinceIso);
    return this.payments
      .filter((p) => p.status === "succeeded" && time(p.created_at) > since)
      .reduce((sum, p) => sum + p.amount_cents, 0);
  }

  async getStudent(email: string): Promise<StudentDetail | null> {
    const user = this.findUser(email);
    if (!user) return null;
    const { role: _role, ...detail } = user;
    return detail;
  }

  async listCreditPacks(email: string): Promise<CreditPackRow[]> {
    const user = this.findUser(email);
    if (!user) return [];
    return this.packs
      .filter((p) => p.user_id === user.id)
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
      .map(({ user_id: _userId, ...row }) => row);
  }

  async listStudentBookings(email: string): Promise<BookingRow[]> {
    const user = this.findUser(email);
    if (!user) return [];
    return this.bookings
      .filter((b) => b.user_id === user.id)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, 50)
      .map(({ user_id: _userId, join_token: _joinToken, created_at: _createdAt, ...row }) => row);
  }

  async listAllBookings(limit: number): Promise<AdminBookingRow[]> {
    return [...this.bookings]
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, limit)
      .map(({ user_id, created_at: _createdAt, ...row }) => {
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

  async listCourseReaders(opts: ListCourseReadersQuery): Promise<CourseReaderPage> {
    this.courseListCalls.push(opts);
    const published   = new Set(opts.lessons);
    const activeSince = time(opts.activeSince);

    const readers: CourseReaderRow[] = this.enrollments
      .filter((e) => e.courseSlug === opts.courseSlug)
      .flatMap((e) => {
        const user = this.users.find((u) => u.id === e.userId);
        if (!user || user.role === "admin") return [];

        const rows = this.progress.filter((p) => p.userId === e.userId && p.courseSlug === e.courseSlug);
        const completedLessons = rows.filter((p) => p.status === "completed" && published.has(p.lessonSlug)).length;
        const lastPublished = [...rows]
          .filter((p) => published.has(p.lessonSlug))
          .sort((a, b) => desc(a.lastSeenAt, b.lastSeenAt))[0];
        const lastActivityAt = maxIso([e.enrolledAt, ...rows.map((p) => p.lastSeenAt)])!;
        const status: CourseReaderStatus =
          published.size > 0 && completedLessons >= published.size ? "finished"
          : time(lastActivityAt) >= activeSince ? "active"
          : "inactive";

        return [{
          email:          user.email,
          name:           user.name || user.email,
          enrolledAt:     e.enrolledAt,
          completedLessons,
          lastLessonSlug: lastPublished?.lessonSlug ?? null,
          lastActivityAt,
          status,
        }];
      });

    const counts = {
      all:      readers.length,
      active:   readers.filter((r) => r.status === "active").length,
      finished: readers.filter((r) => r.status === "finished").length,
      inactive: readers.filter((r) => r.status === "inactive").length,
    };
    const avgCompletedLessons = readers.length === 0
      ? 0
      : readers.reduce((sum, r) => sum + r.completedLessons, 0) / readers.length;

    const rows = readers
      .filter((r) => opts.status === "all" || r.status === opts.status)
      .sort((a, b) =>
        desc(a.lastActivityAt, b.lastActivityAt) || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
      .slice(opts.offset, opts.offset + opts.limit);

    return { rows, counts, avgCompletedLessons };
  }

  async courseLessonStats(courseSlug: string): Promise<LessonStatRow[]> {
    const stats = new Map<string, LessonStatRow>();
    for (const p of this.progress) {
      if (p.courseSlug !== courseSlug) continue;
      if (this.users.find((u) => u.id === p.userId)?.role === "admin") continue;
      const row = stats.get(p.lessonSlug) ?? { lessonSlug: p.lessonSlug, started: 0, completed: 0 };
      row.started++;
      if (p.status === "completed") row.completed++;
      stats.set(p.lessonSlug, row);
    }
    return [...stats.values()];
  }

  async listUserSubscriptions(email: string): Promise<AdminUserSubscriptionDetail[]> {
    const user = this.findUser(email);
    if (!user) return [];
    return this.subscriptions
      .filter((s) => s.userId === user.id)
      .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))
      .map(({ type, areas, createdAt }) => ({ type, areas, createdAt }));
  }
}
