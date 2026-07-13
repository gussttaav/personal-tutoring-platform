// TEST-01: In-memory implementation of IBookingRepository for integration tests.
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type {
  BookingHistoryEntry,
  BookingHistoryPage,
  BookingRecord,
  BookingStatus,
  SessionType,
  SingleSessionBookingDetail,
} from "@/domain/types";
import { buildCursor } from "@/infrastructure/supabase/booking-history";
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

  // BOOKING-HISTORY-01: past bookings, newest first, keyset-paginated.
  // This fake stores neither notes, payments nor reviews, so those come back
  // null — the derivation of amounts and the review join are covered by unit
  // tests over the pure helpers (booking-history.ts) and by the DB-gated
  // integration tests. What this models faithfully is the ordering, the
  // past-only filter, every status being included, and the cursor walk.
  async listHistoryByUser(
    email: string,
    opts: { limit: number; cursor?: string },
  ): Promise<BookingHistoryPage> {
    const target = email.toLowerCase();
    const now    = Date.now();

    // The fake keys bookings by eventId and treats it as the booking id.
    const all = [...this.bookings.entries()]
      .filter(([, r]) => r.email.toLowerCase() === target)
      .filter(([, r]) => new Date(r.startsAt).getTime() < now)
      .map(([eventId, r]) => ({ eventId, record: r }))
      .sort((a, b) => {
        const byStart = new Date(b.record.startsAt).getTime() - new Date(a.record.startsAt).getTime();
        return byStart !== 0 ? byStart : b.eventId.localeCompare(a.eventId);
      });

    const start = opts.cursor
      ? all.findIndex(x => buildCursor(x.record.startsAt, x.eventId) === opts.cursor) + 1
      : 0;

    const slice   = all.slice(start, start + opts.limit);
    const hasMore = all.length > start + opts.limit;

    const entries: BookingHistoryEntry[] = slice.map(({ eventId, record }) => ({
      id:          eventId,
      eventId,
      sessionType: record.sessionType,
      status:      (this.statuses.get(eventId) ?? "confirmed") as BookingStatus,
      startsAt:    record.startsAt,
      endsAt:      record.endsAt,
      ...(record.packSize !== undefined ? { packSize: record.packSize } : {}),
      note:        null,
      amountCents: null,
      currency:    null,
      review:      null,
    }));

    const last = slice[slice.length - 1];
    return {
      entries,
      nextCursor: hasMore && last ? buildCursor(last.record.startsAt, last.eventId) : null,
    };
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

  // REFACTOR-P4-01
  async hasBookingForPayment(stripePaymentId: string): Promise<boolean> {
    for (const record of this.bookings.values()) {
      if (record.stripePaymentId === stripePaymentId) return true;
    }
    return false;
  }

  // SINGLE-SESSION-CONFIRM-01: confirmed-only detail finder (mirrors the status='confirmed'
  // scope of the Supabase impl — a cancelled row never matches).
  async findByStripePaymentId(
    stripePaymentId: string,
  ): Promise<SingleSessionBookingDetail | null> {
    for (const [eventId, record] of this.bookings) {
      if (record.stripePaymentId !== stripePaymentId) continue;
      if ((this.statuses.get(eventId) ?? "confirmed") !== "confirmed") return null;
      const joinToken = this.findJoinTokenForEvent(eventId);
      if (!joinToken) return null;
      return {
        eventId,
        startIso:    record.startsAt,
        endIso:      record.endsAt,
        sessionType: record.sessionType,
        joinToken,
      };
    }
    return null;
  }

  private findJoinTokenForEvent(eventId: string): string | undefined {
    for (const [token, entry] of this.joinTokens) {
      if (entry.eventId === eventId) return token;
    }
    return undefined;
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
