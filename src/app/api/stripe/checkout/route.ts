/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe PaymentIntent for the embedded PaymentElement flow.
 * Returns { clientSecret, paymentIntentId } — no redirect URL.
 *
 * Week 4 — OBS-01: console.* replaced with structured log() calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { CheckoutSchema } from "@/lib/schemas";
import { checkoutRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

async function getPriceAmount(priceId: string): Promise<{ amount: number; currency: string }> {
  const price = await stripe.prices.retrieve(priceId);
  if (!price.unit_amount) throw new Error(`Price ${priceId} has no unit_amount`);
  return { amount: price.unit_amount, currency: price.currency };
}

function getPackPriceId(packSize: number): string {
  const ids: Record<number, string | undefined> = {
    5:  process.env.STRIPE_PRICE_ID_PACK5,
    10: process.env.STRIPE_PRICE_ID_PACK10,
  };
  const id = ids[packSize];
  if (!id) throw new Error(`No price ID configured for pack size ${packSize}`);
  return id;
}

function getSingleSessionPriceId(duration: "1h" | "2h"): string {
  const ids = {
    "1h": process.env.STRIPE_PRICE_ID_SESSION_1H,
    "2h": process.env.STRIPE_PRICE_ID_SESSION_2H,
  };
  const id = ids[duration];
  if (!id) throw new Error(`No price ID configured for duration ${duration}`);
  return id;
}

export async function POST(req: NextRequest) {
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
    if (body.type === "pack") {
      const priceId          = getPackPriceId(body.packSize);
      const { amount, currency } = await getPriceAmount(priceId);

      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          student_name:  name,
          student_email: email,
          pack_size:     String(body.packSize),
          checkout_type: "pack",
        },
      });

      return NextResponse.json({
        clientSecret:    intent.client_secret,
        paymentIntentId: intent.id,
      });
    }

    const priceId          = getSingleSessionPriceId(body.duration);
    const { amount, currency } = await getPriceAmount(priceId);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        student_name:     name,
        student_email:    email,
        checkout_type:    "single",
        session_duration: body.duration,
        start_iso:        body.startIso,
        end_iso:          body.endIso,
        reschedule_token: body.rescheduleToken ?? "",
      },
    });

    return NextResponse.json({
      clientSecret:    intent.client_secret,
      paymentIntentId: intent.id,
    });

  } catch (err) {
    log("error", "Stripe PaymentIntent creation error", { service: "checkout", email, error: String(err) });
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 });
  }
}
