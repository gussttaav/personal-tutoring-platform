/**
 * GET /api/admin/students — list users with their classes, courses and subscriptions.
 *
 * ADMIN-01: Thin adapter — auth + admin check, then delegate to the service.
 * REFACTOR-R4-P3-02: delegates to adminService; accepts the page's ?q=, ?filter=, ?page=
 * and answers one page of 50 plus the tab counts.
 * ADMIN-USERS-01: every user but the admin, not just students; ?filter= is the users tab
 * and the body is `{ users, counts, filter, page, pageSize }` (was `students`, `total`,
 * `lowCreditTotal`).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { log } from "@/lib/logger";
import { AdminStudentsQuerySchema } from "@/lib/schemas";
import { adminService } from "@/services";
import { STUDENTS_PAGE_SIZE } from "@/services/AdminService";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { q, filter, page } = AdminStudentsQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  const { rows, counts } = await adminService.listUsers({
    query:    q,
    segment:  filter,
    page,
    pageSize: STUDENTS_PAGE_SIZE,
  });

  log("info", "Admin listed users", {
    service: "admin",
    email: session.user.email,
    count: rows.length,
    filter,
    page,
  });

  return NextResponse.json({ users: rows, counts, filter, page, pageSize: STUDENTS_PAGE_SIZE });
}
