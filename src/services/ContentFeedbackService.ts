/*
 * CONTENT-FEEDBACK-01 — reader feedback on course lessons and blog posts.
 *
 * Three verbs behind the footer row every lesson and post carries:
 *   vote      👍/👎 with an optional comment after 👎. One row per (content, voter),
 *             mirroring the LAST submission — the widget posts the vote the moment
 *             it is clicked and re-posts it with the comment, so an abandoned
 *             comment box still counts as a 👎.
 *   report    "Reportar un error": appended, mailed to NOTIFY_EMAIL, listed in admin.
 *   overview  what /admin/feedback renders.
 *
 * Policies worth stating out loud:
 *
 *   Anonymous readers count. Reading needs no account, so neither does feedback.
 *   A signed-in reader is keyed by his user id; an anonymous one by the random id
 *   his browser keeps (see `voterKey`). The same browser signing in mid-way leaves
 *   two rows — one `anon:`, one `user:` — which is accepted rather than merged.
 *
 *   Unknown content is dropped, not rejected (CourseService precedent). A vote
 *   from a page that was since unpublished must never paint red in the console;
 *   the write is skipped and logged. The catalog also pins the locale: a lesson
 *   not published in "en" cannot receive an "en" vote.
 *
 *   The report email is AWAITED, not fired-and-forgotten. A floating promise can
 *   be killed when the serverless function returns; a few hundred ms on a rare
 *   action is cheaper than a lost notification. A mail failure is logged and the
 *   report is still stored — never surfaced to the reader (BookingService's
 *   `emailFailed` spirit, without the flag: there is nothing the reader could do).
 */
import type { IContentCatalog } from "@/domain/repositories/IContentCatalog";
import type { IContentFeedbackRepository } from "@/domain/repositories/IContentFeedbackRepository";
import type {
  ContentFeedbackOverview,
  ContentLocale,
  ContentRef,
  ContentReportStatus,
  ContentVoteAggregate,
  ContentVoteRow,
  VoteValue,
} from "@/domain/types";
import type { IEmailClient } from "@/infrastructure/resend";
import { log } from "@/lib/logger";
import { voterKey } from "@/lib/content/content-key";
import { UserService } from "./UserService";

/** Rows scanned for the admin aggregate. In-process grouping is fine at this
 *  scale; past it, the upgrade is a `content_vote_stats` view. */
export const VOTE_SCAN_LIMIT = 5000;
/** Newest comments / reports shown in admin. */
export const ADMIN_LIST_LIMIT = 200;

/** Groups raw votes per content. Pure — no I/O. Most 👎 first, then most 👍. */
export function aggregateVotes(rows: ContentVoteRow[]): ContentVoteAggregate[] {
  const byContent = new Map<string, ContentVoteAggregate>();
  for (const r of rows) {
    const key = `${r.contentType}|${r.contentKey}`;
    const agg = byContent.get(key) ?? {
      contentType: r.contentType,
      contentKey:  r.contentKey,
      up:          0,
      down:        0,
      comments:    0,
      lastVoteAt:  r.updatedAt,
    };
    if (r.vote === 1) agg.up++;
    else agg.down++;
    if (r.comment) agg.comments++;
    if (r.updatedAt > agg.lastVoteAt) agg.lastVoteAt = r.updatedAt;
    byContent.set(key, agg);
  }
  return [...byContent.values()].sort((a, b) => b.down - a.down || b.up - a.up);
}

export interface VoteInput {
  ref:       ContentRef;
  locale:    ContentLocale;
  vote:      VoteValue;
  comment?:  string;
  clientId:  string;
  /** Session email, or null for an anonymous reader. */
  userEmail: string | null;
}

export interface ReportInput {
  ref:       ContentRef;
  locale:    ContentLocale;
  message:   string;
  /** Typed by an ANONYMOUS reporter; ignored when `userEmail` is present. */
  email?:    string;
  userEmail: string | null;
  userAgent: string | null;
}

export class ContentFeedbackService {
  constructor(
    private readonly feedback:    IContentFeedbackRepository,
    private readonly catalog:     IContentCatalog,
    private readonly userService: UserService,
    private readonly email:       IEmailClient,
  ) {}

  async vote(input: VoteInput): Promise<void> {
    if (!this.knownContent(input.ref, input.locale, "vote")) return;

    const userId  = input.userEmail ? await this.userService.ensureUser(input.userEmail) : null;
    const comment = input.comment?.trim() || null;

    await this.feedback.upsertVote({
      contentType: input.ref.contentType,
      contentKey:  input.ref.contentKey,
      locale:      input.locale,
      voterKey:    voterKey(userId, input.clientId),
      userId,
      vote:        input.vote,
      comment,
    });
  }

  async report(input: ReportInput): Promise<void> {
    const resolved = this.knownContent(input.ref, input.locale, "report");
    if (!resolved) return;

    const userId        = input.userEmail ? await this.userService.ensureUser(input.userEmail) : null;
    const reporterEmail = input.userEmail ?? input.email ?? null;

    const report = await this.feedback.createReport({
      contentType:   input.ref.contentType,
      contentKey:    input.ref.contentKey,
      locale:        input.locale,
      pageUrl:       resolved.pageUrl,
      message:       input.message,
      reporterEmail,
      userId,
      userAgent:     input.userAgent,
    });

    log("info", "Content error report filed", {
      service:     "content-feedback",
      reportId:    report.id,
      contentType: report.contentType,
      contentKey:  report.contentKey,
      locale:      report.locale,
      anonymous:   userId === null,
    });

    try {
      await this.email.sendContentReportNotification({
        reportId:      report.id,
        contentType:   report.contentType,
        contentKey:    report.contentKey,
        locale:        report.locale,
        pageUrl:       report.pageUrl,
        message:       report.message,
        reporterEmail: report.reporterEmail,
      });
    } catch (err) {
      log("error", "Content report notification email failed", {
        service:  "content-feedback",
        reportId: report.id,
        error:    err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getAdminOverview(): Promise<ContentFeedbackOverview> {
    const [votes, comments, reports] = await Promise.all([
      this.feedback.listVotes(VOTE_SCAN_LIMIT),
      this.feedback.listVoteComments(ADMIN_LIST_LIMIT),
      this.feedback.listReports(ADMIN_LIST_LIMIT),
    ]);

    const aggregates = aggregateVotes(votes).map((agg) => {
      const ref      = { contentType: agg.contentType, contentKey: agg.contentKey };
      const resolved = this.catalog.resolve(ref, "es") ?? this.catalog.resolve(ref, "en");
      return { ...agg, title: resolved?.title ?? null, pageUrl: resolved?.pageUrl ?? null };
    });

    return { aggregates, comments, reports };
  }

  async setReportStatus(id: string, status: ContentReportStatus): Promise<boolean> {
    const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
    return this.feedback.setReportStatus(id, status, resolvedAt);
  }

  private knownContent(ref: ContentRef, locale: ContentLocale, op: string) {
    const resolved = this.catalog.resolve(ref, locale);
    if (resolved) return resolved;

    log("warn", "Unknown or unpublished content — feedback write dropped", {
      service:     "content-feedback",
      op,
      contentType: ref.contentType,
      contentKey:  ref.contentKey,
      locale,
    });
    return null;
  }
}
