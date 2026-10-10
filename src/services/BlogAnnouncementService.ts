/*
 * BLOG-15 — announce a published blog post to the subscribers who follow its areas.
 *
 * The blog's counterpart of the course announcement (POST /api/admin/course-announce), with
 * the same safety shape, here in a service rather than in the route:
 *
 *   - THREE MODES. `preview({ samples: false })` is the live count the admin form shows as
 *     soon as a post is picked; `preview({ samples: true })` adds the rendered email in both
 *     languages (the dry run); `send` is the only call that reaches Resend.
 *   - AUDIENCE. Every blog subscriber whose areas match the post (`subscriptionMatchesPost`:
 *     every-area subscribers, a post with no area, or at least one area in common), minus
 *     whoever is already recorded under the post's key.
 *   - IDEMPOTENCY. One `audit_log` row per delivered email (`blog_announcement_sent`,
 *     `announcementKey: post:<slug>`), written only AFTER the send succeeds — a crash in
 *     between re-sends rather than silently skipping. Re-running a half-finished send skips
 *     whoever already has it, so walking a long list is re-sending with `offset: 0` until
 *     nothing is pending (`offset` indexes into `pending`, which each chunk shrinks).
 *   - CHUNKS of `limit` (30 by default), in batches of 5 one 1.2 s pause apart: under
 *     Resend's 2 requests/second and inside the 25 s Vercel Hobby cap.
 *
 * Each reader gets the email in `users.locale`; the post's title and summary come from the
 * language they will read it in (`postReadLocale`).
 */

import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { AnnouncedPost, IBlogPostCatalog } from "@/domain/repositories/IBlogPostCatalog";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { BlogArea, SubscriptionRecipient } from "@/domain/types";
import type { BlogPostAnnouncementParams, IEmailClient } from "@/infrastructure/resend";
import { blogAnnouncementKey, postReadLocale } from "@/lib/blog/announce";
import { subscriptionMatchesPost } from "@/lib/blog/subscription-areas";
import { log } from "@/lib/logger";

export const BLOG_ANNOUNCE_AUDIT_ACTION = "blog_announcement_sent";

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 1200;
export const BLOG_ANNOUNCE_DEFAULT_LIMIT = 30;

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

export interface BlogAnnouncePreview {
  dryRun:          true;
  announcementKey: string;
  post:            { slug: string; title: string; areas: BlogArea[]; locales: Locale[] };
  /** Every blog subscriber, whatever their areas. */
  subscribers:     number;
  /** The subscribers whose areas match the post. */
  matching:        number;
  /** Of `matching`, those already sent this post. */
  alreadyNotified: number;
  /** Of `matching`, those still to send — the number the confirmation names. */
  pending:         number;
  /** How many the next confirmed chunk would send (`pending`, capped at `limit`). */
  wouldSendNow:    number;
  byLocale:        Record<Locale, number>;
  samples?:        Partial<Record<Locale, { subject: string; html: string }>>;
}

export interface BlogAnnounceSendResult {
  dryRun:          false;
  announcementKey: string;
  sent:            number;
  failed:          number;
  failedTo:        string[];
  remaining:       number;
  nextOffset:      number;
}

