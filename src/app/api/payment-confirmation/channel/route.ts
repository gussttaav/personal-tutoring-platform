// REFACTOR-P3-05: replaces the polling GET /api/sse. Returns the Realtime channel
// name (HMAC-derived, server-only) plus the current confirmation state. The browser
// subscribes to the channel for live delivery; if the webhook already fired, `confirmed`
// is true here and no broadcast is needed.
//
// SINGLE-SESSION-CONFIRM-01: extended with a single-session branch (checkout_type ===
// "single") that returns a discriminated status + booking detail. The pack/default branch
// is unchanged and reached only for non-single PIs. Consumed by the mobile app only.
//
// REFACTOR-R3-P3-03: thin dispatcher. The inline `new Stripe(...)` client, the ownership
// gate and the single/pack branching moved to PaymentService.getConfirmationChannelState;
// the route now only rate-limits, authenticates, and maps statusCode-carrying errors.
// The limiter runs after getSession() because it is keyed by the authenticated email
// (mobile clients share carrier NATs, so per-IP would punish unrelated users).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { paymentService } from "@/services";
import { paymentChannelRatelimit } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

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

  const { success } = await paymentChannelRatelimit.limit(authSession.user.email);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  try {
    const state = await paymentService.getConfirmationChannelState({
      paymentIntentId,
      authenticatedEmail: authSession.user.email,
    });
    return NextResponse.json(state);
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (statusCode === 400) {
      return NextResponse.json({ error: "PaymentIntent metadata incomplete" }, { status: 400 });
    }
    log("error", "Error resolving payment confirmation channel state", {
      service: "payment", paymentIntentId, error: String(err),
    });
    return NextResponse.json({ error: "Could not retrieve PaymentIntent" }, { status: 500 });
  }
}
