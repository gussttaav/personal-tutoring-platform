/*
 * POST /api/admin/course-announce — COURSE-P6-02.
 *
 * The one bulk send on this site. Announces a course to `subscriptions WHERE type='courses'`,
 * localised per `users.locale`.
 *
 * DRY RUN BY DEFAULT. A POST with no `confirm: true` reports the recipient count and returns
 * the fully rendered email in both locales without touching Resend. That asymmetry is the
 * point: the accidental call is the harmless one, because email is the only action here that
 * cannot be undone.
 *
 * Idempotency is an `audit_log` row per successful send, matched on
 * `action + details.announcementKey`. A run that dies halfway can simply be re-invoked: the
 * addresses already delivered to are skipped. No new table for something that runs a handful
 * of times, ever.
 *
 * NOT a newsletter. There is no free-text composition and no subscriber-management UI: the
 * body comes from `emails.courseNews.*` in the message files, the recipient list from the
 * subscriptions table, and that is the whole surface.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isValidOrigin } from "@/lib/csrf";
import { log } from "@/lib/logger";
import { CourseAnnounceSchema } from "@/lib/schemas";
import { getCatalogEntry } from "@/lib/courses/catalog-view";
import { routing } from "@/i18n/routing";
import { subscriptionService } from "@/services";
import { supabaseAuditRepository } from "@/infrastructure/supabase";
import {
  renderCourseNewsEmail,
  sendCourseNewsEmail,
  type CourseNewsParams,
} from "@/infrastructure/resend/email-functions";

const AUDIT_ACTION = "course_announcement_sent";

// Resend's default rate limit is 2 requests/second. One send per ~600ms with a pause between
// batches sits well under it, and 100 recipients finish in ~60s of wall clock — which is why
// DEFAULT_LIMIT is 30: that is ~20s, inside the 25s Vercel Hobby cap with room to spare.
// Larger lists are walked with `offset`, not by raising this.
const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 1200;
const DEFAULT_LIMIT  = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-locale course facts for the template. `null` when the course is unknown. */
function courseFactsFor(courseSlug: string, locale: "es" | "en"):
  Omit<CourseNewsParams, "to" | "locale"> | null {
  const entry = getCatalogEntry(courseSlug, locale)
    ?? getCatalogEntry(courseSlug, routing.defaultLocale);
  if (!entry) return null;

  return {
    courseSlug,
    courseTitle:     entry.course.title,
    lessonCount:     entry.lessons.length,
    firstLessonSlug: entry.lessons[0]?.slug ?? null,
    contentLocale:   entry.contentLocale,
  };
}

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

  const { courseSlug, confirm, offset = 0 } = parsed.data;
  const limit           = parsed.data.limit ?? DEFAULT_LIMIT;
  const announcementKey = parsed.data.announcementKey ?? `launch:${courseSlug}`;

  const facts = courseFactsFor(courseSlug, routing.defaultLocale as "es");
  if (!facts) {
    return NextResponse.json({ error: "UNKNOWN_COURSE" }, { status: 404 });
  }

  const recipients = await subscriptionService.listSubscribers("courses");
  const already    = await supabaseAuditRepository.listNotifiedEmails(AUDIT_ACTION, announcementKey);
  const pending    = recipients.filter((r) => !already.has(r.email.toLowerCase()));
  const batch      = pending.slice(offset, offset + limit);

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (confirm !== true) {
    const samples: Record<string, { subject: string; html: string }> = {};
    for (const locale of routing.locales as readonly ("es" | "en")[]) {
      const localeFacts = courseFactsFor(courseSlug, locale);
      if (localeFacts) samples[locale] = await renderCourseNewsEmail({ locale, ...localeFacts });
    }

    return NextResponse.json({
      dryRun:          true,
      announcementKey,
      subscribers:     recipients.length,
      alreadyNotified: recipients.length - pending.length,
      pending:         pending.length,
      wouldSendNow:    batch.length,
      byLocale: {
        es: pending.filter((r) => r.locale === "es").length,
        en: pending.filter((r) => r.locale === "en").length,
      },
      samples,
    });
  }

  // ── Real send ──────────────────────────────────────────────────────────────
  let sent = 0;
  const failed: string[] = [];

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);

    for (const recipient of batch.slice(i, i + BATCH_SIZE)) {
      const localeFacts = courseFactsFor(courseSlug, recipient.locale) ?? facts;
      try {
        await sendCourseNewsEmail({
          to:     recipient.email,
          locale: recipient.locale,
          ...localeFacts,
        });
        // Recorded only AFTER a successful send, so a crash between the two re-sends rather
        // than silently skipping — the safer direction for a failure nobody is watching.
        await supabaseAuditRepository.append(recipient.email, {
          action: AUDIT_ACTION,
          announcementKey,
          courseSlug,
        });
        sent += 1;
      } catch (err) {
        // One bad address must not cost the rest of the list their email.
        failed.push(recipient.email);
        log("error", "Course announcement send failed", {
          service: "course-announce",
          to:      recipient.email,
          announcementKey,
          error:   (err as Error).message,
        });
      }
    }
  }

  const nextOffset = offset + batch.length;
  log("info", "Course announcement batch complete", {
    service: "course-announce", announcementKey, sent, failed: failed.length, nextOffset,
  });

  return NextResponse.json({
    dryRun:    false,
    announcementKey,
    sent,
    failed:    failed.length,
    failedTo:  failed,
    remaining: Math.max(0, pending.length - nextOffset),
    nextOffset,
  });
}
