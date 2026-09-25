/**
 * GET /api/pricing — current prices for single sessions and packs.
 *
 * Authenticated: accepts the mobile bearer (Authorization: Bearer <token>) OR a
 * web session cookie via getSession(). Returns a numeric DTO; clients format the
 * currency on-device.
 *
 * PRICING-STUDENT-01: serves BOTH the native mobile app and the web's per-student
 * price overlay (UserPricingSync), so a student is quoted the same amount Stripe
 * will charge them.
 *
 * The identity comes from the session, never from the request — an email in the
 * query string or body is ignored. Otherwise any signed-in caller could read
 * another student's private rate and enumerate who is on a discount.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pricingService, userService } from "@/services";
import { pricingRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  // Rate limit by IP.
  const { success } = await pricingRatelimit.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  // Auth — bearer (mobile) or cookie (web). Prices aren't shown pre-login.
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  try {
    // No users row (or no overrides) → public prices, the overwhelmingly common case.
    const user = await userService.findByEmail(session.user.email);
    const [pricing, hasCustomPricing] = await Promise.all([
      pricingService.getPublicPricing(user?.id),
      user ? pricingService.hasUserOverrides(user.id) : Promise.resolve(false),
    ]);

    log("info", "Pricing fetched", {
      service: "pricing",
      email: session.user.email,
      hasCustomPricing,
    });
    // `hasCustomPricing` is additive: existing mobile clients ignore it, while the
    // web client uses it to skip a pointless context update.
    return NextResponse.json({ ...pricing, hasCustomPricing });
  } catch (err) {
    log("error", "Error fetching pricing", { service: "pricing", error: String(err) });
    return NextResponse.json({ error: "Error al obtener precios" }, { status: 500 });
  }
}
