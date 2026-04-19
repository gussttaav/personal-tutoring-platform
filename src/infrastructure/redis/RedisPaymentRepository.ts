// ARCH-11 — Redis-backed implementation of IPaymentRepository.
// Manages idempotency keys and dead-letter entries for failed bookings.
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import { kv } from "@/infrastructure/redis/client";

const IDEMPOTENCY_TTL    = 7 * 24 * 60 * 60;
const FAILED_BOOKING_TTL = 30 * 24 * 60 * 60;

export class RedisPaymentRepository implements IPaymentRepository {
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    return (await kv.get(`webhook:single:${idempotencyKey}`)) !== null;
  }

  async markProcessed(idempotencyKey: string): Promise<void> {
    await kv.set(
      `webhook:single:${idempotencyKey}`,
      { processedAt: new Date().toISOString() },
      { ex: IDEMPOTENCY_TTL },
    );
  }

  async recordFailedBooking(entry: FailedBookingEntry): Promise<void> {
    await kv.set(`failed:booking:${entry.stripeSessionId}`, entry, { ex: FAILED_BOOKING_TTL });
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      const result: [string | number, string[]] = await kv.scan(cursor, { match: "failed:booking:*", count: 100 });
      const [nextCursor, batch] = result;
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== 0 && cursor !== "0");

    const entries = await Promise.all(keys.map(k => kv.get<FailedBookingEntry>(k)));
    return entries.filter((e): e is FailedBookingEntry => e !== null);
  }

  async clearFailedBooking(stripeSessionId: string): Promise<void> {
    await kv.del(`failed:booking:${stripeSessionId}`);
  }
}
