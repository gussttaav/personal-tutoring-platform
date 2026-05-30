// ARCH-10: Payment repository interface — idempotency keys and dead-letter queue.

export interface FailedBookingEntry {
  stripeSessionId: string;
  userId:          string;
  email?:          string;  // populated from JOIN on list, not stored in DB
  startIso:        string;
  failedAt:        string;  // ISO
  error:           string;
}

export interface IPaymentRepository {
  /**
   * Returns true if this idempotency key has already been processed. Used to
   * guard webhook handlers against duplicate Stripe event delivery.
   */
  isProcessed(idempotencyKey: string): Promise<boolean>;

  /**
   * Marks an idempotency key as processed. Implementations should set a TTL
   * long enough to cover Stripe's retry window (typically 72 hours).
   */
  markProcessed(idempotencyKey: string): Promise<void>;

  /**
   * Appends a failed booking entry to the dead-letter list. Called when a
   * webhook payment succeeds but the downstream booking operation fails.
   * The entry can later be retried via the admin recovery endpoint.
   */
  recordFailedBooking(entry: FailedBookingEntry): Promise<void>;

  /**
   * Returns all entries currently in the dead-letter list, ordered by failedAt
   * descending. Returns an empty array if the list is empty.
   */
  listFailedBookings(): Promise<FailedBookingEntry[]>;

  /**
   * Removes a dead-letter entry by stripeSessionId, typically after a successful
   * admin-triggered retry. Idempotent — safe to call if the entry is already gone.
   */
  clearFailedBooking(stripeSessionId: string): Promise<void>;

  /**
   * REFACTOR-P4-01: Returns true if a dead-letter entry exists for the given
   * Stripe id. Used by the reconciliation cron to treat a known failed booking
   * as an expected (non-mismatch) outcome rather than a dropped webhook.
   */
  hasFailedBooking(stripeSessionId: string): Promise<boolean>;
}
