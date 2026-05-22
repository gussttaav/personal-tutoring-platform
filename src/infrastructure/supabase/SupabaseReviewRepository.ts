import type { IReviewRepository } from "@/domain/repositories/IReviewRepository";
import { supabase } from "./client";

export class SupabaseReviewRepository implements IReviewRepository {
  async upsertRating(bookingId: string, userId: string, rating: number): Promise<void> {
    const { error } = await supabase
      .from("reviews")
      .insert({ booking_id: bookingId, user_id: userId, rating });

    // 23505 = unique_violation — a review already exists for this booking.
    // Update the rating only; preserve any existing comment.
    if (error && error.code === "23505") {
      const { error: updateErr } = await supabase
        .from("reviews")
        .update({ rating, updated_at: new Date().toISOString() })
        .eq("booking_id", bookingId);
      if (updateErr) throw updateErr;
      return;
    }

    if (error) throw error;
  }

  async setComment(bookingId: string, comment: string): Promise<void> {
    const { error } = await supabase
      .from("reviews")
      .update({ comment, updated_at: new Date().toISOString() })
      .eq("booking_id", bookingId);

    if (error) throw error;
  }
}
