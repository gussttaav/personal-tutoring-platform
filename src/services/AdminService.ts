// REFACTOR-R4-P3-02: the admin panel's service. A thin read facade over
// IAdminQueryRepository (which absorbed the admin panel's `_data.ts`), plus the
// manual credit adjustment that used to live in POST /api/admin/students/[email].
//
// ADMIN-USERS-01: the students list became a users list with tabs (listUsers), and the
// course views were added (listCourses, getCourseReaders, getCourseLessonStats, and a
// user's own courses and subscriptions). The repository counts completed lessons; this
// service supplies what only the content registry knows (IAdminCourseCatalog): which
// lessons are published, the titles, and whether a course is fully written. A user's own
// courses come from CourseService.listEnrollments, the figures the reader sees.
import type { IAdminCourseCatalog, AdminCatalogCourse } from "@/domain/repositories/IAdminCourseCatalog";
import type { IAdminQueryRepository } from "@/domain/repositories/IAdminQueryRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type {
  AdminBookingRow,
  AdminCourseReaderList,
  AdminCourseSummary,
  AdminDashboardCounts,
  AdminLessonStatsBlock,
  AdminNavCounts,
  AdminPaymentRow,
  AdminUserCourse,
  AdminUserCourseProgress,
  AdminUserListPage,
  AdminUserSegment,
  AdminUserSubscriptionDetail,
  AuditEntry,
  BookingRow,
  CourseReaderFilter,
  CourseReaderPage,
  CourseReaderStatus,
  CreditAdjustment,
  CreditPackRow,
  StudentDetail,
} from "@/domain/types";
import { InsufficientCreditsError } from "@/domain/errors";
import { log } from "@/lib/logger";
import type { CourseService } from "./CourseService";
import type { CreditService } from "./CreditService";
import type { PricingService } from "./PricingService";

/** Rows per /admin/students page. */
export const STUDENTS_PAGE_SIZE = 50;
/** Rows per /admin/courses/<slug> page. */
export const COURSE_READERS_PAGE_SIZE = 50;
/** A reader with no activity for this long, and not finished, is "sin actividad". */
export const COURSE_ACTIVE_DAYS = 30;
/** The bookings and payments lists show the latest N, newest first (not paginated). */
export const RECENT_LIST_LIMIT = 100;
/** Audit entries on a student's detail page. */
export const STUDENT_AUDIT_LIMIT = 50;
/** The dashboard's revenue card window. */
export const REVENUE_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** 0–100, rounded; 0 for a course with nothing published. CourseService's own formula. */
const percentOf = (completed: number, total: number): number =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

/** A 1-based page (anything else reads as 1) and a non-negative size, as limit/offset. */
function pageWindow(page: number, pageSize: number): { limit: number; offset: number } {
  const p     = Number.isInteger(page) && page >= 1 ? page : 1;
  const limit = Math.max(0, Math.floor(pageSize));
  return { limit, offset: (p - 1) * limit };
}

export class AdminService {
  constructor(
    private readonly queries: IAdminQueryRepository,
    private readonly credits: CreditService,
    private readonly pricing: PricingService,
    private readonly audit:   IAuditRepository,
    private readonly courses: CourseService,
    private readonly catalog: IAdminCourseCatalog,
  ) {}

  dashboardCounts(): Promise<AdminDashboardCounts> {
    return this.queries.dashboardCounts();
  }

  /**
   * ADMIN-02: the sidebar badges. Read by the admin layout on every page, so a failure
   * here must not take the panel down: it logs and answers null, and the sidebar
   * renders without badges. Nothing gates on these numbers; they are a nudge only.
   */
  async navCounts(): Promise<AdminNavCounts | null> {
    try {
      return await this.queries.navCounts();
    } catch (err) {
      log("warn", "Admin nav counts unavailable; rendering the sidebar without badges", {
        service: "AdminService", err: String(err),
      });
      return null;
    }
  }

  revenueLast30Days(): Promise<number> {
    const since = new Date(Date.now() - REVENUE_WINDOW_DAYS * DAY_MS).toISOString();
    return this.queries.sumRevenueSince(since);
  }

