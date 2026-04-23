/**
 * Unit tests for slot-lock helpers (ARCH-16: split from lib/calendar.ts).
 *
 * Covers:
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

jest.mock("@/infrastructure/redis/client", () => ({
  kv: {
    get: (...args: unknown[]) => mockKvGet(...args),
    set: (...args: unknown[]) => mockKvSet(...args),
    del: (...args: unknown[]) => mockKvDel(...args),
  },
}));

import {
  acquireSlotLock,
  releaseSlotLock,
} from "@/infrastructure/redis/slot-lock";

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
