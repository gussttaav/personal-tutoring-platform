import type { IGoogleReviewPromptRepository } from "@/domain/repositories/IGoogleReviewPromptRepository";
import type { GoogleReviewPromptState } from "@/domain/types";
import { supabase } from "./client";

// Read-modify-write is safe here: rows are mutated only from the post-class
// flow of a single authenticated user, one session at a time.
export class SupabaseGoogleReviewPromptRepository implements IGoogleReviewPromptRepository {
  async get(userId: string): Promise<GoogleReviewPromptState | null> {
    const { data, error } = await supabase
      .from("google_review_prompts")
      .select("shown_count, skipped_count, dismissed, last_shown_completed_count, accepted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      shownCount:              data.shown_count,
      skippedCount:            data.skipped_count,
      dismissed:               data.dismissed,
      lastShownCompletedCount: data.last_shown_completed_count,
      acceptedAt:              data.accepted_at,
    };
  }

  async recordShown(userId: string, completedCount: number): Promise<void> {
    const current = await this.get(userId);
    const { error } = await supabase
      .from("google_review_prompts")
      .upsert(
        {
          user_id:                    userId,
          shown_count:                (current?.shownCount ?? 0) + 1,
          last_shown_completed_count: completedCount,
          updated_at:                 new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  }

  async recordDeclined(userId: string): Promise<void> {
    const current = await this.get(userId);
    const shownCount = current?.shownCount ?? 0;
    const { error } = await supabase
      .from("google_review_prompts")
      .upsert(
        {
          user_id:       userId,
          skipped_count: (current?.skippedCount ?? 0) + 1,
          // Shown twice and declined → never show again.
          dismissed:     shownCount >= 2,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  }

  async recordAccepted(userId: string): Promise<void> {
    const { error } = await supabase
      .from("google_review_prompts")
      .upsert(
        {
          user_id:     userId,
          dismissed:   true,
          accepted_at: new Date().toISOString(),
          updated_at:  new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  }
}
