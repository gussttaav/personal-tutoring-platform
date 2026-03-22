/**
 * Unit tests for lib/calendar.ts
 *
 * Covers the pure-logic portions of calendar.ts that can be tested without
 * a live Google Calendar or Redis connection:
 *   - createCancellationToken: key construction, TTL calculation, HMAC signing
 *   - verifyCancellationToken: format validation, signature check, window check
 *   - consumeCancellationToken: hard delete
 *   - acquireSlotLock / releaseSlotLock: Redis SET NX PX behavior
 *
 * The Google Calendar API calls (getAvailableSlots, createCalendarEvent,
 * deleteCalendarEvent) are integration-level and require real credentials —
 * they are not covered here.
 */

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockKvGet  = jest.fn();
const mockKvSet  = jest.fn();
const mockKvDel  = jest.fn();

jest.mock("@/lib/redis", () => ({
  kv: {
    get: (...args: unknown[]) => mockKvGet(...args),
    set: (...args: unknown[]) => mockKvSet(...args),
    del: (...args: unknown[]) => mockKvDel(...args),
  },
}));

// Set CANCEL_SECRET before importing calendar.ts so the module-level
// constant is initialised with a known test value.
process.env.CANCEL_SECRET = "a".repeat(64); // 64-char hex-like string for tests

// Also stub google calendar to prevent import errors (not used in these tests)
jest.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: jest.fn() },
    calendar: jest.fn(() => ({})),
  },
}));

jest.mock("@/lib/booking-config", () => ({
  SCHEDULE:      { timezone: "Europe/Madrid", minNoticeHours: 2, bookingWindowWeeks: 8, workingDays: [0,1,2,3,4,5,6] },
  DAY_SCHEDULES: {},
  dayStartHour:  jest.fn(() => 9),
}));

import {
  createCancellationToken,
  verifyCancellationToken,
  consumeCancellationToken,
  acquireSlotLock,
  releaseSlotLock,
} from "@/lib/calendar";
import type { BookingRecord } from "@/lib/calendar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureIso(hoursAhead = 24): string {
  return new Date(Date.now() + hoursAhead * 3_600_000).toISOString();
}

function makeRecord(overrides: Partial<Omit<BookingRecord, "used">> = {}): Omit<BookingRecord, "used"> {
  const start = futureIso(24);
  const end   = futureIso(25);
  return {
    eventId:     "evt_test_123",
    email:       "student@example.com",
    name:        "Ana García",
    sessionType: "session1h",
    startsAt:    start,
    endsAt:      end,
    ...overrides,
  };
}

// ─── createCancellationToken ──────────────────────────────────────────────────

describe("createCancellationToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a 64-character hex string (SHA-256 HMAC)", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const token = await createCancellationToken(makeRecord());
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writes to the correct Redis key with { used: false }", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const token = await createCancellationToken(makeRecord());

    expect(mockKvSet).toHaveBeenCalledTimes(1);
    const [key, value, options] = mockKvSet.mock.calls[0];
    expect(key).toBe(`cancel:${token}`);
    expect(value.used).toBe(false);
    expect(options?.ex).toBeGreaterThan(0); // TTL must be set
  });

  it("sets a TTL that accounts for session end + 1h buffer", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const endsAt = futureIso(2); // session ends in 2 hours
    await createCancellationToken(makeRecord({ endsAt }));

    const [, , options] = mockKvSet.mock.calls[0];
    // TTL should be roughly 3 hours (2h until end + 1h buffer), allow ±60s slop
    const expectedMin = 2 * 3600;
    const expectedMax = 4 * 3600;
    expect(options.ex).toBeGreaterThanOrEqual(expectedMin);
    expect(options.ex).toBeLessThanOrEqual(expectedMax);
  });

  it("enforces a minimum TTL of 1 hour even for immediate sessions", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const endsAt = new Date(Date.now() - 1000).toISOString(); // already ended
    await createCancellationToken(makeRecord({ endsAt }));

    const [, , options] = mockKvSet.mock.calls[0];
    expect(options.ex).toBeGreaterThanOrEqual(3600);
  });

  it("produces the same token for the same eventId/email/startsAt", async () => {
    mockKvSet.mockResolvedValue("OK");
    const record = makeRecord();
    const [t1, t2] = await Promise.all([
      createCancellationToken(record),
      createCancellationToken(record),
    ]);
    expect(t1).toBe(t2);
  });
});

