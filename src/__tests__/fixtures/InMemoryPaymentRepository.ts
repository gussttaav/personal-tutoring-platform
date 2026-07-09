// TEST-01: In-memory implementation of IPaymentRepository for integration tests.
// SINGLE-SESSION-CONFIRM-01: slot-taken refund record + resolution broadcast.
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type { SingleSessionResolved } from "@/domain/types";

export class InMemoryPaymentRepository implements IPaymentRepository {
  private processed  = new Set<string>();
  private deadLetter = new Map<string, FailedBookingEntry>();
  private refunds    = new Set<string>();
  /** Test helper: broadcasts captured by paymentIntentId, in call order. */
  readonly broadcasts: { paymentIntentId: string; payload: SingleSessionResolved }[] = [];

  async isProcessed(idempotencyKey: string): Promise<boolean> {
    return this.processed.has(idempotencyKey);
  }

  async markProcessed(idempotencyKey: string): Promise<void> {
    this.processed.add(idempotencyKey);
  }

  async recordFailedBooking(entry: FailedBookingEntry): Promise<void> {
    this.deadLetter.set(entry.stripeSessionId, entry);
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    return Array.from(this.deadLetter.values())
      .sort((a, b) => b.failedAt.localeCompare(a.failedAt));
  }

  async clearFailedBooking(stripeSessionId: string): Promise<void> {
    this.deadLetter.delete(stripeSessionId);
  }

  // REFACTOR-P4-01
  async hasFailedBooking(stripeSessionId: string): Promise<boolean> {
    return this.deadLetter.has(stripeSessionId);
  }

  // SINGLE-SESSION-CONFIRM-01
  async recordSlotTakenRefund(paymentIntentId: string): Promise<void> {
    this.refunds.add(paymentIntentId);
  }

  async wasRefunded(paymentIntentId: string): Promise<boolean> {
    return this.refunds.has(paymentIntentId);
  }

  async broadcastSingleSessionResolved(
    paymentIntentId: string,
    payload: SingleSessionResolved,
  ): Promise<void> {
    this.broadcasts.push({ paymentIntentId, payload });
  }
}
