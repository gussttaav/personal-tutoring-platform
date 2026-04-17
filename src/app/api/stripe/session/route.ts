/**
 * SEC-02: Auth gate on /api/stripe/session
 *
 * Added NextAuth session check + email ownership verification before
 * returning PaymentIntent metadata. Previously any caller who knew a
 * valid pi_xxx (visible in browser history / referrer headers) could
 * retrieve the student's email, name, and purchase details.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe"; // ARCH-01: singleton
import { log } from "@/lib/logger";

/**
 * GET /api/stripe/session?payment_intent_id=pi_xxx
 *
 * Returns metadata from a succeeded PaymentIntent.
 * Used by /sesion-confirmada (single sessions) to confirm payment status.
 * Pack payments use the SSE route instead.
 */
export async function GET(req: NextRequest) {
  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");

  if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
    return NextResponse.json(
      { error: "payment_intent_id inválido" },
      { status: 400 }
    );
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // ── Ownership check ──────────────────────────────────────────────────────
    const intentEmail = intent.metadata?.student_email ?? "";
    if (intentEmail.toLowerCase().trim() !== session.user.email.toLowerCase().trim()) {
      log("warn", "Unauthorized /stripe/session access attempt", {
        service:       "session",
        authenticatedEmail: session.user.email,
        paymentIntentId,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Pago no completado" },
        { status: 402 }
      );
    }

    const email         = intent.metadata?.student_email ?? "";
    const name          = intent.metadata?.student_name  ?? "";
    const checkoutType  = intent.metadata?.checkout_type ?? "pack";

    if (!email) {
      return NextResponse.json(
        { error: "Datos de sesión incompletos" },
        { status: 400 }
      );
    }

    // Pack checkout — return credits info
    if (checkoutType === "pack") {
      const packSize = parseInt(intent.metadata?.pack_size ?? "0", 10);
      return NextResponse.json({ email, name, packSize, checkoutType });
    }

    // Single session checkout — return duration
    const sessionDuration = intent.metadata?.session_duration ?? "";
    return NextResponse.json({ email, name, sessionDuration, checkoutType });
  } catch (err) {
    log("error", "Error retrieving PaymentIntent", { service: "session", error: String(err) });
    return NextResponse.json(
      { error: "Error al recuperar la sesión" },
      { status: 500 }
    );
  }
}
