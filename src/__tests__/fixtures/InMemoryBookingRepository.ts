// TEST-01: In-memory implementation of IBookingRepository for integration tests.
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { BookingRecord, SessionType } from "@/domain/types";
import { randomUUID } from "crypto";

export class InMemoryBookingRepository implements IBookingRepository {
  private bookings             = new Map<string, BookingRecord>();
  private cancelTokens         = new Map<string, { joinToken: string; record: BookingRecord }>();
  private joinTokens           = new Map<string, { eventId: string; email: string; name: string; sessionType: SessionType; startsAt: string }>();
  private locks                = new Set<string>();
  private pendingTerminations  = new Map<string, { fireAtMs: number; attempts: number; lastError?: string }>();
  private statuses             = new Map<string, string>(); // eventId → status

  async createBooking(
    record: Omit<BookingRecord, "used">,
  ): Promise<{ cancelToken: string; joinToken: string }> {
    const cancelToken = randomUUID();
    const joinToken   = randomUUID();
    const full: BookingRecord = { ...record, used: false };

    this.bookings.set(record.eventId, full);
    this.statuses.set(record.eventId, "confirmed");
    this.cancelTokens.set(cancelToken, { joinToken, record: full });
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
    return this.cancelTokens.get(token)?.record ?? null;
  }

  async findByJoinToken(token: string): Promise<{ eventId: string; email: string; name: string; sessionType: SessionType; startsAt: string } | null> {
    return this.joinTokens.get(token) ?? null;
  }

  async consumeCancelToken(token: string): Promise<boolean> {
    const entry = this.cancelTokens.get(token);
    if (!entry) return false;
    this.cancelTokens.delete(token);
    this.statuses.set(entry.record.eventId, "cancelled");
    return true;
  }

  async listByUser(email: string): Promise<{ cancelToken: string; joinToken: string; record: BookingRecord }[]> {
    const result: { cancelToken: string; joinToken: string; record: BookingRecord }[] = [];
    for (const [token, { joinToken, record }] of this.cancelTokens) {
      if (record.email.toLowerCase() === email.toLowerCase() && !record.used) {
        result.push({ cancelToken: token, joinToken, record });
      }
    }
    return result;
  }

  async hasAnyBooking(email: string): Promise<boolean> {
    const target = email.toLowerCase();
    for (const record of this.bookings.values()) {
      if (record.email.toLowerCase() === target) return true;
    }
    return false;
  }

  async findIdByEventIdForUser(
    eventId: string,
    _userId: string,
  ): Promise<{ id: string; sessionType: SessionType; status: string } | null> {
    void _userId;
    const record = this.bookings.get(eventId);
    if (!record) return null;
    return {
      id:          eventId,
      sessionType: record.sessionType,
      status:      record.used ? "completed" : "confirmed",
    };
  }

  async findByEventId(eventId: string): Promise<{ id: string; status: string } | null> {
    if (!this.bookings.has(eventId)) return null;
    return {
      id:     eventId,
      status: this.statuses.get(eventId) ?? "confirmed",
    };
  }

  async markCompleted(bookingId: string): Promise<void> {
    const record = this.bookings.get(bookingId);
    if (!record) return;
    if ((this.statuses.get(bookingId) ?? "confirmed") !== "confirmed") return;
    record.used = true;
    this.statuses.set(bookingId, "completed");
  }

  async markNoShow(bookingId: string): Promise<void> {
    if (!this.bookings.has(bookingId)) return;
    if ((this.statuses.get(bookingId) ?? "confirmed") !== "confirmed") return;
    this.statuses.set(bookingId, "no_show");
  }

  async countCompletedPaid(_userId: string): Promise<number> {
    void _userId;
    const paid: SessionType[] = ["session1h", "session2h", "pack"];
    let n = 0;
    for (const record of this.bookings.values()) {
      if (record.used && paid.includes(record.sessionType)) n++;
    }
    return n;
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

  async recordPendingTermination(eventId: string, fireAtMs: number): Promise<void> {
    this.pendingTerminations.set(eventId, { fireAtMs, attempts: 0 });
  }

  async deletePendingTermination(eventId: string): Promise<void> {
    this.pendingTerminations.delete(eventId);
  }

  async listDuePendingTerminations(
    limit: number,
    maxAttempts: number,
  ): Promise<{ eventId: string; attempts: number }[]> {
    const now = Date.now();
    return [...this.pendingTerminations.entries()]
      .filter(([, row]) => row.fireAtMs < now && row.attempts < maxAttempts)
      .sort(([, a], [, b]) => a.fireAtMs - b.fireAtMs)
      .slice(0, limit)
      .map(([eventId, row]) => ({ eventId, attempts: row.attempts }));
  }

  async recordPendingTerminationFailure(
    eventId: string,
    attempts: number,
    error: string,
  ): Promise<void> {
    const row = this.pendingTerminations.get(eventId);
    if (!row) return;
    this.pendingTerminations.set(eventId, { ...row, attempts, lastError: error });
  }

  /** Test helper: returns all active cancel tokens. */
  get activeCancelTokenCount(): number {
    return this.cancelTokens.size;
  }

  /** Test helper: find the cancel token for a given eventId. */
  findCancelTokenForEvent(eventId: string): string | undefined {
    for (const [token, { record }] of this.cancelTokens) {
      if (record.eventId === eventId) return token;
    }
    return undefined;
  }

  /** Test helper: returns the pending terminations map (eventId → fireAtMs). */
  getPendingTerminations(): Map<string, number> {
    return new Map(
      [...this.pendingTerminations.entries()].map(([eventId, row]) => [eventId, row.fireAtMs]),
    );
  }
}
