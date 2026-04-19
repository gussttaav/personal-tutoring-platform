// ARCH-10: Credits repository interface.
// ARCH-16: CreditResult moved to domain/types.ts — re-exported here for backward compat.
import type { CreditResult } from "../types";

export type { CreditResult };

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
   */
  addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void>;

  /**
   * Atomically decrements credit by 1. Returns ok=false (with remaining=0) if
   * the user has no credits, the pack is expired, or the user doesn't exist.
   * Uses a Lua script to prevent TOCTOU races under concurrent booking requests.
   */
  decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }>;

  /**
   * Restores one credit after a cancellation. Will not exceed packSize.
   * Returns ok=false if the user has no credit record (should not normally occur).
   */
  restoreCredit(email: string): Promise<{ ok: boolean; credits: number }>;
}
