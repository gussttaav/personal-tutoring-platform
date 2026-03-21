import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe"; // ARCH-01: singleton

/**
 * GET /api/stripe/session?session_id=cs_xxx
 *
 * Returns metadata from a completed Stripe session.
 * Used by both /pago-exitoso (packs) and /sesion-confirmada (single sessions).
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "session_id inválido" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Pago no completado" },
        { status: 402 }
      );
    }

    const email =
      session.metadata?.student_email ?? session.customer_email ?? "";
    const name         = session.metadata?.student_name ?? "";
    const checkoutType = session.metadata?.checkout_type ?? "pack";

    if (!email) {
      return NextResponse.json(
        { error: "Datos de sesión incompletos" },
        { status: 400 }
      );
    }

    // Pack checkout — return credits info
    if (checkoutType === "pack") {
      const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
      return NextResponse.json({ email, name, packSize, checkoutType });
    }

    // Single session checkout — return duration
    const sessionDuration = session.metadata?.session_duration ?? "";
    return NextResponse.json({ email, name, sessionDuration, checkoutType });
  } catch (err) {
    console.error("[session] Error retrieving session:", err);
    return NextResponse.json(
      { error: "Error al recuperar la sesión" },
      { status: 500 }
    );
  }
}
