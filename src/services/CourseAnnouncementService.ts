/*
 * COURSE-ANNOUNCE-01 — announce a course to the subscribers who follow the courses.
 *
 * The logic of POST /api/admin/course-announce (COURSE-P6-02 / 02b, BLOG-15 count-only), moved
 * out of the route handler and into a service, the shape `BlogAnnouncementService` already
 * has. Behaviour is unchanged; the route now only gates, parses and dispatches.
 *
 * The one bulk send on this site. Announces a course to `subscriptions WHERE type='courses'`,
 * localised per `users.locale`.
 *
 *   - THREE MODES. `preview({ samples: false })` is the live count the admin form shows as
 *     soon as a course and kind are picked, before any preview; `preview({ samples: true })`
 *     adds the fully rendered email in both locales (the dry run); `send` is the only call
 *     that reaches Resend. DRY RUN IS THE DEFAULT: the accidental call is the harmless one,
 *     because email is the only action here that cannot be undone. The service has no
 *     `confirm` flag — choosing `send` over `preview` is the route's reading of it.
 *   - IDEMPOTENCY. One `audit_log` row per successful send, matched on
 *     `action + details.announcementKey`. A run that dies halfway can simply be re-invoked:
 *     the addresses already delivered to are skipped. No new table for something that runs a
 *     handful of times, ever. The row is written only AFTER the send succeeds, so a crash
 *     between the two re-sends rather than silently skipping — the safer direction for a
 *     failure nobody is watching.
 *   - NOT a newsletter. There is no free-text composition and no subscriber-management UI:
 *     the body comes from one of three fixed namespaces in the message files, the recipient
 *     list from the subscriptions table, and that is the whole surface.
 *
 * COURSE-P6-02b — three `kind`s, because that is what the opt-in promises:
 *   launch  — the course is published. Once ever.        key `launch:<slug>`
 *   english — the English translation landed. Once ever. key `english:<slug>`
 *   update  — a course you follow changed. MANY TIMES.   key `update:<slug>:<yyyy-mm-dd>`
 *
 * The `update` key is the trap. `listNotifiedEmails` skips anyone already recorded under the
 * key, which is exactly right for a one-shot announcement and exactly wrong for a recurring
 * one: reuse `update:<slug>` and the second update reaches nobody. Hence the date in the
 * default, and hence the admin panel showing the resolved key before it will send anything.
 *
 * CHUNKING, and the reason it is not what you would guess: `offset` indexes into `pending`,
 * which is the subscriber list AFTER already-notified addresses are filtered out. A confirmed
 * chunk records everyone it reached, so `pending` shrinks before the next call — meaning the
 * way to walk a long list is to re-send with `offset: 0` and let the audit log do the paging.
 * Passing back `nextOffset` would step over the people the previous chunk just removed.
 * `offset` survives for the one job it is still good at: stepping past an address that fails
 * every time and would otherwise sit at the head of `pending` blocking the rest.
 *
 * Chunks are `limit` addresses (30 by default) in batches of 5, one 1.2 s pause apart.
 * Resend's default rate limit is 2 requests/second; one send per ~600ms with a pause between
 * batches sits well under it, and 100 recipients finish in ~60s of wall clock — which is why
 * the default limit is 30: that is ~20s, inside the 25s Vercel Hobby cap with room to spare.
 * Larger lists are walked by re-sending, not by raising this.
 */

import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type {
  AnnouncedCourse,
  EnglishTranslationCoverage,
  ICourseAnnouncementCatalog,
} from "@/domain/repositories/ICourseAnnouncementCatalog";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { AnnouncementKind, SubscriptionRecipient } from "@/domain/types";
import type { IEmailClient } from "@/infrastructure/resend";
import { log } from "@/lib/logger";

export const COURSE_ANNOUNCE_AUDIT_ACTION = "course_announcement_sent";

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 1200;
export const COURSE_ANNOUNCE_DEFAULT_LIMIT = 30;

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

/** Per-kind idempotency key. Only `update` carries a discriminator, because only `update`
 *  is ever sent more than once for the same course. */
const DEFAULT_KEY: Record<AnnouncementKind, (slug: string, now: Date) => string> = {
  launch:  (slug) => `launch:${slug}`,
  english: (slug) => `english:${slug}`,
  update:  (slug, now) => `update:${slug}:${now.toISOString().slice(0, 10)}`,
};

export function courseAnnouncementKey(
  kind: AnnouncementKind,
  slug: string,
  now:  Date = new Date(),
): string {
  return DEFAULT_KEY[kind](slug, now);
}

export interface CourseAnnounceInput {
  courseSlug:       string;
  kind:             AnnouncementKind;
  /** The one admin-typed line of an `update`; the other kinds ignore it. */
  whatsNew?:        string;
  /** Overrides the per-kind default key. */
  announcementKey?: string;
  offset?:          number;
  limit?:           number;
}

