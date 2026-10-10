/*
 * POST /api/admin/course-announce — COURSE-P6-02 / COURSE-P6-02b, BLOG-15 (count only).
 *
 * Announces a course to the courses subscribers. COURSE-ANNOUNCE-01: the rules (who it reaches,
 * the three kinds and their idempotency keys, chunking, the audit log) live in
 * `CourseAnnouncementService`; this route only gates, parses and picks one of the three modes:
 *
 *   { courseSlug, kind, countOnly: true }   the live recipient count the admin form shows on
 *                                           selection. An `update` may ask for it before its
 *                                           line is written, since the count does not depend
 *                                           on the line.
 *   { courseSlug, kind }                    DRY RUN — counts + the rendered email in both
 *                                           languages. The default, so the accidental call is
 *                                           the harmless one.
 *   { courseSlug, kind, confirm: true }     the real send, one chunk (`limit`, 30 by default)
 *
 * Admin-only, CSRF-checked, and a body without `confirm` cannot send: that asymmetry is the
 * point, because email is the only action here that cannot be undone. `countOnly` never sends
 * either (the schema refuses it together with `confirm`).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { CourseAnnounceSchema } from "@/lib/schemas";
import { courseAnnouncementService } from "@/services";

export async function POST(req: NextRequest) {
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

  const body   = await req.json().catch(() => ({}));
  const parsed = CourseAnnounceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { countOnly, confirm, ...announcement } = parsed.data;

  const result = confirm === true
    ? await courseAnnouncementService.send(announcement)
    : await courseAnnouncementService.preview({ ...announcement, samples: countOnly !== true });

  if (!result) {
    return NextResponse.json({ error: "UNKNOWN_COURSE" }, { status: 404 });
  }
  return NextResponse.json(result);
}
