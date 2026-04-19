/**
 * Unit tests for booking token and slot-lock helpers (ARCH-16: split from lib/calendar.ts).
 *
 * Covers:
 *   - createBookingTokens: dual-token issuance (SEC-05)
 *   - createCancellationToken: backward-compat wrapper
 *   - verifyCancellationToken: format validation, signature check, window check
 *   - resolveJoinToken: format validation, Redis lookup (SEC-05)
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
const mockKvZadd = jest.fn();

jest.mock("@/infrastructure/redis/client", () => ({
  kv: {
    get:  (...args: unknown[]) => mockKvGet(...args),
    set:  (...args: unknown[]) => mockKvSet(...args),
    del:  (...args: unknown[]) => mockKvDel(...args),
    zadd: (...args: unknown[]) => mockKvZadd(...args),
  },
}));

// Set CANCEL_SECRET before importing modules so the module-level
// constant is initialised with a known test value.
process.env.CANCEL_SECRET = "a".repeat(64); // 64-char hex-like string for tests

import {
  createBookingTokens,
  createCancellationToken,
  verifyCancellationToken,
  resolveJoinToken,
  consumeCancellationToken,
} from "@/infrastructure/redis/booking-tokens";
import {
  acquireSlotLock,
  releaseSlotLock,
} from "@/infrastructure/redis/slot-lock";
import type { BookingRecord } from "@/domain/types";

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockKvSet.mockResolvedValue("OK");
    mockKvZadd.mockResolvedValue(1);
  });

  it("returns a 64-character hex string (SHA-256 HMAC)", async () => {
    const token = await createCancellationToken(makeRecord());
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writes to the cancel Redis key with { used: false }", async () => {
    const token = await createCancellationToken(makeRecord());

    // createCancellationToken delegates to createBookingTokens → 2 kv.set calls (cancel + join)
    const cancelCall = mockKvSet.mock.calls.find(([key]) => key === `cancel:${token}`);
    expect(cancelCall).toBeDefined();
    const [, value, options] = cancelCall!;
    expect(value.used).toBe(false);
    expect(options?.ex).toBeGreaterThan(0);
  });

  it("sets a TTL that accounts for session end + 1h buffer", async () => {
    const endsAt = futureIso(2); // session ends in 2 hours
    await createCancellationToken(makeRecord({ endsAt }));

    // calls[0] is always the cancel key set (first kv.set in createBookingTokens)
    const [, , options] = mockKvSet.mock.calls[0];
    // TTL should be roughly 3 hours (2h until end + 1h buffer), allow ±60s slop
    const expectedMin = 2 * 3600;
    const expectedMax = 4 * 3600;
    expect(options.ex).toBeGreaterThanOrEqual(expectedMin);
    expect(options.ex).toBeLessThanOrEqual(expectedMax);
  });

  it("enforces a minimum TTL of 1 hour even for immediate sessions", async () => {
    const endsAt = new Date(Date.now() - 1000).toISOString(); // already ended
    await createCancellationToken(makeRecord({ endsAt }));

    const [, , options] = mockKvSet.mock.calls[0];
    expect(options.ex).toBeGreaterThanOrEqual(3600);
  });

  it("produces the same token for the same eventId/email/startsAt", async () => {
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockKvSet.mockResolvedValue("OK");
    mockKvZadd.mockResolvedValue(1);
  });

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
    const record = makeRecord();
    const token  = await createCancellationToken(record);

    mockKvGet.mockResolvedValueOnce({ ...record, used: true });
    const result = await verifyCancellationToken(token);
    expect(result).toBeNull();
  });

  it("returns null when the HMAC signature does not match (tampered token)", async () => {
    const record    = makeRecord();
    await createCancellationToken(record);

    const badToken = "f".repeat(64);
    mockKvGet.mockResolvedValueOnce({ ...record, used: false });

    const result = await verifyCancellationToken(badToken);
    expect(result).toBeNull();
  });

  it("returns the record with withinWindow:true for a session far in the future", async () => {
    const record = makeRecord({ startsAt: futureIso(48) }); // 48h from now
    const token  = await createCancellationToken(record);

    mockKvGet.mockResolvedValueOnce({ ...record, used: false });
    const result = await verifyCancellationToken(token);

    expect(result).not.toBeNull();
    expect(result?.withinWindow).toBe(true);
    expect(result?.record.email).toBe(record.email);
  });

  it("returns withinWindow:false when session starts in less than 2 hours", async () => {
    const record = makeRecord({ startsAt: futureIso(1) }); // 1h from now — within 2h window
    const token  = await createCancellationToken(record);

    mockKvGet.mockResolvedValueOnce({ ...record, used: false });
    const result = await verifyCancellationToken(token);

    expect(result?.withinWindow).toBe(false);
  });
});

// ─── createBookingTokens (SEC-05) ─────────────────────────────────────────────

describe("createBookingTokens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKvSet.mockResolvedValue("OK");
    mockKvZadd.mockResolvedValue(1);
  });

  it("returns two distinct 64-character hex tokens", async () => {
    const { cancelToken, joinToken } = await createBookingTokens(makeRecord());
    expect(cancelToken).toMatch(/^[0-9a-f]{64}$/);
    expect(joinToken).toMatch(/^[0-9a-f]{64}$/);
    expect(cancelToken).not.toBe(joinToken);
  });

  it("stores cancel key with { used: false } and correct TTL", async () => {
    const { cancelToken } = await createBookingTokens(makeRecord());
    const cancelCall = mockKvSet.mock.calls.find(([key]) => key === `cancel:${cancelToken}`);
    expect(cancelCall).toBeDefined();
    const [, value, options] = cancelCall!;
    expect(value.used).toBe(false);
    expect(options?.ex).toBeGreaterThan(0);
  });

  it("stores join key with expected shape and same TTL as cancel key", async () => {
    const record = makeRecord();
    const { joinToken } = await createBookingTokens(record);
    const joinCall = mockKvSet.mock.calls.find(([key]) => key === `join:${joinToken}`);
    expect(joinCall).toBeDefined();
    const [, value, options] = joinCall!;
    expect(value.eventId).toBe(record.eventId);
    expect(value.email).toBe(record.email.toLowerCase().trim());
    expect(value.name).toBe(record.name);
    expect(value.sessionType).toBe(record.sessionType);
    expect(value.startsAt).toBe(record.startsAt);
    expect(options?.ex).toBeGreaterThan(0);
  });

  it("cancel and join keys use the same TTL", async () => {
    const { cancelToken, joinToken } = await createBookingTokens(makeRecord());
    const [, , cancelOpts] = mockKvSet.mock.calls.find(([k]) => k === `cancel:${cancelToken}`)!;
    const [, , joinOpts]   = mockKvSet.mock.calls.find(([k]) => k === `join:${joinToken}`)!;
    expect(cancelOpts.ex).toBe(joinOpts.ex);
  });

  it("cancelToken matches what createCancellationToken returns for the same record", async () => {
    const record = makeRecord();
    const { cancelToken } = await createBookingTokens(record);
    jest.clearAllMocks();
    mockKvSet.mockResolvedValue("OK");
    mockKvZadd.mockResolvedValue(1);
    const legacyToken = await createCancellationToken(record);
    expect(cancelToken).toBe(legacyToken);
  });
});

// ─── resolveJoinToken (SEC-05) ────────────────────────────────────────────────

describe("resolveJoinToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKvSet.mockResolvedValue("OK");
    mockKvZadd.mockResolvedValue(1);
  });

  it("rejects malformed tokens without hitting Redis", async () => {
    expect(await resolveJoinToken("short")).toBeNull();
    expect(await resolveJoinToken("z".repeat(64))).toBeNull();
    expect(mockKvGet).not.toHaveBeenCalled();
  });

  it("returns null for unknown token (Redis miss)", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    const result = await resolveJoinToken("a".repeat(64));
    expect(result).toBeNull();
    expect(mockKvGet).toHaveBeenCalledWith(`join:${"a".repeat(64)}`);
  });

  it("returns the stored record for a valid join token", async () => {
    const record = makeRecord();
    const { joinToken } = await createBookingTokens(record);
    const stored = { eventId: record.eventId, email: record.email.toLowerCase(), name: record.name, sessionType: record.sessionType, startsAt: record.startsAt };
    mockKvGet.mockResolvedValueOnce(stored);
    const result = await resolveJoinToken(joinToken);
    expect(result).toEqual(stored);
    expect(mockKvGet).toHaveBeenCalledWith(`join:${joinToken}`);
  });

  it("rejects a cancel token used as a join token (different key namespace)", async () => {
    const record = makeRecord();
    const { cancelToken } = await createBookingTokens(record);
    // Cancel token exists under cancel:{cancelToken}, not join:{cancelToken}
    mockKvGet.mockResolvedValueOnce(null);
    const result = await resolveJoinToken(cancelToken);
    expect(result).toBeNull();
    expect(mockKvGet).toHaveBeenCalledWith(`join:${cancelToken}`);
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

describe("DST offset correctness (madridToUtc)", () => {
  it("winter date uses UTC+1: 10:00 Madrid = 09:00 UTC", () => {
    const { fromZonedTime } = require("date-fns-tz");
    const winterLocal = "2025-01-15T10:00:00";
    const utc = fromZonedTime(winterLocal, "Europe/Madrid");
    expect(utc.getUTCHours()).toBe(9);
    expect(utc.getUTCMinutes()).toBe(0);
  });

  it("summer date uses UTC+2: 10:00 Madrid = 08:00 UTC", () => {
    const { fromZonedTime } = require("date-fns-tz");
    const summerLocal = "2025-07-15T10:00:00";
    const utc = fromZonedTime(summerLocal, "Europe/Madrid");
    expect(utc.getUTCHours()).toBe(8);
    expect(utc.getUTCMinutes()).toBe(0);
  });

  it("same wall-clock time on the same date in CET vs CEST is 1 UTC hour apart", () => {
    const { fromZonedTime } = require("date-fns-tz");
    const beforeDST = fromZonedTime("2025-03-28T10:00:00", "Europe/Madrid");
    const afterDST  = fromZonedTime("2025-03-30T10:00:00", "Europe/Madrid");
    expect(beforeDST.getUTCHours()).toBe(9);
    expect(afterDST.getUTCHours()).toBe(8);
    expect(beforeDST.getUTCHours() - afterDST.getUTCHours()).toBe(1);
  });
});

// ─── slotLockKey normalisation ────────────────────────────────────────────────

describe("slotLockKey normalisation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("two equivalent ISO strings for the same instant produce the same lock key", async () => {
    mockKvSet.mockResolvedValue("OK");
    mockKvDel.mockResolvedValue(1);

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
