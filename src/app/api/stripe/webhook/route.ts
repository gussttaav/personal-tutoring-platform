/**
 * POST /api/stripe/webhook
 *
 * ARCH-14: Thin adapter — signature verification + dispatch. All business
 * logic lives in PaymentService (src/services/PaymentService.ts).
 *
 * REFACTOR-P1-02: Processes synchronously instead of via waitUntil(). Returns
 * 500 for retryable failures so Stripe retries automatically (up to 3 days with
 * exponential backoff). Returns 200 only on success OR PermanentWebhookError
 * (malformed metadata that retrying cannot fix).
 *
 * Previous handlers: payment_intent.succeeded (embedded flow) and
 * checkout.session.completed (legacy redirect flow) are both handled
 * by paymentService.processWebhookEvent().
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { paymentService } from "@/services";
import { log } from "@/lib/logger";
import { PermanentWebhookError } from "@/domain/errors";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = paymentService.verifyWebhookSignature(body, sig, webhookSecret);
  } catch (err) {
    log("error", "Stripe webhook signature verification failed", {
      service: "webhook",
      error: String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await paymentService.processWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    if (err instanceof PermanentWebhookError) {
      log("error", "Permanent webhook failure — not retrying", {
        service: "webhook",
        eventId: event.id,
        error: String(err),
      });
      // Return 200 so Stripe stops retrying. The error is in Sentry via log().
      return NextResponse.json({ received: true, permanentFailure: true });
    }

    log("error", "Webhook processing failed — Stripe will retry", {
      service: "webhook",
      eventId: event.id,
      error: String(err),
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