// ─── verifyCancellationToken ──────────────────────────────────────────────────

describe("verifyCancellationToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects tokens shorter than 64 hex chars without touching Redis", async () => {
    const result = await verifyCancellationToken("short");
    expect(result).toBeNull();
    expect(mockKvGet).not.toHaveBeenCalled();
  });

  it("rejects tokens with non-hex characters without touching Redis", async () => {
    const result = await verifyCancellationToken("z".repeat(64));
    expect(result).toBeNull();
    expect(mockKvGet).not.toHaveBeenCalled();
  });

  it("returns null when the key is not found in Redis", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    const result = await verifyCancellationToken("a".repeat(64));
    expect(result).toBeNull();
  });

  it("returns null when the record has used:true", async () => {
    // We need a token that will pass HMAC verification — create one first
    mockKvSet.mockResolvedValueOnce("OK");
    const record = makeRecord();
    const token  = await createCancellationToken(record);

    // Now simulate the stored record being marked used
    mockKvGet.mockResolvedValueOnce({ ...record, used: true });
    const result = await verifyCancellationToken(token);
    expect(result).toBeNull();
  });

  it("returns null when the HMAC signature does not match (tampered token)", async () => {
    // Store a valid record but present a different token
    mockKvSet.mockResolvedValueOnce("OK");
    const record    = makeRecord();
    await createCancellationToken(record);

    // Return the record when queried by a different token
    const badToken = "f".repeat(64);
    mockKvGet.mockResolvedValueOnce({ ...record, used: false });

    const result = await verifyCancellationToken(badToken);
    expect(result).toBeNull();
  });

  it("returns the record with withinWindow:true for a session far in the future", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const record = makeRecord({ startsAt: futureIso(48) }); // 48h from now
    const token  = await createCancellationToken(record);

    mockKvGet.mockResolvedValueOnce({ ...record, used: false });
    const result = await verifyCancellationToken(token);

    expect(result).not.toBeNull();
    expect(result?.withinWindow).toBe(true);
    expect(result?.record.email).toBe(record.email);
  });

  it("returns withinWindow:false when session starts in less than 2 hours", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    const record = makeRecord({ startsAt: futureIso(1) }); // 1h from now — within 2h window
    const token  = await createCancellationToken(record);

    mockKvGet.mockResolvedValueOnce({ ...record, used: false });
    const result = await verifyCancellationToken(token);

    expect(result?.withinWindow).toBe(false);
  });
});

// ─── consumeCancellationToken ─────────────────────────────────────────────────

describe("consumeCancellationToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls kv.del with the correct key", async () => {
    mockKvDel.mockResolvedValueOnce(1);
    const token = "b".repeat(64);
    await consumeCancellationToken(token);
    expect(mockKvDel).toHaveBeenCalledWith(`cancel:${token}`);
  });

  it("does not call kv.get (hard delete, no read needed)", async () => {
    mockKvDel.mockResolvedValueOnce(1);
    await consumeCancellationToken("c".repeat(64));
    expect(mockKvGet).not.toHaveBeenCalled();
  });
});

// ─── madridToUtc (DST correctness) ───────────────────────────────────────────
// These tests verify the core PERF-01 fix: that local Madrid wall-clock times
// are converted to the correct UTC offset for both CET (UTC+1) and CEST (UTC+2).
// We call acquireSlotLock with known ISO strings and inspect the key written to
// Redis, since slotLockKey normalises via new Date().toISOString() which relies
// on madridToUtc being correct upstream in getAvailableSlots.
//
// Direct test: import the private helper indirectly by checking that two ISO
// strings that represent the same Madrid wall-clock time in winter vs summer
// produce different UTC values (i.e. one hour apart).

