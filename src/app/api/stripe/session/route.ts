import { NextRequest, NextResponse } from "next/server";
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

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

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
