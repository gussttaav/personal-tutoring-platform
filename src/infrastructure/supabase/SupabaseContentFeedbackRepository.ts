// CONTENT-FEEDBACK-01: Supabase implementation of IContentFeedbackRepository.
import type {
  CreateReportInput,
  IContentFeedbackRepository,
  UpsertVoteInput,
} from "@/domain/repositories/IContentFeedbackRepository";
import type {
  ContentLocale,
  ContentReport,
  ContentReportStatus,
  ContentType,
  ContentVoteComment,
  ContentVoteRow,
  VoteValue,
} from "@/domain/types";
import { supabase } from "./client";

const REPORT_COLUMNS =
  "id, content_type, content_key, locale, page_url, message, reporter_email, user_id, user_agent, status, created_at, resolved_at";

interface ReportRow {
  id:             string;
  content_type:   string;
  content_key:    string;
  locale:         string;
  page_url:       string;
  message:        string;
  reporter_email: string | null;
  user_id:        string | null;
  user_agent:     string | null;
  status:         string;
  created_at:     string;
  resolved_at:    string | null;
}

// Supabase returns "+00:00" offsets; normalise to the JS "Z" form (see CLAUDE.md).
const iso = (value: string): string => new Date(value).toISOString();

function toReport(r: ReportRow): ContentReport {
  return {
    id:            r.id,
    contentType:   r.content_type as ContentType,
    contentKey:    r.content_key,
    locale:        r.locale as ContentLocale,
    pageUrl:       r.page_url,
    message:       r.message,
    reporterEmail: r.reporter_email,
    userId:        r.user_id,
    userAgent:     r.user_agent,
    status:        r.status as ContentReportStatus,
    createdAt:     iso(r.created_at),
    resolvedAt:    r.resolved_at ? iso(r.resolved_at) : null,
  };
}

export class SupabaseContentFeedbackRepository implements IContentFeedbackRepository {
  async upsertVote(input: UpsertVoteInput): Promise<void> {
    // `created_at` is deliberately absent: PostgREST builds ON CONFLICT DO UPDATE
    // SET from the payload columns, so the first vote's timestamp survives every
    // later switch while `updated_at` moves (same trick as touchLesson in
    // SupabaseCourseRepository). `comment` IS in the payload on purpose — the row
    // mirrors the last submission, and a 👍 with no comment must clear it.
    const { error } = await supabase
      .from("content_votes")
      .upsert(
        {
          content_type: input.contentType,
          content_key:  input.contentKey,
          locale:       input.locale,
          voter_key:    input.voterKey,
          user_id:      input.userId,
          vote:         input.vote,
          comment:      input.comment,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: "content_type,content_key,voter_key" },
      );

    if (error) throw error;
  }

  async createReport(input: CreateReportInput): Promise<ContentReport> {
    const { data, error } = await supabase
      .from("content_reports")
      .insert({
        content_type:   input.contentType,
        content_key:    input.contentKey,
        locale:         input.locale,
        page_url:       input.pageUrl,
        message:        input.message,
        reporter_email: input.reporterEmail,
        user_id:        input.userId,
        user_agent:     input.userAgent,
      })
      .select(REPORT_COLUMNS)
      .single();

    if (error) throw error;
    return toReport(data as ReportRow);
  }

  async listVotes(limit: number): Promise<ContentVoteRow[]> {
    const { data, error } = await supabase
      .from("content_votes")
      .select("content_type, content_key, locale, vote, comment, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r) => ({
      contentType: r.content_type as ContentType,
      contentKey:  r.content_key,
      locale:      r.locale as ContentLocale,
      vote:        r.vote as VoteValue,
      comment:     r.comment,
      updatedAt:   iso(r.updated_at),
    }));
  }

  async listVoteComments(limit: number): Promise<ContentVoteComment[]> {
    const { data, error } = await supabase
      .from("content_votes")
      .select("id, content_type, content_key, locale, vote, comment, updated_at")
      .not("comment", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r) => ({
      id:          r.id,
      contentType: r.content_type as ContentType,
      contentKey:  r.content_key,
      locale:      r.locale as ContentLocale,
      vote:        r.vote as VoteValue,
      comment:     r.comment ?? "",
      updatedAt:   iso(r.updated_at),
    }));
  }

  async listReports(limit: number): Promise<ContentReport[]> {
    const { data, error } = await supabase
      .from("content_reports")
      .select(REPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as ReportRow[]).map(toReport);
  }

  async setReportStatus(
    id: string,
    status: ContentReportStatus,
    resolvedAt: string | null,
  ): Promise<boolean> {
    // `.select("id")` turns the update into "did any row match" without a second
    // round trip — an unknown id yields an empty array, not an error.
    const { data, error } = await supabase
      .from("content_reports")
      .update({ status, resolved_at: resolvedAt })
      .eq("id", id)
      .select("id");

    if (error) throw error;
    return (data ?? []).length > 0;
  }
}
