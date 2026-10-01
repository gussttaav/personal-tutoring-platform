/**
 * POST /api/admin/students/[email]/pricing — set or clear this student's private
 * prices (PRICING-STUDENT-01).
 *
 * A nested route rather than another `action` on the sibling
 * /api/admin/students/[email] route, because that one predated the CSRF
 * convention when this was written (it calls isValidOrigin() since
 * REFACTOR-R4-P3-02). This route changes what a student is charged, so it
 * follows the full admin-mutation ladder used by /api/admin/pricing.
 *
 * Deliberately does NOT call revalidateTag(PRICING_CACHE_TAG): per-student rows
 * never enter the global ISR display cache, which must keep serving the public
 * prices to the statically prerendered pages. Nothing to bust.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { log } from "@/lib/logger";
import { UpdateStudentPricingSchema } from "@/lib/schemas";
import { pricingService, userService } from "@/services";

type Params = { params: Promise<{ email: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = UpdateStudentPricingSchema.safeParse(raw);
  if (!parsed.success) {
    // Zod issues are never echoed — same as /api/admin/pricing.
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { email: rawEmail } = await params;
  // Normalize before the lookup: SupabaseUserRepository stores emails lowercased
  // and trimmed, while adminService.getStudent does not normalize at all.
  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  // The override is keyed on users.id, so an unknown student is a 404 rather than
  // a silently-dropped write.
  const user = await userService.findByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { prices, reason } = parsed.data;

  await pricingService.setUserOverrides({
    userId: user.id,
    email,
    prices: prices.map((p) => ({ key: p.productKey, amountCents: p.amountCents })),
    by:     session.user.email,
    reason,
  });

  log("info", "Admin set student pricing", {
    service: "admin",
    email:   session.user.email,
    subject: email,
    changed: prices.length,
    cleared: prices.filter((p) => p.amountCents === null).length,
  });

  return NextResponse.json({ ok: true });
}
