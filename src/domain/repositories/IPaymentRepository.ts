// ARCH-10: Payment repository interface — idempotency keys and dead-letter queue.
// SINGLE-SESSION-CONFIRM-01: slot-taken refund record + single-session resolution broadcast.
import type { RecordPaymentInput, SingleSessionResolved } from "../types";

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

  /**
   * SINGLE-SESSION-CONFIRM-01: Records that a single-session payment was refunded
   * because the slot was taken during async booking. Idempotent — duplicate calls
   * for the same PaymentIntent are a no-op (ON CONFLICT DO NOTHING). Backs the
   * `slot_taken` polling status and the refund-path idempotency guard.
   */
  recordSlotTakenRefund(paymentIntentId: string): Promise<void>;

  /**
   * SINGLE-SESSION-CONFIRM-01: Returns true if a slot-taken refund record exists
   * for the given PaymentIntent id.
   */
  wasRefunded(paymentIntentId: string): Promise<boolean>;

  /**
   * SINGLE-SESSION-CONFIRM-01: Best-effort Realtime broadcast of a single-session
   * resolution on the per-PaymentIntent channel (event: "resolved"). Mirrors the
   * pack `broadcastPaymentConfirmed` — fire-and-forget; persistence happens first.
   */
  broadcastSingleSessionResolved(
    paymentIntentId: string,
    payload: SingleSessionResolved,
  ): Promise<void>;

  /**
   * PAYMENTS-AUDIT-01: Inserts an audit row into the `payments` table when a
   * Stripe payment succeeds. Idempotent — the `stripe_payment_id` UNIQUE
   * constraint means a duplicate webhook delivery is a no-op (23505 tolerated).
   * Backs `amountCents`/`currency` in the booking-history + admin payments surfaces.
   */
  recordPayment(input: RecordPaymentInput): Promise<void>;
}
