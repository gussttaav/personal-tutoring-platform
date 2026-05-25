// ARCH-10: Booking repository interface.
// ARCH-13: listByUser now returns cancel tokens alongside records; recordRescheduleFailure added.
import type { BookingRecord, SessionType } from "../types";

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
   * Marks a booking as completed. Idempotent and conservative: only transitions
   * a booking whose status is still 'confirmed' — never overwrites 'cancelled'
   * or 'no_show'.
   */
  markCompleted(bookingId: string): Promise<void>;

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
   * REFACTOR-P1-04: Records an eventId whose QStash termination scheduling
   * failed, so a fallback cron can call /api/internal/zoom-terminate manually.
   */
  recordPendingTermination(eventId: string, fireAtMs: number): Promise<void>;
}
