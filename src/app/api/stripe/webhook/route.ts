/**
 * POST /api/stripe/webhook
 *
 * Applied fixes (cumulative):
 *   Week 2 — ARCH-01: Stripe singleton
 *   Week 2 — ARCH-02: Shared Redis client
 *   Week 2 — ARCH-05: Single-session idempotency key
 *   Week 3 — PAY-01:  Slot re-check before calendar event creation
 *   Week 3 — PAY-03:  Dead-letter pattern for calendar failures
 *   Week 4 — OBS-01:  console.* replaced with structured log() calls
 *   Week 5 — EMB-01:  Added payment_intent.succeeded handler for the
 *                     embedded PaymentElement flow. The legacy
 *                     checkout.session.completed branch is kept for
 *                     backward compatibility during transition.
 *   REL-02:            Extracted processSingleSession() to deduplicate webhook
 *                     handlers; both payment_intent.succeeded and
 *                     checkout.session.completed branches delegate to the
 *                     single shared function.
 *   REL-05:            Wrapped confirmation + admin email sends in waitUntil()
 *                     so the webhook responds immediately and emails are sent
 *                     in the background. Calendar creation and KV writes still
 *                     complete before the response. Vercel-only feature; on
 *                     self-hosted Node, waitUntil is a no-op and emails run
 *                     as a background microtask (no Vercel execution guarantee).
 *   REL-03:            Moved SingleSessionInput + processSingleSession to
 *                     src/lib/single-session.ts so the dead-letter recovery
 *                     endpoint can import them. Next.js route files may only
 *                     export HTTP method handlers.
 */

// ARCH-12: creditService.addCredits instead of direct addOrUpdateStudent calls.
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { creditService } from "@/services";
import { log } from "@/lib/logger";
import { processSingleSession } from "@/lib/single-session";

// ── Shared logic for pack payment ─────────────────────────────────────────────

async function handlePackPayment(
  metadata: Record<string, string>,
  intentId: string
): Promise<Response | null> {
  const email    = metadata.student_email ?? "";
  const name     = metadata.student_name  ?? "";
  const packSize = parseInt(metadata.pack_size ?? "0", 10);

  if (!email) {
    log("error", "Missing email in pack payment metadata", { service: "webhook", intentId });
    return NextResponse.json({ received: true, warning: "Missing email" });
  }
  if (!packSize) {
    return NextResponse.json({ received: true, warning: "Missing pack_size" });
  }

  try {
    await creditService.addCredits({
      email, name, amount: packSize,
      packLabel: `Pack ${packSize} clases`, stripeSessionId: intentId,
    });
    log("info", "Pack credits written", { service: "webhook", email, packSize });
  } catch (err) {
    log("error", "KV write failed for pack payment", { service: "webhook", email, intentId, error: String(err) });
    return NextResponse.json({ received: false }, { status: 500 });
  }
  return null;
}

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
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log("error", "Stripe webhook signature verification failed", { service: "webhook", error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── payment_intent.succeeded (embedded PaymentElement flow) ──────────────────
  if (event.type === "payment_intent.succeeded") {
    const intent       = event.data.object as Stripe.PaymentIntent;
    const metadata     = intent.metadata as Record<string, string>;
    const checkoutType = metadata.checkout_type ?? "pack";
    const intentId     = intent.id;

    if (checkoutType === "pack") {
      const earlyReturn = await handlePackPayment(metadata, intentId);
      if (earlyReturn) return earlyReturn;
    }

    if (checkoutType === "single") {
      const earlyReturn = await processSingleSession({
        email:           metadata.student_email ?? "",
        name:            metadata.student_name  ?? "",
        startIso:        metadata.start_iso,
        endIso:          metadata.end_iso,
        duration:        metadata.session_duration ?? "1h",
        rescheduleToken: metadata.reschedule_token || null,
        idempotencyKey:  intentId,
        refundTarget:    { type: "payment_intent", id: intentId },
      });
      if (earlyReturn) return earlyReturn;
    }
  }

  // ── checkout.session.completed (legacy redirect flow — kept for backward compat) ──
  if (event.type === "checkout.session.completed") {
    const session         = event.data.object as Stripe.Checkout.Session;
    const email           = session.metadata?.student_email ?? session.customer_email ?? "";
    const name            = session.metadata?.student_name ?? "";
    const checkoutType    = session.metadata?.checkout_type ?? "pack";
    const stripeSessionId = session.id;

    if (!email) {
      log("error", "Missing email in webhook metadata", { service: "webhook", stripeSessionId });
      return NextResponse.json({ received: true, warning: "Missing email" });
    }

    if (checkoutType === "pack") {
      const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
      if (!packSize) {
        return NextResponse.json({ received: true, warning: "Missing pack_size" });
      }
      try {
        await creditService.addCredits({
          email, name, amount: packSize,
          packLabel: `Pack ${packSize} clases`, stripeSessionId,
        });
        log("info", "Pack credits written", { service: "webhook", email, packSize });
      } catch (err) {
        log("error", "KV write failed for pack payment", { service: "webhook", email, stripeSessionId, error: String(err) });
        return NextResponse.json({ received: false }, { status: 500 });
      }
    }

    if (checkoutType === "single") {
      const earlyReturn = await processSingleSession({
        email,
        name,
        startIso:        session.metadata?.start_iso        ?? "",
        endIso:          session.metadata?.end_iso          ?? "",
        duration:        session.metadata?.session_duration ?? "1h",
        rescheduleToken: session.metadata?.reschedule_token || null,
        idempotencyKey:  stripeSessionId,
        refundTarget:    { type: "payment_intent", id: session.payment_intent as string },
      });
      if (earlyReturn) return earlyReturn;
    }
  }

  return NextResponse.json({ received: true });
}
