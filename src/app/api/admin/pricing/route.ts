/**
 * GET  /api/admin/pricing — current prices for the 4 products.
 * POST /api/admin/pricing — update one or more prices (requires reason).
 *
 * Thin adapter — auth + admin check, Zod validation, service delegation.
 * Prices are read fresh per request (see pricing-display.ts), so an update is
 * reflected across the customer-facing UI on the next render — no cache bust.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { UpdatePricesSchema } from "@/lib/schemas";
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

  const raw = await req.json().catch(() => null);
  const parsed = UpdatePricesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  for (const update of parsed.data) {
    await pricingService.updatePrice({
      key:         update.productKey,
      amountCents: update.amountCents,
      by:          session.user.email,
      reason:      update.reason,
    });
  }

  log("info", "Admin updated pricing", {
    service: "admin",
    email:   session.user.email,
    count:   parsed.data.length,
  });

  return NextResponse.json({ ok: true });
}