interface Audience {
  post:      AnnouncedPost;
  locales:   Locale[];
  key:       string;
  all:       SubscriptionRecipient[];
  matching:  SubscriptionRecipient[];
  pending:   SubscriptionRecipient[];
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class BlogAnnouncementService {
  constructor(
    private readonly subs:  ISubscriptionRepository,
    private readonly audit: IAuditRepository,
    private readonly posts: IBlogPostCatalog,
    private readonly email: IEmailClient,
    private readonly sleep: (ms: number) => Promise<void> = realSleep,
  ) {}

  /** Counts (and, with `samples`, the rendered email). `null` for an unpublished slug. */
  async preview(input: {
    slug:    string;
    samples: boolean;
    offset?: number;
    limit?:  number;
  }): Promise<BlogAnnouncePreview | null> {
    const audience = await this.audience(input.slug);
    if (!audience) return null;

    const { post, locales, key, all, matching, pending } = audience;
    const offset = input.offset ?? 0;
    const limit  = input.limit ?? BLOG_ANNOUNCE_DEFAULT_LIMIT;

    const preview: BlogAnnouncePreview = {
      dryRun:          true,
      announcementKey: key,
      post:            { slug: post.slug, title: post.title, areas: post.areas, locales },
      subscribers:     all.length,
      matching:        matching.length,
      alreadyNotified: matching.length - pending.length,
      pending:         pending.length,
      wouldSendNow:    pending.slice(offset, offset + limit).length,
      byLocale: {
        es: pending.filter((r) => r.locale === "es").length,
        en: pending.filter((r) => r.locale === "en").length,
      },
    };

    if (input.samples) {
      const samples: BlogAnnouncePreview["samples"] = {};
      for (const locale of LOCALES) {
        const copy = this.copyFor(input.slug, locale, locales, post.areas);
        if (copy) samples[locale] = await this.email.renderBlogPostAnnouncement(copy);
      }
      preview.samples = samples;
    }

    return preview;
  }

  /** The irreversible one. `null` for an unpublished slug. */
  async send(input: {
    slug:    string;
    offset?: number;
    limit?:  number;
  }): Promise<BlogAnnounceSendResult | null> {
    const audience = await this.audience(input.slug);
    if (!audience) return null;

    const { post, locales, key, pending } = audience;
    const offset = input.offset ?? 0;
    const limit  = input.limit ?? BLOG_ANNOUNCE_DEFAULT_LIMIT;
    const batch  = pending.slice(offset, offset + limit);

    let sent = 0;
    const failed: string[] = [];

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      if (i > 0) await this.sleep(BATCH_DELAY_MS);

      for (const recipient of batch.slice(i, i + BATCH_SIZE)) {
        const copy = this.copyFor(input.slug, recipient.locale, locales, post.areas);
        try {
          if (!copy) throw new Error("post has no published copy");
          await this.email.sendBlogPostAnnouncement({ to: recipient.email, ...copy });
          await this.audit.append(recipient.email, {
            action:          BLOG_ANNOUNCE_AUDIT_ACTION,
            announcementKey: key,
            slug:            input.slug,
          });
          sent += 1;
        } catch (err) {
          // One bad address must not cost the rest of the list their email.
          failed.push(recipient.email);
          log("error", "Blog announcement send failed", {
            service: "blog-announce",
            to:      recipient.email,
            announcementKey: key,
            error:   (err as Error).message,
          });
        }
      }
    }

    const nextOffset = offset + batch.length;
    log("info", "Blog announcement batch complete", {
      service: "blog-announce", announcementKey: key, sent, failed: failed.length, nextOffset,
    });

    return {
      dryRun:          false,
      announcementKey: key,
      sent,
      failed:          failed.length,
      failedTo:        failed,
      remaining:       Math.max(0, pending.length - nextOffset),
      nextOffset,
    };
  }

  private async audience(slug: string): Promise<Audience | null> {
    const locales = this.posts.locales(slug);
    const post    = locales.length > 0 ? this.posts.get(slug, locales[0]) : null;
    if (!post) return null;

    const key      = blogAnnouncementKey(slug);
    const all      = await this.subs.listByType("blog");
    const matching = all.filter((r) => subscriptionMatchesPost(r.areas, post.areas));
    const already  = await this.audit.listNotifiedEmails(BLOG_ANNOUNCE_AUDIT_ACTION, key);
    const pending  = matching.filter((r) => !already.has(r.email.toLowerCase()));

    return { post, locales, key, all, matching, pending };
  }

  /** One reader's email minus the address: their language for the chrome, the language
   *  they will read the post in for its title and summary. */
  private copyFor(
    slug:    string,
    locale:  Locale,
    locales: Locale[],
    areas:   BlogArea[],
  ): Omit<BlogPostAnnouncementParams, "to"> | null {
    const read = this.posts.get(slug, postReadLocale(locale, locales));
    if (!read) return null;
    return {
      locale,
      slug,
      postTitle:   read.title,
      postSummary: read.summary,
      areas,
      postLocales: locales,
    };
  }
}
