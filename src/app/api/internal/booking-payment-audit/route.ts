/**
 * GET /api/internal/booking-payment-audit
 *
 * REFACTOR-R4-P3-03: daily read-only audit. Walks every upcoming confirmed booking
 * (the next BOOKING_WINDOW_WEEKS) and checks it is backed by what it should be: a free
 * call is 15 minutes, a paid 1h/2h class has a succeeded, un-refunded, undisputed
 * PaymentIntent for that student and that duration, a pack class draws on a pack the
 * student owns and paid for (or the tutor granted by hand). The rules live in
 * BookingPaymentAuditService; this route keeps the auth check, the log lines, the tutor
 * email and the response body cron-job.org monitors.
 *
 * It reports and changes nothing:
 *   - an error finding → log("error") (forwarded to Sentry, OBS-02) + one tutor email
 *   - review findings only (a pack's partial refund) → log("warn") + one tutor email
 *   - a clean run → log("info"), no email
 * The email is best-effort: a send failure logs a warning and the run still answers 200.
 * A Supabase or Stripe failure answers 500 with no email and no "all clear".
 *
 * Triggered by cron-job.org daily at 07:00 Europe/Madrid, before the first working block
 * (not Vercel crons — Hobby plan). Authentication: requires CRON_SECRET in the
 * Authorization header. Set it manually in cron-job.org: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import type { PaymentAuditReport } from "@/domain/types";
import { bookingPaymentAuditService } from "@/services";
import { log } from "@/lib/logger";

const SERVICE     = "booking-payment-audit";
const SAMPLE_SIZE = 10; // Sentry truncates large extras; the full list is in the body

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // The body lists student emails: an unset secret must not let "Bearer undefined" in.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let report: PaymentAuditReport;
  try {
    report = await bookingPaymentAuditService.auditUpcoming();
  } catch (err) {
    log("error", "Booking payment audit failed", { service: SERVICE, error: String(err) });
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }

  const { checked, byType, manualPackClasses, findings } = report;
  const errors = findings.filter(f => f.severity === "error").length;

  if (errors > 0) {
    log("error", "Booking payment audit found classes not backed by their payment", {
      service: SERVICE,
      count:   findings.length,
      errors,
      checked,
      sample:  findings.slice(0, SAMPLE_SIZE),
    });
  } else if (findings.length > 0) {
    log("warn", "Booking payment audit: classes to review", {
      service: SERVICE,
      count:   findings.length,
      checked,
      sample:  findings.slice(0, SAMPLE_SIZE),
    });
  } else {
    log("info", "Booking payment audit: all clear", {
      service: SERVICE,
      checked,
      byType,
      manualPackClasses,
    });
  }

  if (findings.length > 0) {
    try {
      await bookingPaymentAuditService.emailReport(report);
    } catch (err) {
      log("warn", "Booking payment audit email failed", { service: SERVICE, error: String(err) });
    }
  }

  return NextResponse.json({ checked, findings: findings.length, details: findings });
}
