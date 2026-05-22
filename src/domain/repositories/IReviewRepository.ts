// Post-class review persistence. One review row per booking.

export interface IReviewRepository {
  /**
   * Persists the rating for a booking. Idempotent: if a review already exists
   * for the booking (unique on booking_id), the rating is updated and any
   * existing comment is preserved.
   */
  upsertRating(bookingId: string, userId: string, rating: number): Promise<void>;

  /**
   * Sets/updates the optional comment for an already-rated booking. No-op if
   * no review row exists yet for the booking.
   */
  setComment(bookingId: string, comment: string): Promise<void>;
}
