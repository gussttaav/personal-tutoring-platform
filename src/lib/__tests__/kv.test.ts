/**
 * Unit tests for lib/kv.ts
 *
 * Mocks @vercel/kv so no real Redis connection is needed.
 * Mirrors the structure of the old sheets.test.ts.
 */

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockKvGet = jest.fn();
const mockKvSet = jest.fn();

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      get: (...args: unknown[]) => mockKvGet(...args),
      set: (...args: unknown[]) => mockKvSet(...args),
    }),
  },
}));

import { getCredits, addOrUpdateStudent, decrementCredit } from "@/lib/kv";
import type { CreditRecord } from "@/lib/kv";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

function pastDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function makeRecord(overrides: Partial<CreditRecord> = {}): CreditRecord {
  return {
    email: "student@example.com",
    name: "Ana García",
    credits: 5,
    packLabel: "Pack 5 clases",
    packSize: 5,
    expiresAt: futureDate(),
    lastUpdated: new Date().toISOString(),
    stripeSessionId: "cs_test_abc",
    ...overrides,
  };
}

// ─── getCredits ───────────────────────────────────────────────────────────────

describe("getCredits", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when the student is not found", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    expect(await getCredits("unknown@example.com")).toBeNull();
  });

  it("returns correct credits for an active pack", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 7 }));
    const result = await getCredits("student@example.com");
    expect(result?.credits).toBe(7);
    expect(result?.name).toBe("Ana García");
    expect(result?.packSize).toBe(5);
  });

  it("returns 0 credits when the pack is expired", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ expiresAt: pastDate() }));
    const result = await getCredits("student@example.com");
    expect(result?.credits).toBe(0);
  });

  it("reads the key with a lowercased email", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    await getCredits("UPPER@EXAMPLE.COM");
    expect(mockKvGet).toHaveBeenCalledWith("credits:upper@example.com");
  });

  it("falls back to parsing packSize from packLabel when packSize is null", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ packSize: null, packLabel: "Pack 10 clases" }));
    const result = await getCredits("student@example.com");
    expect(result?.packSize).toBe(10);
  });
});

// ─── addOrUpdateStudent ───────────────────────────────────────────────────────

describe("addOrUpdateStudent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a new record when the student does not exist", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    mockKvSet.mockResolvedValueOnce("OK");

    await addOrUpdateStudent("new@example.com", "Carlos", 5, "Pack 5 clases", "cs_new");

    expect(mockKvSet).toHaveBeenCalledTimes(1);
    const [savedKey, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedKey).toBe("credits:new@example.com");
    expect(savedRecord.credits).toBe(5);
    expect(savedRecord.stripeSessionId).toBe("cs_new");
  });

  it("accumulates credits onto an existing active pack", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 3, stripeSessionId: "cs_old" }));
    mockKvSet.mockResolvedValueOnce("OK");

    await addOrUpdateStudent("student@example.com", "Ana García", 5, "Pack 5 clases", "cs_new");

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.credits).toBe(8); // 3 + 5
    expect(savedRecord.stripeSessionId).toBe("cs_new");
  });

  it("resets credits to 0 before adding when the existing pack is expired", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 3, expiresAt: pastDate(), stripeSessionId: "cs_old" }));
    mockKvSet.mockResolvedValueOnce("OK");

    await addOrUpdateStudent("student@example.com", "Ana García", 5, "Pack 5 clases", "cs_new");

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.credits).toBe(5); // 0 (reset) + 5
  });

  it("skips write when stripeSessionId was already processed (idempotency)", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ stripeSessionId: "cs_already_done" }));

    await addOrUpdateStudent("student@example.com", "Ana García", 5, "Pack 5 clases", "cs_already_done");

    expect(mockKvSet).not.toHaveBeenCalled();
  });
});

// ─── decrementCredit ─────────────────────────────────────────────────────────

describe("decrementCredit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns ok:false when the student is not found", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    expect(await decrementCredit("ghost@example.com")).toEqual({ ok: false, remaining: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("returns ok:false when the pack is expired", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ expiresAt: pastDate() }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("returns ok:false when credits are already 0", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 0 }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("decrements credits by 1 and returns remaining", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 4 }));
    mockKvSet.mockResolvedValueOnce("OK");

    const result = await decrementCredit("student@example.com");
    expect(result).toEqual({ ok: true, remaining: 3 });

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.credits).toBe(3);
  });

  it("handles the last credit correctly (remaining becomes 0)", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 1 }));
    mockKvSet.mockResolvedValueOnce("OK");

    const result = await decrementCredit("student@example.com");
    expect(result).toEqual({ ok: true, remaining: 0 });
  });
});
