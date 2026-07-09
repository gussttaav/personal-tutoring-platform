// REFACTOR-P3-05: replaces the polling GET /api/sse. Returns the Realtime channel
// name (HMAC-derived, server-only) plus the current confirmation state. The browser
// subscribes to the channel for live delivery; if the webhook already fired, `confirmed`
// is true here and no broadcast is needed.
//
// SINGLE-SESSION-CONFIRM-01: extended with a single-session branch (checkout_type ===
// "single") that returns a discriminated status + booking detail. The pack/default branch
// is unchanged and reached only for non-single PIs. Consumed by the mobile app only.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import { creditService, paymentService } from "@/services";
import { paymentChannelName } from "@/lib/realtime-channel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");
  if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
    return NextResponse.json({ error: "Missing or invalid payment_intent_id" }, { status: 400 });
  }

  const authSession = await getSession();
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Resolve identity from PaymentIntent metadata (never trust URL params) — same as the old /api/sse gate.
  let email: string, name: string, packSize: number, checkoutType: string;
  try {
    const intent = await new Stripe(process.env.STRIPE_SECRET_KEY!).paymentIntents.retrieve(paymentIntentId);
    email        = intent.metadata?.student_email ?? "";
    name         = intent.metadata?.student_name  ?? "";
    packSize     = parseInt(intent.metadata?.pack_size ?? "0", 10);
    checkoutType = intent.metadata?.checkout_type ?? "pack";
    if (!email) return NextResponse.json({ error: "PaymentIntent metadata incomplete" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not retrieve PaymentIntent" }, { status: 500 });
  }

  if (email.toLowerCase() !== authSession.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // SINGLE-SESSION-CONFIRM-01: single-session branch — sits AFTER the ownership gate, so no
  // booking/join detail is computed before the 403. Same channelName scheme as packs.
  if (checkoutType === "single") {
    const { status, booking } = await paymentService.getSingleSessionStatus(paymentIntentId);
    return NextResponse.json({
      channelName:  paymentChannelName(paymentIntentId),
      checkoutType: "single",
      status,
      ...(booking ? { booking } : {}),
    });
  }

  // Current state ("backlog" equivalent): if the webhook already landed, return the balance now.
  const confirmed = await creditService.hasProcessedPayment(paymentIntentId);
  const balance   = confirmed ? await creditService.getBalance(email) : null;

  return NextResponse.json({
    channelName: paymentChannelName(paymentIntentId),
    confirmed,
    credits:  balance?.credits  ?? (confirmed ? packSize : null),
    name:     balance?.name     ?? name,
    packSize: balance?.packSize ?? packSize,
  });
}
