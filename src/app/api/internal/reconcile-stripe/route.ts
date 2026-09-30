/**
 * GET /api/internal/reconcile-stripe
 *
 * REFACTOR-P4-01: Daily reconciliation cron. Lists succeeded Stripe
 * PaymentIntents from the last 48 hours and verifies each one was actually
 * processed downstream. Mismatches mean a webhook was dropped or failed
 * silently and need manual reconciliation — they are logged at "error" level
 * so they surface in Sentry (OBS-02).
 *
 * Proof-of-processing is type-aware, because this codebase does not write a
 * webhook_events row for every PaymentIntent:
 *   - pack   → a credit_packs row exists with stripe_payment_id = pi.id
 *              (handlePackPayment relies on the UNIQUE constraint, not webhook_events)
 *   - single → a bookings row, OR a single_session_refunds row (slot taken, money
 *              returned), OR a failed_bookings dead-letter entry (a known, expected
 *              failure), OR a webhook_events row (markProcessed) exists
 *   - unknown/missing checkout_type → fall back to webhook_events
 *
 * Read-only and idempotent — safe to run repeatedly.
 *
 * Triggered by cron-job.org on a daily schedule (not Vercel crons — Hobby plan).
 * Authentication: requires CRON_SECRET in the Authorization header.
 * Set the header manually in cron-job.org: Authorization: Bearer <CRON_SECRET>
 *
 * REFACTOR-R4-P3-01: thin dispatcher. The paging loop and the proof checks moved to
 * PaymentService.reconcileRecentPayments (behind IStripeClient); this route keeps the
 * auth check, the constants, the log lines and the response body cron-job.org monitors.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services";
import { log } from "@/lib/logger";

const LOOKBACK_HOURS = 48;
const PAGE_SIZE      = 100;
const MAX_PAGES      = 10; // hard cap: 1000 PIs per run; warn if we hit it

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { scanned: totalScanned, mismatches, hitPageCap } =
      await paymentService.reconcileRecentPayments({
        lookbackHours: LOOKBACK_HOURS,
        pageSize:      PAGE_SIZE,
        maxPages:      MAX_PAGES,
      });

    if (hitPageCap) {
      log("warn", "Reconciliation hit page cap — may have missed older PIs", {
        service:       "reconciliation",
        lookbackHours: LOOKBACK_HOURS,
        maxPages:      MAX_PAGES,
      });
    }

    if (mismatches.length > 0) {
      // log("error") forwards to Sentry per OBS-02. The full list is in the
      // response body (visible in cron-job.org / Vercel logs); the log payload
      // is sampled because Sentry truncates large extras.
      log("error", "Stripe reconciliation found mismatched PaymentIntents", {
        service: "reconciliation",
        count:   mismatches.length,
        scanned: totalScanned,
        sample:  mismatches.slice(0, 10),
      });
    } else {
      log("info", "Stripe reconciliation: all clear", {
        service: "reconciliation",
        scanned: totalScanned,
      });
    }

    return NextResponse.json({
      scanned:    totalScanned,
      mismatches: mismatches.length,
      details:    mismatches,
    });
  } catch (err) {
    log("error", "Reconciliation cron failed", {
      service: "reconciliation",
      error:   String(err),
    });
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
