/*
 * POST /api/admin/blog-announce — BLOG-15.
 *
 * Emails a published post to the blog subscribers who follow its areas. The rules (who it
 * reaches, idempotency, chunking) live in `BlogAnnouncementService`; this route only gates,
 * parses and picks one of the three modes:
 *
 *   { slug, countOnly: true }   the live recipient count the admin form shows on selection
 *   { slug }                    DRY RUN — counts + the rendered email in both languages.
 *                               The default, so the accidental call is the harmless one.
 *   { slug, confirm: true }     the real send, one chunk (`limit`, 30 by default)
 *
 * Same shape and guards as /api/admin/course-announce: admin-only, CSRF-checked, and a body
 * without `confirm` cannot send.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { BlogAnnounceSchema } from "@/lib/schemas";
import { blogAnnouncementService } from "@/services";

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
  const parsed = BlogAnnounceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { slug, countOnly, confirm, offset, limit } = parsed.data;

  const result = confirm === true
    ? await blogAnnouncementService.send({ slug, offset, limit })
    : await blogAnnouncementService.preview({ slug, samples: countOnly !== true, offset, limit });

  if (!result) {
    return NextResponse.json({ error: "UNKNOWN_POST" }, { status: 404 });
  }
  return NextResponse.json(result);
}