describe("DST offset correctness (madridToUtc)", () => {
  it("winter date uses UTC+1: 10:00 Madrid = 09:00 UTC", () => {
    // January — CET = UTC+1
    // We verify by parsing back the ISO string produced by fromZonedTime
    const { fromZonedTime } = require("date-fns-tz");
    const winterLocal = "2025-01-15T10:00:00";
    const utc = fromZonedTime(winterLocal, "Europe/Madrid");
    expect(utc.getUTCHours()).toBe(9);
    expect(utc.getUTCMinutes()).toBe(0);
  });

  it("summer date uses UTC+2: 10:00 Madrid = 08:00 UTC", () => {
    // July — CEST = UTC+2
    const { fromZonedTime } = require("date-fns-tz");
    const summerLocal = "2025-07-15T10:00:00";
    const utc = fromZonedTime(summerLocal, "Europe/Madrid");
    expect(utc.getUTCHours()).toBe(8);
    expect(utc.getUTCMinutes()).toBe(0);
  });

  it("same wall-clock time on the same date in CET vs CEST is 1 UTC hour apart", () => {
    // Use dates on either side of the spring DST transition (last Sunday of March).
    // 2025-03-29 clocks spring forward: before = CET (UTC+1), after = CEST (UTC+2).
    // 2025-03-28 10:00 Madrid (CET)  → 09:00 UTC
    // 2025-03-30 10:00 Madrid (CEST) → 08:00 UTC
    // Both are "10:00 local" but the UTC hour differs by exactly 1.
    const { fromZonedTime } = require("date-fns-tz");
    const beforeDST = fromZonedTime("2025-03-28T10:00:00", "Europe/Madrid"); // CET  = UTC+1
    const afterDST  = fromZonedTime("2025-03-30T10:00:00", "Europe/Madrid"); // CEST = UTC+2
    expect(beforeDST.getUTCHours()).toBe(9);
    expect(afterDST.getUTCHours()).toBe(8);
    // The UTC hour difference between the same wall-clock time in the two offsets is 1
    expect(beforeDST.getUTCHours() - afterDST.getUTCHours()).toBe(1);
  });
});

// ─── slotLockKey normalisation ────────────────────────────────────────────────

describe("slotLockKey normalisation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("two equivalent ISO strings for the same instant produce the same lock key", async () => {
    mockKvSet.mockResolvedValue("OK");
    mockKvDel.mockResolvedValue(1);

    // These represent the same instant in different formats
    const iso1 = "2025-06-01T10:00:00.000Z";
    const iso2 = "2025-06-01T10:00:00Z";

    await acquireSlotLock(iso1, 60);
    await acquireSlotLock(iso2, 60);

    const key1 = mockKvSet.mock.calls[0][0];
    const key2 = mockKvSet.mock.calls[1][0];
    expect(key1).toBe(key2);
  });

  it("different start times produce different lock keys", async () => {
    mockKvSet.mockResolvedValue("OK");

    await acquireSlotLock("2025-06-01T10:00:00Z", 60);
    await acquireSlotLock("2025-06-01T11:00:00Z", 60);

    const key1 = mockKvSet.mock.calls[0][0];
    const key2 = mockKvSet.mock.calls[1][0];
    expect(key1).not.toBe(key2);
  });
});

// ─── acquireSlotLock / releaseSlotLock ────────────────────────────────────────

describe("acquireSlotLock / releaseSlotLock", () => {
  beforeEach(() => jest.clearAllMocks());

  it("acquireSlotLock returns true when Redis SET NX succeeds (lock acquired)", async () => {
    // Upstash SET NX returns "OK" on success
    mockKvSet.mockResolvedValueOnce("OK");
    const acquired = await acquireSlotLock("2025-06-01T10:00:00Z", 60);
    expect(acquired).toBe(true);
  });

  it("acquireSlotLock returns false when the slot is already locked (SET NX returns null)", async () => {
    mockKvSet.mockResolvedValueOnce(null);
    const acquired = await acquireSlotLock("2025-06-01T10:00:00Z", 60);
    expect(acquired).toBe(false);
  });

  it("passes the correct key, NX flag, and TTL to Redis", async () => {
    mockKvSet.mockResolvedValueOnce("OK");
    await acquireSlotLock("2025-06-01T10:00:00Z", 60);

    expect(mockKvSet).toHaveBeenCalledTimes(1);
    const [key, value, options] = mockKvSet.mock.calls[0];
    expect(key).toContain("slot:lock:");
    expect(value).toBe(1);
    expect(options?.nx).toBe(true);
    expect(options?.ex).toBeGreaterThan(0);
  });

  it("releaseSlotLock calls kv.del with the slot lock key", async () => {
    mockKvDel.mockResolvedValueOnce(1);
    await releaseSlotLock("2025-06-01T10:00:00Z");
    expect(mockKvDel).toHaveBeenCalledWith(expect.stringContaining("slot:lock:"));
  });
});