  /** One page (1-based) of a users tab, searched by email/name fragment. A blank query
   *  lists everyone; a page below 1 or not a whole number reads as page 1. Each row's
   *  courses carry their title and progress against the published lessons. */
  async listUsers(opts: {
    query?:   string;
    segment:  AdminUserSegment;
    page:     number;
    pageSize: number;
  }): Promise<AdminUserListPage> {
    const catalog = new Map(this.catalog.listCourses().map((c) => [c.slug, c]));
    const courseLessons = Object.fromEntries(
      [...catalog.values()].map((c) => [c.slug, c.lessons.map((l) => l.slug)]),
    );

    const { rows, counts } = await this.queries.listUsers({
      query:   opts.query?.trim() || undefined,
      segment: opts.segment,
      courseLessons,
      ...pageWindow(opts.page, opts.pageSize),
    });

    return {
      counts,
      rows: rows.map((row) => ({
        ...row,
        courses: row.courses.map((c): AdminUserCourse => {
          const course = catalog.get(c.slug);
          const total  = course?.lessons.length ?? 0;
          return {
            slug:             c.slug,
            title:            course?.title ?? c.slug,
            completedLessons: c.completedLessons,
            totalLessons:     total,
            percent:          percentOf(c.completedLessons, total),
          };
        }),
      })),
    };
  }

  /** Every published course with its reader counts and average progress (/admin/courses). */
  listCourses(): Promise<AdminCourseSummary[]> {
    const activeSince = this.activeSince();
    return Promise.all(
      this.catalog.listCourses().map(async (course) => {
        const page = await this.queries.listCourseReaders({
          courseSlug: course.slug,
          lessons:    course.lessons.map((l) => l.slug),
          status:     "all",
          activeSince,
          limit:      0,
          offset:     0,
        });
        return courseSummary(course, page);
      }),
    );
  }

  /** One page of a course's readers, or `null` for a course that is not published. */
  async getCourseReaders(
    courseSlug: string,
    opts: { status: CourseReaderFilter; page: number; pageSize: number },
  ): Promise<AdminCourseReaderList | null> {
    const course = this.catalog.getCourse(courseSlug);
    if (!course) return null;

    const page = await this.queries.listCourseReaders({
      courseSlug,
      lessons:     course.lessons.map((l) => l.slug),
      status:      opts.status,
      activeSince: this.activeSince(),
      ...pageWindow(opts.page, opts.pageSize),
    });
    const titles = new Map(course.lessons.map((l) => [l.slug, l.title]));

    return {
      course: courseSummary(course, page),
      rows:   page.rows.map((r) => ({
        ...r,
        percent:         percentOf(r.completedLessons, course.lessons.length),
        lastLessonTitle: r.lastLessonSlug ? titles.get(r.lastLessonSlug) ?? null : null,
      })),
    };
  }

  /** How many readers opened and completed each published lesson, block by block, in
   *  reading order. `null` for a course that is not published. */
  async getCourseLessonStats(courseSlug: string): Promise<AdminLessonStatsBlock[] | null> {
    const course = this.catalog.getCourse(courseSlug);
    if (!course) return null;

    const stats = new Map(
      (await this.queries.courseLessonStats(courseSlug)).map((s) => [s.lessonSlug, s]),
    );
    return course.blocks
      .map((block) => ({
        id:      block.id,
        title:   block.title,
        lessons: course.lessons
          .filter((l) => l.block === block.id)
          .map((l) => ({
            slug:      l.slug,
            title:     l.title,
            started:   stats.get(l.slug)?.started ?? 0,
            completed: stats.get(l.slug)?.completed ?? 0,
          })),
      }))
      .filter((block) => block.lessons.length > 0);
  }

