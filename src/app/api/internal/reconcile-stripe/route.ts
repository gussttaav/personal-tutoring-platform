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
 *   - single → a bookings row, OR a failed_bookings dead-letter entry (a known,
 *              expected failure), OR a webhook_events row (markProcessed) exists
 *   - unknown/missing checkout_type → fall back to webhook_events
 *
 * Read-only and idempotent — safe to run repeatedly.
 *
 * Triggered by cron-job.org on a daily schedule (not Vercel crons — Hobby plan).
 * Authentication: requires CRON_SECRET in the Authorization header.
 * Set the header manually in cron-job.org: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/infrastructure/stripe/client-singleton";
import {
  supabaseCreditsRepository,
  supabaseBookingRepository,
  supabasePaymentRepository,
} from "@/infrastructure/supabase";
import { log } from "@/lib/logger";

const LOOKBACK_HOURS = 48;
const PAGE_SIZE      = 100;
const MAX_PAGES      = 10; // hard cap: 1000 PIs per run; warn if we hit it

interface Mismatch {
  paymentIntentId: string;
  amount:          number;
  currency:        string;
  email?:          string;
  createdAt:       string;
  reason:          "no_credit_pack" | "no_booking" | "no_webhook_row";
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = Math.floor((Date.now() - LOOKBACK_HOURS * 3600_000) / 1000);
  const mismatches: Mismatch[] = [];
  let totalScanned = 0;
  let startingAfter: string | undefined;
  let pageCount = 0;

  try {
    while (pageCount < MAX_PAGES) {
      const page = await stripe.paymentIntents.list({
        created: { gte: since },
        limit:   PAGE_SIZE,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      pageCount++;

      for (const pi of page.data) {
        totalScanned++;
        if (pi.status !== "succeeded") continue;

        const checkoutType = pi.metadata?.checkout_type;
        const base = {
          paymentIntentId: pi.id,
          amount:          pi.amount,
          currency:        pi.currency,
          email:           pi.metadata?.student_email,
          createdAt:       new Date(pi.created * 1000).toISOString(),
        };

        if (checkoutType === "pack") {
          // Proof: the pack's credit_packs row (idempotency anchor).
          if (!(await supabaseCreditsRepository.hasProcessedPayment(pi.id))) {
            mismatches.push({ ...base, reason: "no_credit_pack" });
          }
        } else if (checkoutType === "single") {
          // Proof: a booking, a known dead-letter, or the processed marker.
          const handled =
            (await supabaseBookingRepository.hasBookingForPayment(pi.id)) ||
            (await supabasePaymentRepository.hasFailedBooking(pi.id)) ||
            (await supabasePaymentRepository.isProcessed(pi.id));
          if (!handled) {
            mismatches.push({ ...base, reason: "no_booking" });
          }
        } else {
          // Unknown/missing checkout_type — fall back to the webhook ledger.
          if (!(await supabasePaymentRepository.isProcessed(pi.id))) {
            mismatches.push({ ...base, reason: "no_webhook_row" });
          }
        }
      }

      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }

    if (pageCount === MAX_PAGES) {
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
