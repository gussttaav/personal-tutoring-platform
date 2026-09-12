/*
 * CONTENT-FEEDBACK-01 — persistence port for reader feedback on lessons and posts.
 *
 * Two tables, two write shapes:
 *   - votes are UPSERTED on (content_type, content_key, voter_key) and the row
 *     mirrors the LAST submission — a 👍→👎 switch updates it, a comment sent
 *     after a 👎 updates it again, a later 👍 with no comment clears the comment;
 *   - reports are APPENDED, and only their status ever changes.
 *
 * Reads are for /admin/feedback only. `listVotes` hands back raw rows, capped —
 * grouping is a pure function in the service, so the fake needs no query engine.
 */
import type {
  ContentLocale,
  ContentReport,
  ContentReportStatus,
  ContentType,
  ContentVoteComment,
  ContentVoteRow,
  VoteValue,
} from "../types";

export interface UpsertVoteInput {
  contentType: ContentType;
  contentKey:  string;
  locale:      ContentLocale;
  voterKey:    string;
  userId:      string | null;
  vote:        VoteValue;
  /** `null` clears a previous comment — the row always reflects the last submission. */
  comment:     string | null;
}

export interface CreateReportInput {
  contentType:   ContentType;
  contentKey:    string;
  locale:        ContentLocale;
  pageUrl:       string;
  message:       string;
  reporterEmail: string | null;
  userId:        string | null;
  userAgent:     string | null;
}

export interface IContentFeedbackRepository {
  upsertVote(input: UpsertVoteInput): Promise<void>;

  createReport(input: CreateReportInput): Promise<ContentReport>;

  /** Newest-updated first, at most `limit` rows. */
  listVotes(limit: number): Promise<ContentVoteRow[]>;

  /** Rows with a non-empty comment, newest-updated first, at most `limit`. */
  listVoteComments(limit: number): Promise<ContentVoteComment[]>;

  /** Newest first, at most `limit`. */
  listReports(limit: number): Promise<ContentReport[]>;

  /** `false` when no report has that id. */
  setReportStatus(id: string, status: ContentReportStatus, resolvedAt: string | null): Promise<boolean>;
}