  /** The user's courses on their detail page, with the progress the reader sees and the
   *  status the course's reader list would give them (admin_list_course_users, 0027). */
  async listUserCourses(email: string): Promise<AdminUserCourseProgress[]> {
    const summaries   = await this.courses.listEnrollments(email);
    const activeSince = new Date(this.activeSince()).getTime();
    return summaries.map((s) => {
      const course = this.catalog.getCourse(s.courseSlug);
      const lastLessonTitle = s.lastSeenLessonSlug
        ? course?.lessons.find((l) => l.slug === s.lastSeenLessonSlug)?.title ?? null
        : null;
      const lastActivity = Math.max(
        s.lastSeenAt ? new Date(s.lastSeenAt).getTime() : 0,
        s.enrolledAt ? new Date(s.enrolledAt).getTime() : 0,
      );
      const status: CourseReaderStatus =
        s.totalLessons > 0 && s.completedLessons >= s.totalLessons ? "finished"
        : lastActivity >= activeSince ? "active"
        : "inactive";
      return {
        slug:             s.courseSlug,
        title:            course?.title ?? s.courseSlug,
        completedLessons: s.completedLessons,
        totalLessons:     s.totalLessons,
        percent:          s.percentComplete,
        status,
        courseComplete:   course?.complete ?? false,
        lastLessonTitle,
        lastSeenAt:       s.lastSeenAt,
        enrolledAt:       s.enrolledAt,
      };
    });
  }

  listUserSubscriptions(email: string): Promise<AdminUserSubscriptionDetail[]> {
    return this.queries.listUserSubscriptions(email);
  }

  private activeSince(): string {
    return new Date(Date.now() - COURSE_ACTIVE_DAYS * DAY_MS).toISOString();
  }

  getStudent(email: string): Promise<StudentDetail | null> {
    return this.queries.getStudent(email);
  }

  listCreditPacks(email: string): Promise<CreditPackRow[]> {
    return this.queries.listCreditPacks(email);
  }

  listStudentBookings(email: string): Promise<BookingRow[]> {
    return this.queries.listStudentBookings(email);
  }

  listAuditLog(email: string): Promise<AuditEntry[]> {
    return this.audit.list(email, STUDENT_AUDIT_LIMIT);
  }

  listAllBookings(): Promise<AdminBookingRow[]> {
    return this.queries.listAllBookings(RECENT_LIST_LIMIT);
  }

  listPayments(): Promise<AdminPaymentRow[]> {
    return this.queries.listPayments(RECENT_LIST_LIMIT);
  }

  // REFACTOR-R4-P3-02: moved out of POST /api/admin/students/[email]. A debit stops at the
  // student's real balance and says so, instead of swallowing InsufficientCreditsError.
  // Any other failure propagates: the credits already taken stay taken (each one has its
  // own "decrement" audit entry from CreditService), and no admin_adjust entry is written.
  async adjustCredits(params: {
    email:  string;
    amount: number;
    reason: string;
    by:     string;
  }): Promise<CreditAdjustment> {
    const { email, amount, reason, by } = params;
    let applied = 0;

    if (amount > 0) {
      // Manually-granted credits get the same validity window as purchased packs.
      const days      = await this.pricing.getPackValidityDays();
      const expiresAt = new Date(Date.now() + days * DAY_MS).toISOString();
      await this.credits.addCredits({
        email,
        name:            "",
        amount,
        packLabel:       `Ajuste manual: ${reason}`,
        // Unique credit_packs.stripe_payment_id for a pack no Stripe payment backs.
        stripeSessionId: `manual-${crypto.randomUUID()}`,
        expiresAt,
      });
      applied = amount;
    } else {
      for (let i = 0; i < -amount; i++) {
        try {
          await this.credits.useCredit(email);
          applied--;
        } catch (err) {
          if (err instanceof InsufficientCreditsError) break;
          throw err;
        }
      }
    }

    // Admin attribution, on top of the purchase/decrement entries CreditService wrote.
    await this.audit.append(email, { action: "admin_adjust", amount, applied, reason, by });
    return { requested: amount, applied };
  }
}

function courseSummary(course: AdminCatalogCourse, page: CourseReaderPage): AdminCourseSummary {
  return {
    slug:         course.slug,
    title:        course.title,
    totalLessons: course.lessons.length,
    complete:     course.complete,
    counts:       page.counts,
    avgPercent:   percentOf(page.avgCompletedLessons, course.lessons.length),
  };
}
