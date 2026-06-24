// ARCH-10: Booking repository interface.
// ARCH-13: listByUser now returns cancel tokens alongside records; recordRescheduleFailure added.
// SINGLE-SESSION-CONFIRM-01: findByStripePaymentId detail finder for the polling surface.
import type { BookingRecord, SessionType, SingleSessionBookingDetail } from "../types";

export interface IBookingRepository {
  /**
   * Persists a new booking and returns scoped tokens for joining and cancelling.
   * The record must not include `used` — the implementation sets it to false.
   */
  createBooking(record: Omit<BookingRecord, "used">): Promise<{
    cancelToken: string;
    joinToken:   string;
  }>;

  /**
   * Looks up a booking by its cancel token. Returns null if the token is not
   * found, has expired, or has already been consumed by a prior cancellation.
   */
  findByCancelToken(token: string): Promise<BookingRecord | null>;

  /**
   * Looks up a booking by its join token. Returns the fields needed to render
   * the pre-join page and gate Zoom session access. Returns null if the token
   * is not found or has expired.
   */
  findByJoinToken(token: string): Promise<{
    eventId:     string;
    email:       string;
    name:        string;
    sessionType: SessionType;
    startsAt:    string;
  } | null>;

  /**
   * Atomically marks a cancel token as consumed. Returns false if a concurrent
   * caller already consumed the same token (compare-and-swap semantics). Callers
   * must treat false as "cancellation already in progress — do nothing".
   */
  consumeCancelToken(token: string): Promise<boolean>;

  /**
   * Returns all active (non-cancelled, future) bookings for a user, ordered by
   * start time ascending. Returns an empty array if the user has no bookings.
   * Each entry includes both tokens alongside the record.
   */
  listByUser(email: string): Promise<{ cancelToken: string; joinToken: string; record: BookingRecord }[]>;

  /**
   * Returns true if the user has ever created a booking, regardless of whether
   * it was later cancelled. Used to gate first-time-user flows (e.g. free
   * trial eligibility) — once a user has booked, cancelling does not restore
   * eligibility.
   */
  hasAnyBooking(email: string): Promise<boolean>;

  /**
   * Looks up a booking by its calendar event id, scoped to the owning user
   * (security: a user can only review their own classes). Returns null if no
   * such booking exists for that user.
   */
  findIdByEventIdForUser(eventId: string, userId: string): Promise<{
    id:          string;
    sessionType: SessionType;
    status:      string;
  } | null>;

  /**
   * Looks up a booking by its calendar event id (unscoped — for internal/cron
   * use only; see findIdByEventIdForUser for the user-scoped variant used by
   * the review flow). Returns null if no booking exists for that eventId.
   */
  findByEventId(eventId: string): Promise<{ id: string; status: string } | null>;

  /**
   * REFACTOR-P4-01: Returns true if a booking row exists for the given Stripe
   * PaymentIntent id. Used by the reconciliation cron to confirm a single-session
   * webhook wrote its downstream booking.
   */
  hasBookingForPayment(stripePaymentId: string): Promise<boolean>;

  /**
   * SINGLE-SESSION-CONFIRM-01: Returns the detail fields needed by the single-session
   * polling surface for a *confirmed* booking with the given PaymentIntent id, or null.
   * Scoped to `status = 'confirmed'` (unlike hasBookingForPayment, which is status-agnostic)
   * so a cancelled/completed/no_show row never reports a stale `confirmed`. Timestamps are
   * normalized via `new Date(...).toISOString()` per the TIMESTAMPTZ gotcha.
   */
  findByStripePaymentId(stripePaymentId: string): Promise<SingleSessionBookingDetail | null>;

  /**
   * Marks a booking as completed. Idempotent and conservative: only transitions
   * a booking whose status is still 'confirmed' — never overwrites 'cancelled'
   * or 'no_show'.
   */
  markCompleted(bookingId: string): Promise<void>;

  /**
   * Marks a booking as no_show. Idempotent and conservative: only transitions
   * 'confirmed' → 'no_show'. Never overwrites 'cancelled' or 'completed'.
   */
  markNoShow(bookingId: string): Promise<void>;

  /**
   * Counts the user's completed paid classes (status='completed' and
   * session_type in session1h/session2h/pack). The free 15-min intro is
   * excluded — it never counts toward the Google-review cadence.
   */
  countCompletedPaid(userId: string): Promise<number>;

  /**
   * Persists a failed reschedule attempt to the dead-letter store so it can be
   * recovered or investigated manually. Best-effort — callers should not throw
   * on failure here.
   */
  recordRescheduleFailure(data: {
    email:       string;
    startIso:    string;
    endIso:      string;
    sessionType: SessionType;
    error:       string;
  }): Promise<void>;

  /**
   * Acquires an exclusive slot lock for a time window. Returns false if another
   * booking already holds the lock for the same start time. The lock should be
   * released explicitly via releaseSlotLock or expire after a short TTL.
   */
  acquireSlotLock(startIso: string, durationMinutes: number): Promise<boolean>;

  /**
   * Releases a previously acquired slot lock. Idempotent — safe to call even
   * if the lock has already expired or was never acquired.
   */
  releaseSlotLock(startIso: string): Promise<void>;

  /**
   * Records an eventId for scheduled Zoom session cleanup. The daily cron
   * at /api/internal/session-cleanup terminates sessions whose fire_at has passed.
   * Called on every booking — not only on scheduling failure.
   */
  recordPendingTermination(eventId: string, fireAtMs: number): Promise<void>;

  /**
   * Removes a pending_terminations row by event_id. Called when a booking is
   * cancelled or rescheduled so the old eventId's cleanup row isn't left
   * orphaned (which would later collide with no-show detection). Idempotent.
   */
  deletePendingTermination(eventId: string): Promise<void>;

  /**
   * Returns pending_terminations rows whose fire_at has already passed and
   * whose attempts counter is still below maxAttempts, ordered by fire_at
   * ascending. Used by the daily cleanup cron to batch eligible events.
   */
  listDuePendingTerminations(
    limit: number,
    maxAttempts: number,
  ): Promise<{ eventId: string; attempts: number }[]>;

  /**
   * Records a failed termination attempt by incrementing the attempts counter
   * and storing the last error. Called by the cleanup cron when finalization
   * throws so the row stays in the queue for retry until maxAttempts is hit.
   */
  recordPendingTerminationFailure(
    eventId: string,
    attempts: number,
    error: string,
  ): Promise<void>;
}
