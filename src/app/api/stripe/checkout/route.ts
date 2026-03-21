import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";                      // ARCH-01: singleton
import { CheckoutSchema } from "@/lib/schemas";             // ARCH-03: shared schema
import { checkoutRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";

// ─── Stripe price helpers ─────────────────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const { success } = await checkoutRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar" }, { status: 401 });
  }

  const email   = session.user.email;
  const name    = session.user.name ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 });
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
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

  // ── Create Stripe session ─────────────────────────────────────────────────
  try {
    if (body.type === "pack") {
      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode:           "payment",
        customer_email: email,
        line_items:     [{ price: getPackPriceId(body.packSize), quantity: 1 }],
        metadata: {
          student_name:  name,
          student_email: email,
          pack_size:     String(body.packSize),
          checkout_type: "pack",
        },
        success_url: `${baseUrl}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${baseUrl}/?cancelled=true`,
      });
      return NextResponse.json({ url: stripeSession.url });
    }

    // Single session — include slot timing in metadata for the webhook
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:           "payment",
      customer_email: email,
      line_items:     [{ price: getSingleSessionPriceId(body.duration), quantity: 1 }],
      metadata: {
        student_name:     name,
        student_email:    email,
        checkout_type:    "single",
        session_duration: body.duration,
        start_iso:        body.startIso,
        end_iso:          body.endIso,
        reschedule_token: body.rescheduleToken ?? "",
      },
      success_url: `${baseUrl}/sesion-confirmada?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/?cancelled=true`,
    });
    return NextResponse.json({ url: stripeSession.url });

  } catch (err) {
    console.error("[checkout] Stripe error:", err);
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 });
  }
}
