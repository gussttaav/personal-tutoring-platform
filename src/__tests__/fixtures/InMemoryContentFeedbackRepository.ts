// CONTENT-FEEDBACK-01: In-memory implementation of IContentFeedbackRepository.
//
// Mirrors the one write rule the Supabase implementation gets from SQL: a vote
// is UNIQUE per (contentType, contentKey, voterKey) and the stored row always
// reflects the LAST submission (vote and comment alike). Reports are append-only.
//
// The clock advances one millisecond per write so "newest first" orderings are
// deterministic in tests.
import type {
  CreateReportInput,
  IContentFeedbackRepository,
  UpsertVoteInput,
} from "@/domain/repositories/IContentFeedbackRepository";
import type {
  ContentReport,
  ContentReportStatus,
  ContentVoteComment,
  ContentVoteRow,
} from "@/domain/types";

export interface VoteRecord extends UpsertVoteInput {
  id:        string;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryContentFeedbackRepository implements IContentFeedbackRepository {
  /** Keyed by the unique triple; exposed so tests can assert row counts directly. */
  readonly votes   = new Map<string, VoteRecord>();
  readonly reports: ContentReport[] = [];

  private tick = 0;
  private seq  = 0;

  private now(): string {
    return new Date(Date.UTC(2026, 0, 1) + this.tick++).toISOString();
  }

  private voteKey(i: { contentType: string; contentKey: string; voterKey: string }): string {
    return `${i.contentType}|${i.contentKey}|${i.voterKey}`;
  }

  async upsertVote(input: UpsertVoteInput): Promise<void> {
    const key      = this.voteKey(input);
    const existing = this.votes.get(key);
    const now      = this.now();
    this.votes.set(key, {
      ...input,
      id:        existing?.id ?? `vote-${++this.seq}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async createReport(input: CreateReportInput): Promise<ContentReport> {
    const report: ContentReport = {
      ...input,
      id:         `report-${++this.seq}`,
      status:     "open",
      createdAt:  this.now(),
      resolvedAt: null,
    };
    this.reports.push(report);
    return report;
  }

  async listVotes(limit: number): Promise<ContentVoteRow[]> {
    return this.sortedVotes()
      .slice(0, limit)
      .map(({ contentType, contentKey, locale, vote, comment, updatedAt }) => ({
        contentType, contentKey, locale, vote, comment, updatedAt,
      }));
  }

  async listVoteComments(limit: number): Promise<ContentVoteComment[]> {
    return this.sortedVotes()
      .filter((v) => v.comment !== null)
      .slice(0, limit)
      .map((v) => ({
        id:          v.id,
        contentType: v.contentType,
        contentKey:  v.contentKey,
        locale:      v.locale,
        vote:        v.vote,
        comment:     v.comment as string,
        updatedAt:   v.updatedAt,
      }));
  }

  async listReports(limit: number): Promise<ContentReport[]> {
    return [...this.reports]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async setReportStatus(
    id: string,
    status: ContentReportStatus,
    resolvedAt: string | null,
  ): Promise<boolean> {
    const idx = this.reports.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.reports[idx] = { ...this.reports[idx], status, resolvedAt };
    return true;
  }

  private sortedVotes(): VoteRecord[] {
    return [...this.votes.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}
