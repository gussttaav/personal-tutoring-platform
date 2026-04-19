/**
 * POST /api/stripe/webhook
 *
 * ARCH-14: Thin adapter — signature verification + dispatch. All business
 * logic lives in PaymentService (src/services/PaymentService.ts).
 *
 * Previous handlers: payment_intent.succeeded (embedded flow) and
 * checkout.session.completed (legacy redirect flow) are both handled
 * by paymentService.processWebhookEvent().
 *
 * REL-05: waitUntil() defers processing so the webhook response is returned
 * immediately. Vercel-only; on self-hosted Node it runs as a background microtask.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { waitUntil } from "@vercel/functions";
import { paymentService } from "@/services";
import { log } from "@/lib/logger";

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
    log("error", "Stripe webhook signature verification failed", { service: "webhook", error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  waitUntil(
    paymentService.processWebhookEvent(event).catch((err) =>
      log("error", "Webhook processing failed", { service: "webhook", eventId: event.id, error: String(err) })
    )
  );

  return NextResponse.json({ received: true });
}
