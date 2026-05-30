// TEST-01: In-memory implementation of IPaymentRepository for integration tests.
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";

export class InMemoryPaymentRepository implements IPaymentRepository {
  private processed  = new Set<string>();
  private deadLetter = new Map<string, FailedBookingEntry>();

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
}
