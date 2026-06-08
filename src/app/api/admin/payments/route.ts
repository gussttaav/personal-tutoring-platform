/**
 * GET /api/admin/payments — list all payments (admin view).
 *
 * ADMIN-01: Thin adapter — auth + admin check, then delegate to _data.ts.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { fetchPayments } from "@/app/[locale]/admin/_data";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payments = await fetchPayments();

  log("info", "Admin listed payments", { service: "admin", email: session.user.email, count: payments.length });

  return NextResponse.json({ payments });
}