export interface CourseAnnouncePreview {
  dryRun:          true;
  kind:            AnnouncementKind;
  announcementKey: string;
  /** Every courses subscriber. */
  subscribers:     number;
  /** Of `subscribers`, those already sent this announcement. */
  alreadyNotified: number;
  /** Of `subscribers`, those still to send — the number the confirmation names. */
  pending:         number;
  /** How many the next confirmed chunk would send (`pending` from `offset`, capped at `limit`). */
  wouldSendNow:    number;
  byLocale:        Record<Locale, number>;
  translation:     EnglishTranslationCoverage;
  samples?:        Partial<Record<Locale, { subject: string; html: string }>>;
}

export interface CourseAnnounceSendResult {
  dryRun:          false;
  kind:            AnnouncementKind;
  announcementKey: string;
  sent:            number;
  failed:          number;
  failedTo:        string[];
  remaining:       number;
  nextOffset:      number;
}

interface Audience {
  facts:   AnnouncedCourse;
  key:     string;
  all:     SubscriptionRecipient[];
  pending: SubscriptionRecipient[];
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class CourseAnnouncementService {
  constructor(
    private readonly subs:    ISubscriptionRepository,
    private readonly audit:   IAuditRepository,
    private readonly courses: ICourseAnnouncementCatalog,
    private readonly email:   IEmailClient,
    private readonly sleep:   (ms: number) => Promise<void> = realSleep,
  ) {}

  /** Counts (and, with `samples`, the rendered email). `null` for an unknown course. */
  async preview(input: CourseAnnounceInput & { samples: boolean }): Promise<CourseAnnouncePreview | null> {
    const audience = await this.audience(input);
    if (!audience) return null;

    const { key, all, pending } = audience;
    const { courseSlug, kind, whatsNew } = input;
    const offset = input.offset ?? 0;
    const limit  = input.limit ?? COURSE_ANNOUNCE_DEFAULT_LIMIT;

    const preview: CourseAnnouncePreview = {
      dryRun:          true,
      kind,
      announcementKey: key,
      subscribers:     all.length,
      alreadyNotified: all.length - pending.length,
      pending:         pending.length,
      wouldSendNow:    pending.slice(offset, offset + limit).length,
      byLocale: {
        es: pending.filter((r) => r.locale === "es").length,
        en: pending.filter((r) => r.locale === "en").length,
      },
      translation: this.courses.englishCoverage(courseSlug),
    };

    if (input.samples) {
      const samples: CourseAnnouncePreview["samples"] = {};
      for (const locale of LOCALES) {
        const localeFacts = this.courses.forLocale(courseSlug, locale);
        if (localeFacts) {
          samples[locale] = await this.email.renderCourseAnnouncement({
            locale, kind, whatsNew, ...localeFacts,
          });
        }
      }
      preview.samples = samples;
    }

    return preview;
  }

  /** The irreversible one. `null` for an unknown course. */
  async send(input: CourseAnnounceInput): Promise<CourseAnnounceSendResult | null> {
    const audience = await this.audience(input);
    if (!audience) return null;

    const { facts, key, pending } = audience;
    const { courseSlug, kind, whatsNew } = input;
    const offset = input.offset ?? 0;
    const limit  = input.limit ?? COURSE_ANNOUNCE_DEFAULT_LIMIT;
    const batch  = pending.slice(offset, offset + limit);

    let sent = 0;
    const failed: string[] = [];

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      if (i > 0) await this.sleep(BATCH_DELAY_MS);

      for (const recipient of batch.slice(i, i + BATCH_SIZE)) {
        const localeFacts = this.courses.forLocale(courseSlug, recipient.locale) ?? facts;
        try {
          await this.email.sendCourseAnnouncement({
            to:     recipient.email,
            locale: recipient.locale,
            kind,
            whatsNew,
            ...localeFacts,
          });
          // Recorded only AFTER a successful send, so a crash between the two re-sends rather
          // than silently skipping — the safer direction for a failure nobody is watching.
          await this.audit.append(recipient.email, {
            action:          COURSE_ANNOUNCE_AUDIT_ACTION,
            announcementKey: key,
            courseSlug,
            kind,
          });
          sent += 1;
        } catch (err) {
          // One bad address must not cost the rest of the list their email.
          failed.push(recipient.email);
          log("error", "Course announcement send failed", {
            service: "course-announce",
            to:      recipient.email,
            announcementKey: key,
            error:   (err as Error).message,
          });
        }
      }
    }

    const nextOffset = offset + batch.length;
    log("info", "Course announcement batch complete", {
      service: "course-announce", announcementKey: key, kind, sent, failed: failed.length, nextOffset,
    });

    return {
      dryRun:          false,
      kind,
      announcementKey: key,
      sent,
      failed:          failed.length,
      failedTo:        failed,
      remaining:       Math.max(0, pending.length - nextOffset),
      nextOffset,
    };
  }

  private async audience(input: CourseAnnounceInput): Promise<Audience | null> {
    const facts = this.courses.canonical(input.courseSlug);
    if (!facts) return null;

    const key     = input.announcementKey ?? courseAnnouncementKey(input.kind, input.courseSlug);
    const all     = await this.subs.listByType("courses");
    const already = await this.audit.listNotifiedEmails(COURSE_ANNOUNCE_AUDIT_ACTION, key);
    const pending = all.filter((r) => !already.has(r.email.toLowerCase()));

    return { facts, key, all, pending };
  }
}
