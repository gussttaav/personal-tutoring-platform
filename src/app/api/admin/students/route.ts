/**
 * GET /api/admin/students — list all students with credit and session summaries.
 *
 * ADMIN-01: Thin adapter — auth + admin check, then delegate to _data.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { fetchStudents } from "@/app/[locale]/admin/_data";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? undefined;
  const students = await fetchStudents(filter);

  log("info", "Admin listed students", {
    service: "admin",
    email: session.user.email,
    count: students.length,
    filter,
  });

  return NextResponse.json({ students });
}
