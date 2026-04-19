/**
 * GET /api/stripe/session?payment_intent_id=pi_xxx
 *
 * ARCH-14: Thin adapter — auth gate, then delegate to PaymentService.
 * Ownership check and metadata retrieval live in src/services/PaymentService.ts.
 *
 * SEC-02: Auth gate + email ownership verification before returning
 * PaymentIntent metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { paymentService } from "@/services";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");

  if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
    return NextResponse.json({ error: "payment_intent_id inválido" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const summary = await paymentService.getConfirmedPayment({
      paymentIntentId,
      authenticatedEmail: session.user.email,
    });
    return NextResponse.json(summary);
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (statusCode === 402) return NextResponse.json({ error: "Pago no completado" }, { status: 402 });
    if (statusCode === 400) return NextResponse.json({ error: "Datos de sesión incompletos" }, { status: 400 });
    log("error", "Error retrieving PaymentIntent", { service: "session", error: String(err) });
    return NextResponse.json({ error: "Error al recuperar la sesión" }, { status: 500 });
  }
}
