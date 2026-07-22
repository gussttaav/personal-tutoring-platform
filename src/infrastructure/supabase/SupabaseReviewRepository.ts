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

  async findByBookingIds(
    bookingIds: string[],
  ): Promise<Map<string, { rating: number; comment: string | null }>> {
    if (bookingIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from("reviews")
      .select("booking_id, rating, comment")
      .in("booking_id", bookingIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map(r => [
        r.booking_id as string,
        { rating: r.rating as number, comment: (r.comment ?? null) as string | null },
      ]),
    );
  }
}
