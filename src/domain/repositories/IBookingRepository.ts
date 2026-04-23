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
   * Each entry includes the cancel token (the Redis key) alongside the record.
   */
  listByUser(email: string): Promise<{ cancelToken: string; record: BookingRecord }[]>;

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
}
