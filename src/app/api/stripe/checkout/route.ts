/**
 * POST /api/stripe/checkout
 *
 * ARCH-14: Thin adapter — auth, CSRF, rate-limit, schema parse, then delegate
 * to PaymentService. Business logic (price lookup, PaymentIntent creation,
 * metadata assembly) lives in src/services/PaymentService.ts.
 *
 * Applied fixes:
 *   OBS-01: console.* replaced with structured log() calls.
 *   SEC-04: CSRF protection — Origin header must match NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { CheckoutSchema } from "@/lib/schemas";
import { checkoutRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { paymentService } from "@/services";

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const { success } = await checkoutRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar" }, { status: 401 });
  }

  const email = session.user.email;
  const name  = session.user.name ?? "";

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: "Cuerpo de petición inválido" }, { status: 400 }); }

  const parsed = CheckoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Petición inválida" },
      { status: 400 }
    );
  }

  const body = parsed.data;

  try {
    const result = body.type === "pack"
      ? await paymentService.createPackCheckout({ email, name, packSize: body.packSize })
      : await paymentService.createSingleSessionCheckout({
          email, name,
          duration:        body.duration,
          startIso:        body.startIso,
          endIso:          body.endIso,
          rescheduleToken: body.rescheduleToken,
        });
    return NextResponse.json(result);
  } catch (err) {
    log("error", "Stripe PaymentIntent creation error", { service: "checkout", email, error: String(err) });
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 });
  }
}
