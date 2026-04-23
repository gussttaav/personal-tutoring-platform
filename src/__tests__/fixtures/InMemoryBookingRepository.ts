// TEST-01: In-memory implementation of IBookingRepository for integration tests.
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { BookingRecord, SessionType } from "@/domain/types";
import { randomUUID } from "crypto";

export class InMemoryBookingRepository implements IBookingRepository {
  private bookings     = new Map<string, BookingRecord>();
  private cancelTokens = new Map<string, BookingRecord>();
  private joinTokens   = new Map<string, { eventId: string; email: string; name: string; sessionType: SessionType; startsAt: string }>();
  private locks        = new Set<string>();

  async createBooking(
    record: Omit<BookingRecord, "used">,
  ): Promise<{ cancelToken: string; joinToken: string }> {
    const cancelToken = randomUUID();
    const joinToken   = randomUUID();
    const full: BookingRecord = { ...record, used: false };

    this.bookings.set(record.eventId, full);
    this.cancelTokens.set(cancelToken, full);
    this.joinTokens.set(joinToken, {
      eventId:     record.eventId,
      email:       record.email,
      name:        record.name,
      sessionType: record.sessionType,
      startsAt:    record.startsAt,
    });

    return { cancelToken, joinToken };
  }

  async findByCancelToken(token: string): Promise<BookingRecord | null> {
    return this.cancelTokens.get(token) ?? null;
  }

  async findByJoinToken(token: string): Promise<{ eventId: string; email: string; name: string; sessionType: SessionType; startsAt: string } | null> {
    return this.joinTokens.get(token) ?? null;
  }

  async consumeCancelToken(token: string): Promise<boolean> {
    if (!this.cancelTokens.has(token)) return false;
    this.cancelTokens.delete(token);
    return true;
  }

  async listByUser(email: string): Promise<{ cancelToken: string; record: BookingRecord }[]> {
    const result: { cancelToken: string; record: BookingRecord }[] = [];
    for (const [token, record] of this.cancelTokens) {
      if (record.email.toLowerCase() === email.toLowerCase() && !record.used) {
        result.push({ cancelToken: token, record });
      }
    }
    return result;
  }

  async recordRescheduleFailure(data: {
    email:       string;
    startIso:    string;
    endIso:      string;
    sessionType: SessionType;
    error:       string;
  }): Promise<void> {
    // No-op in tests; assertions can inspect bookings state directly.
    void data;
  }

  async acquireSlotLock(startIso: string, _durationMinutes: number): Promise<boolean> {
    if (this.locks.has(startIso)) return false;
    this.locks.add(startIso);
    return true;
  }

  async releaseSlotLock(startIso: string): Promise<void> {
    this.locks.delete(startIso);
  }

  /** Test helper: returns all active cancel tokens. */
  get activeCancelTokenCount(): number {
    return this.cancelTokens.size;
  }

  /** Test helper: find the cancel token for a given eventId. */
  findCancelTokenForEvent(eventId: string): string | undefined {
    for (const [token, record] of this.cancelTokens) {
      if (record.eventId === eventId) return token;
    }
    return undefined;
  }
}
