// REFACTOR-R4-P3-03: read-only audit of upcoming bookings against their payments.
// Off the request path by design (P1-01 was trimmed to keep Stripe/Google out of it).
//
// P1-01's length check makes a class longer than 15 minutes impossible without a matching
// payment AT BOOKING TIME. This catches what happens after: a refund or dispute issued in
// the Stripe dashboard while the class stays booked, rows older than P1-01, manual edits
// and bugs. Its mirror image (every payment produced a booking or credits) is
// PaymentService.reconcileRecentPayments.
//
// A service of its own rather than more PaymentService: that one already carries the
// checkout, the webhook, the dead-letter retry and the reconcile cron.
//
// It reports and changes nothing. A refund issued on purpose (the class still happens)
// is a legitimate state that only the tutor can judge.
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type {
  PaymentAuditBooking,
  PaymentAuditCode,
  PaymentAuditFinding,
  PaymentAuditReport,
  PaymentAuditSeverity,
  SessionType,
} from "@/domain/types";
import type { IStripeClient, PaymentAuditFacts } from "@/infrastructure/stripe/StripeClient";
import type { IEmailClient } from "@/infrastructure/resend/IEmailClient";
import { BOOKING_WINDOW_WEEKS, SESSION_DURATION_MINUTES } from "@/lib/booking-config";

/** Stripe retrieves in flight at once. */
export const AUDIT_STRIPE_CONCURRENCY = 5;

const DAY_MS = 86_400_000;

/** Admin-granted packs carry a synthetic payment id (AdminService.adjustCredits), not a PI. */
const MANUAL_PACK_PREFIX = "manual-";

/** What a class's payment must say about itself in its PaymentIntent metadata. */
interface ExpectedPayment {
  paymentId:       string;
  checkoutType:    "single" | "pack";
  sessionDuration: "1h" | "2h" | null; // null: packs carry no duration
}

function isManualPack(pack: NonNullable<PaymentAuditBooking["creditPack"]>): boolean {
  return pack.stripePaymentId.startsWith(MANUAL_PACK_PREFIX);
}

const normalizeEmail = (email: string | null) => (email ?? "").trim().toLowerCase();

/**
 * The payment a booking is checked against in Stripe, or null when there is nothing to
 * fetch: a free call, a missing link, a pack owned by someone else, an admin-granted pack.
 */
export function expectedPaymentFor(booking: PaymentAuditBooking): ExpectedPayment | null {
  switch (booking.sessionType) {
    case "session1h":
    case "session2h":
      if (!booking.stripePaymentId) return null;
      return {
        paymentId:       booking.stripePaymentId,
        checkoutType:    "single",
        sessionDuration: booking.sessionType === "session1h" ? "1h" : "2h",
      };
    case "pack": {
      const pack = booking.creditPack;
      if (!pack || !pack.ownedByBookingUser || isManualPack(pack)) return null;
      return { paymentId: pack.stripePaymentId, checkoutType: "pack", sessionDuration: null };
    }
    default:
      return null;
  }
}

/**
 * The rules. Pure: `facts` is the payment the booking points at — `undefined` when it
 * points at none, `null` when Stripe has no such PaymentIntent. Returns zero or more
 * findings.
 */
