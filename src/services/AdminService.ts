// REFACTOR-R4-P3-02: the admin panel's service. A thin read facade over
// IAdminQueryRepository (which absorbed the admin panel's `_data.ts`), plus the
// manual credit adjustment that used to live in POST /api/admin/students/[email].
import type { IAdminQueryRepository } from "@/domain/repositories/IAdminQueryRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type {
  AdminBookingRow,
  AdminDashboardCounts,
  AdminNavCounts,
  AdminPaymentRow,
  AuditEntry,
  BookingRow,
  CreditAdjustment,
  CreditPackRow,
  StudentDetail,
  StudentListPage,
} from "@/domain/types";
import { InsufficientCreditsError } from "@/domain/errors";
import { log } from "@/lib/logger";
import type { CreditService } from "./CreditService";
import type { PricingService } from "./PricingService";

/** Rows per /admin/students page. */
export const STUDENTS_PAGE_SIZE = 50;
/** The bookings and payments lists show the latest N, newest first (not paginated). */
export const RECENT_LIST_LIMIT = 100;
/** Audit entries on a student's detail page. */
export const STUDENT_AUDIT_LIMIT = 50;
/** The dashboard's revenue card window. */
export const REVENUE_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export class AdminService {
  constructor(
    private readonly queries: IAdminQueryRepository,
    private readonly credits: CreditService,
    private readonly pricing: PricingService,
    private readonly audit:   IAuditRepository,
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

  /** One page (1-based) of students, searched by email/name fragment. A blank query
   *  lists everyone; a page below 1 or not a whole number reads as page 1. */
  listStudents(opts: {
    query?:    string;
    lowCredit: boolean;
    page:      number;
    pageSize:  number;
  }): Promise<StudentListPage> {
    const query    = opts.query?.trim() || undefined;
    const page     = Number.isInteger(opts.page) && opts.page >= 1 ? opts.page : 1;
    const pageSize = Math.max(0, Math.floor(opts.pageSize));
    return this.queries.listStudents({
      query,
      lowCredit: opts.lowCredit,
      limit:     pageSize,
      offset:    (page - 1) * pageSize,
    });
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
