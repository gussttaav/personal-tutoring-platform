/**
 * COURSE-P4-02 — course progress.
 *
 *   POST /api/courses/progress   { courseSlug, lessonSlug, action: "seen"|"completed" }
 *   GET  /api/courses/progress?courseSlug=…  → CourseProgressDetail
 *   GET  /api/courses/progress[?locale=…]    → { enrollments: EnrolledCourseView[] }  (P4-03)
 *
 * COURSE-P4-03 adds the second GET shape: without `courseSlug` the endpoint answers with
 * every enrolment, which is what the "Mis cursos" panel in /area-personal reads. Titles are
 * merged in from the registry here (see lib/courses/enrollment-view.ts) — they live in git,
 * not Postgres, so the client stays on one round trip without denormalising them into the DB.
 *
 * Thin dispatchers over CourseService (CLAUDE.md): parse → service → map errors.
 *
 * Two deliberate departures from the house route pattern, both forced by the fact
 * that this endpoint serves a STATICALLY GENERATED page that anyone may read:
 *
 *   1. A signed-out request returns 204, not 401. The client is REPORTING progress,
 *      not requesting a resource, and a 401 in the console on every lesson view for
 *      every anonymous reader is noise that trains people to ignore the console.
 *      The absence of a body is also how the client learns progress is untracked.
 *
 *   2. The rate limiter is keyed by the authenticated email and therefore runs AFTER
 *      the session check, rather than by IP before it (see paymentChannelRatelimit,
 *      which reorders for the same reason). Students share school and office NATs, so
 *      per-IP would let one reader exhaust a whole building's budget — and this way
 *      anonymous readers, who are the majority, never touch Redis at all.
 *
 * CourseService throws no domain errors: unknown or unpublished slugs are dropped and
 * logged there, so a stale bookmark is a no-op, never a 500 and never a 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import {
  CourseEnrollmentsQuerySchema,
  CourseProgressQuerySchema,
  CourseProgressUpdateSchema,
} from "@/lib/schemas";
import { courseService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { courseProgressRatelimit } from "@/lib/ratelimit";
import { registryCourseMeta, toEnrolledCourseViews } from "@/lib/courses/enrollment-view";
import { routing } from "@/i18n/routing";

/** Progress is a convenience, not a resource: no session means nothing to report. */
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  const email   = session?.user?.email;
  if (!email) return noContent();

  const { success } = await courseProgressRatelimit.limit(email);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const parsed = CourseProgressUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const { courseSlug, lessonSlug, action } = parsed.data;

  try {
    if (action === "completed") {
      await courseService.markLessonCompleted(email, courseSlug, lessonSlug);
    } else {
      await courseService.markLessonSeen(email, courseSlug, lessonSlug);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, courseSlug, lessonSlug, action });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const email   = session?.user?.email;
  if (!email) return noContent();

  const { success } = await courseProgressRatelimit.limit(email);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  // No `courseSlug` → the P4-03 list shape. An unknown locale is not an error here:
  // it only picks the content tree the titles are read from.
  if (!req.nextUrl.searchParams.get("courseSlug")) {
    const query  = CourseEnrollmentsQuerySchema.safeParse({
      locale: req.nextUrl.searchParams.get("locale") ?? undefined,
    });
    const locale = (query.success ? query.data.locale : undefined) ?? routing.defaultLocale;

    try {
      const summaries = await courseService.listEnrollments(email);
      return NextResponse.json({
        enrollments: toEnrolledCourseViews(summaries, registryCourseMeta(locale)),
      });
    } catch (err) {
      return mapDomainErrorToResponse(err, { email, locale });
    }
  }

  const parsed = CourseProgressQuerySchema.safeParse({
    courseSlug: req.nextUrl.searchParams.get("courseSlug") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const progress = await courseService.getCourseProgressDetail(email, parsed.data.courseSlug);
    return NextResponse.json(progress);
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, courseSlug: parsed.data.courseSlug });
  }
}
