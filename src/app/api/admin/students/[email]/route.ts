/**
 * GET  /api/admin/students/[email] — student detail (credits, bookings, audit).
 * POST /api/admin/students/[email] — adjust credit balance (requires reason).
 *
 * ADMIN-01: Thin adapter — auth + admin check, Zod validation, service delegation.
 *
 * REFACTOR-R4-P3-02: reads through adminService (was _data.ts). POST checks the origin
 * first (CSRF convention), and the adjustment itself moved to AdminService.adjustCredits:
 * a debit larger than the balance stops at the balance and the response says how much
 * was applied, instead of swallowing the error and answering `{ ok: true }`.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { isValidOrigin } from "@/lib/csrf";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { AdjustCreditsSchema } from "@/lib/schemas";
import { adminService } from "@/services";

type Params = { params: Promise<{ email: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  const [student, packs, bookings, audit] = await Promise.all([
    adminService.getStudent(email),
    adminService.listCreditPacks(email),
    adminService.listStudentBookings(email),
    adminService.listAuditLog(email),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  log("info", "Admin fetched student detail", { service: "admin", email: session.user.email, subject: email });

  return NextResponse.json({ student, packs, bookings, audit });
}

export async function POST(req: NextRequest, { params }: Params) {
  // REFACTOR-R4-P3-02: CSRF convention (CLAUDE.md) — every POST route checks origin.
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  const raw = await req.json().catch(() => null);
  const parsed = AdjustCreditsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { amount, reason } = parsed.data;

  try {
    const { requested, applied } = await adminService.adjustCredits({
      email,
      amount,
      reason,
      by: session.user.email,
    });

    log("info", "Admin adjusted credits", {
      service: "admin", email: session.user.email, subject: email, amount: requested, applied,
    });

    return NextResponse.json({ ok: true, requested, applied });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email: session.user.email, subject: email, amount });
  }
}
