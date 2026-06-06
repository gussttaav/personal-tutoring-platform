/**
 * GET  /api/admin/students/[email] — student detail (credits, bookings, audit).
 * POST /api/admin/students/[email] — adjust credit balance (requires reason).
 *
 * ADMIN-01: Thin adapter — auth + admin check, Zod validation, service delegation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { AdjustCreditsSchema } from "@/lib/schemas";
import { creditService } from "@/services";
import { supabaseAuditRepository } from "@/infrastructure/supabase";
import {
  fetchStudent,
  fetchCreditPacks,
  fetchStudentBookings,
  fetchAuditLog,
} from "@/app/[locale]/admin/_data";

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
    fetchStudent(email),
    fetchCreditPacks(email),
    fetchStudentBookings(email),
    fetchAuditLog(email),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  log("info", "Admin fetched student detail", { service: "admin", email: session.user.email, subject: email });

  return NextResponse.json({ student, packs, bookings, audit });
}

export async function POST(req: NextRequest, { params }: Params) {
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

  if (amount > 0) {
    await creditService.addCredits({
      email,
      name: "",
      amount,
      packLabel: `Ajuste manual: ${reason}`,
      stripeSessionId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  } else if (amount < 0) {
    for (let i = 0; i < Math.abs(amount); i++) {
      await creditService.useCredit(email).catch(() => { /* ignore if 0 */ });
    }
  }

  // Additional audit entry with admin attribution (creditService already wrote its own)
  await supabaseAuditRepository.append(email, {
    action: "admin_adjust",
    amount,
    reason,
    by: session.user.email,
  });

  log("info", "Admin adjusted credits", { service: "admin", email: session.user.email, subject: email, amount });

  return NextResponse.json({ ok: true });
}
