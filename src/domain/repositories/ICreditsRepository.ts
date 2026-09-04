// ARCH-10: Credits repository interface.
// ARCH-16: CreditResult moved to domain/types.ts — re-exported here for backward compat.
import type { CreditResult, PackSize } from "../types";

export type { CreditResult };

// REFACTOR-P3-03: decrementCredit returns the pack_size of the pack it
// decremented from (null when no credit was available), so callers don't need
// a separate getBalance roundtrip just to read it.
// BOOKING-PACKLINK-01: also returns that pack's id, so BookingService can link
// the booking to it via bookings.credit_pack_id. Both are null when ok is false.
export interface DecrementResult {
  ok:        boolean;
  remaining: number;
  packSize:  PackSize | null;
  packId:    string | null;
}

export interface ICreditsRepository {
  /**
   * Returns the current credit balance for a user, or null if no record exists.
   * Callers must handle null (user has never purchased a pack).
   */
  getCredits(email: string): Promise<CreditResult | null>;

  /**
   * Adds credits to the user's account. Idempotent by stripeSessionId —
   * calling twice with the same ID is a no-op. Safe to retry on webhook
   * redelivery without double-crediting.
   *
   * `expiresAt` (ISO 8601) is the pack's redeemability deadline, computed by the
   * caller from the admin-editable pack-validity setting and frozen per pack at
   * purchase time (write-once).
   */
  addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
    expiresAt:       string;
  }): Promise<void>;

  /**
   * Atomically decrements credit by 1. Returns ok=false (with remaining=0) if
   * the user has no credits, the pack is expired, or the user doesn't exist.
   * Uses a Postgres stored procedure (decrement_credit) to prevent TOCTOU races.
   */
  decrementCredit(email: string): Promise<DecrementResult>;

  /**
   * Restores one credit after a cancellation. Will not exceed packSize.
   * Returns ok=false if the user has no credit record (should not normally occur).
   */
  restoreCredit(email: string): Promise<{ ok: boolean; credits: number }>;

  /**
   * Returns true if a credit_pack row with this stripeSessionId already exists.
   * Used by the SSE endpoint to detect when the webhook has finished processing
   * a pack payment, without polling Redis.
   */
  hasProcessedPayment(stripeSessionId: string): Promise<boolean>;

  // REFACTOR-P3-05
  broadcastPaymentConfirmed(
    paymentIntentId: string,
    payload: { credits: number; name: string; packSize: number },
  ): Promise<void>;
}