export function evaluateBooking(
  booking: PaymentAuditBooking,
  facts?: PaymentAuditFacts | null,
): PaymentAuditFinding[] {
  const findings: PaymentAuditFinding[] = [];
  const add = (
    code: PaymentAuditCode,
    extra: { severity?: PaymentAuditSeverity; paymentId?: string | null; expected?: string; actual?: string } = {},
  ) => {
    findings.push({
      code,
      severity:    extra.severity ?? "error",
      bookingId:   booking.bookingId,
      email:       booking.email,
      sessionType: booking.sessionType,
      startsAt:    booking.startsAt,
      paymentId:   extra.paymentId ?? null,
      ...(extra.expected !== undefined ? { expected: extra.expected } : {}),
      ...(extra.actual   !== undefined ? { actual:   extra.actual   } : {}),
    });
  };

  // 1. Length, for every type (free calls included). An unparseable timestamp is NaN,
  //    which never equals the expected length, so it is reported rather than passed.
  const minutes         = (Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000;
  const expectedMinutes = SESSION_DURATION_MINUTES[booking.sessionType];
  if (minutes !== expectedMinutes) {
    add("length_mismatch", { expected: `${expectedMinutes} min`, actual: `${minutes} min` });
  }

  if (booking.sessionType === "free15min") return findings;

  // 2. The link to what pays for it.
  if (booking.sessionType === "pack") {
    const pack = booking.creditPack;
    if (!pack) {
      add("no_payment_link");
      return findings;
    }
    if (!pack.ownedByBookingUser) {
      add("pack_not_owned", { paymentId: pack.stripePaymentId });
      return findings;
    }
    if (isManualPack(pack)) return findings; // an admin grant: nothing to check in Stripe
  } else if (!booking.stripePaymentId) {
    add("no_payment_link");
    return findings;
  }

  const expected = expectedPaymentFor(booking);
  if (!expected) return findings; // unreachable: every case without a payment returned above
  const paymentId = expected.paymentId;

  if (facts === undefined) {
    // A caller bug, not a state: fail the run rather than pass the class unchecked.
    throw new Error(`evaluateBooking: no payment facts for ${paymentId}`);
  }

  // 3. The payment itself.
  if (facts === null) {
    add("payment_not_found", { paymentId });
    return findings;
  }

  if (facts.status !== "succeeded") {
    add("payment_not_succeeded", { paymentId, expected: "status=succeeded", actual: `status=${facts.status}` });
  }

  // Refund state lives on the charge: PaymentIntent.status stays "succeeded" after one.
  const refunded = `amount_refunded=${facts.amountRefunded} of amount=${facts.amount}`;
  if (facts.amountRefunded > 0 && facts.amountRefunded >= facts.amount) {
    add("payment_refunded", { paymentId, actual: refunded });
  } else if (facts.amountRefunded > 0) {
    // Refunding a pack's unused classes is a legitimate partial refund.
    add("payment_partially_refunded", {
      paymentId,
      severity: booking.sessionType === "pack" ? "review" : "error",
      actual:   refunded,
    });
  }

  if (facts.disputed) add("payment_disputed", { paymentId });

  const diffs: { field: string; expected: string; actual: string | null }[] = [];
  if (facts.checkoutType !== expected.checkoutType) {
    diffs.push({ field: "checkout_type", expected: expected.checkoutType, actual: facts.checkoutType });
  }
  if (expected.sessionDuration && facts.sessionDuration !== expected.sessionDuration) {
    diffs.push({ field: "session_duration", expected: expected.sessionDuration, actual: facts.sessionDuration });
  }
  if (normalizeEmail(facts.studentEmail) !== normalizeEmail(booking.email)) {
    diffs.push({ field: "student_email", expected: booking.email, actual: facts.studentEmail });
  }
  if (diffs.length > 0) {
    add("payment_mismatch", {
      paymentId,
      expected: diffs.map(d => `${d.field}=${d.expected}`).join(", "),
      actual:   diffs.map(d => `${d.field}=${d.actual ?? "null"}`).join(", "),
    });
  }

  return findings;
}

export class BookingPaymentAuditService {
  constructor(
    private readonly bookings: IBookingRepository,
    private readonly stripe:   IStripeClient,
    private readonly email:    IEmailClient,
  ) {}

  async auditUpcoming(now = Date.now()): Promise<PaymentAuditReport> {
    const until    = new Date(now + BOOKING_WINDOW_WEEKS * 7 * DAY_MS).toISOString();
    const bookings = await this.bookings.listUpcomingForPaymentAudit(until);

    const paymentIds = [...new Set(
      bookings.map(b => expectedPaymentFor(b)?.paymentId).filter((id): id is string => !!id),
    )];
    const facts = await this.retrievePayments(paymentIds);

    const byType: Record<SessionType, number> = { free15min: 0, session1h: 0, session2h: 0, pack: 0 };
    let manualPackClasses = 0;
    const findings: PaymentAuditFinding[] = [];

    for (const booking of bookings) {
      byType[booking.sessionType] = (byType[booking.sessionType] ?? 0) + 1;
      const pack = booking.creditPack;
      if (booking.sessionType === "pack" && pack?.ownedByBookingUser && isManualPack(pack)) {
        manualPackClasses++;
      }
      const expected = expectedPaymentFor(booking);
      findings.push(...evaluateBooking(booking, expected ? facts.get(expected.paymentId) : undefined));
    }

    return { checked: bookings.length, byType, manualPackClasses, findings };
  }

  /** Sends the report to the tutor (NOTIFY_EMAIL). Throws on a send failure; the
   *  caller decides whether that fails the run. */
  emailReport(report: PaymentAuditReport): Promise<void> {
    return this.email.sendPaymentAuditReport(report);
  }

  // One Stripe call per DISTINCT PaymentIntent (a pack's PI backs several classes), at
  // most AUDIT_STRIPE_CONCURRENCY in flight. Errors other than "not found" (null)
  // propagate, so the run fails (500) instead of reporting a class it could not check;
  // after the first one, the other workers stop picking up ids.
  private async retrievePayments(ids: string[]): Promise<Map<string, PaymentAuditFacts | null>> {
    const facts = new Map<string, PaymentAuditFacts | null>();
    let next   = 0;
    let failed = false;

    const worker = async () => {
      while (!failed && next < ids.length) {
        const id = ids[next++];
        try {
          facts.set(id, await this.stripe.retrievePaymentForAudit(id));
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(AUDIT_STRIPE_CONCURRENCY, ids.length) }, worker),
    );
    return facts;
  }
}
