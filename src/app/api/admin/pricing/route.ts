/**
 * GET  /api/admin/pricing — current prices for the 4 products.
 * POST /api/admin/pricing — update one or more prices (requires reason).
 *
 * Thin adapter — auth + admin check, Zod validation, service delegation.
 * The customer-facing UI reads prices through an ISR cache (see
 * pricing-display.ts); on save we bust it by tag so the update is reflected on
 * the next render.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { log } from "@/lib/logger";
import { UpdatePricingSchema } from "@/lib/schemas";
import { PRICING_CACHE_TAG } from "@/lib/pricing-display";
import { pricingService } from "@/services";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prices = await pricingService.getAll();
  return NextResponse.json({ prices });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // SEC: CSRF (Origin) check on this mutation — mirrors the schedule admin route.
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = UpdatePricingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  for (const update of parsed.data.prices ?? []) {
    await pricingService.updatePrice({
      key:         update.productKey,
      amountCents: update.amountCents,
      by:          session.user.email,
      reason:      parsed.data.reason,
    });
  }

  if (parsed.data.packValidityDays !== undefined) {
    await pricingService.updatePackValidityDays({
      days:   parsed.data.packValidityDays,
      by:     session.user.email,
      reason: parsed.data.reason,
    });
  }

  // Bust the ISR pricing cache so the new prices + validity show on the
  // customer-facing UI on the next render (instant — not waiting on the
  // time-based revalidate).
  revalidateTag(PRICING_CACHE_TAG, "max");

  log("info", "Admin updated pricing", {
    service:          "admin",
    email:            session.user.email,
    priceCount:       parsed.data.prices?.length ?? 0,
    packValidityDays: parsed.data.packValidityDays ?? null,
  });

  return NextResponse.json({ ok: true });
}
