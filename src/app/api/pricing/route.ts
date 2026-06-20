/**
 * GET /api/pricing — current prices for single sessions and packs.
 *
 * Public-data endpoint for the native mobile app. Authenticated: accepts the
 * mobile bearer (Authorization: Bearer <token>) OR a web session cookie via
 * getSession(). Returns a numeric DTO; clients format the currency on-device.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pricingService } from "@/services";
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
    const pricing = await pricingService.getPublicPricing();
    log("info", "Pricing fetched", { service: "pricing", email: session.user.email });
    return NextResponse.json(pricing);
  } catch (err) {
    log("error", "Error fetching pricing", { service: "pricing", error: String(err) });
    return NextResponse.json({ error: "Error al obtener precios" }, { status: 500 });
  }
}
