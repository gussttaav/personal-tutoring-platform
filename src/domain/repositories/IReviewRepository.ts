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

  /**
   * BOOKING-HISTORY-01: bulk read for the booking-history surface. Returns a map
   * keyed by booking id, holding only the bookings that have been reviewed —
   * callers treat a missing key as "not reviewed yet". Safe as a map because
   * reviews.booking_id is UNIQUE (one review per booking).
   */
  findByBookingIds(
    bookingIds: string[],
  ): Promise<Map<string, { rating: number; comment: string | null }>>;
}
