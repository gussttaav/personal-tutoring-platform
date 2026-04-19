/**
 * GET /api/admin/failed-bookings  — list dead-letter entries
 * POST /api/admin/failed-bookings — retry a failed booking by stripeSessionId
 *
 * ARCH-14: Thin adapter — auth + admin check, then delegate to PaymentService.
 * Dead-letter listing and retry logic live in src/services/PaymentService.ts.
 *
 * REL-03 — Dead-letter recovery API.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { paymentService } from "@/services";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await paymentService.listFailedBookings();
  log("info", "Admin listed failed bookings", { service: "admin", count: entries.length, email: session.user.email });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { stripeSessionId } = body;

  if (!stripeSessionId || typeof stripeSessionId !== "string") {
    return NextResponse.json({ error: "stripeSessionId required" }, { status: 400 });
  }

  log("info", "Admin retrying failed booking", { service: "admin", stripeSessionId, email: session.user.email });

  const result = await paymentService.reprocessFailedBooking(stripeSessionId);

  if (!result.ok && result.error === "Not found") {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  if (!result.ok && result.error === "Failed to retrieve Stripe data") {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
