/**
 * PATCH /api/admin/feedback/reports/[id] — flip an error report between open and
 * resolved.
 *
 * CONTENT-FEEDBACK-01: thin adapter — auth + admin check, origin check (a
 * mutating verb on a cookie-authenticated route, as DELETE /api/account), Zod
 * validation, service delegation. 404 when no report has that id.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { log } from "@/lib/logger";
import { ReportStatusSchema } from "@/lib/schemas";
import { contentFeedbackService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";

type Params = { params: Promise<{ id: string }> };

const IdSchema = z.uuid();

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const body   = await req.json().catch(() => ({}));
  const parsed = ReportStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const found = await contentFeedbackService.setReportStatus(id, parsed.data.status);
    if (!found) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    log("info", "Admin updated content report status", {
      service:  "admin",
      email:    session.user.email,
      reportId: id,
      status:   parsed.data.status,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { reportId: id });
  }
}
