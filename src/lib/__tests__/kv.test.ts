/**
 * Unit tests for lib/kv.ts
 *
 * Mocks @upstash/redis so no real Redis connection is needed.
 */

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockKvGet  = jest.fn();
const mockKvSet  = jest.fn();
const mockKvLpush = jest.fn();
const mockKvLtrim = jest.fn();
const mockKvDel  = jest.fn();
const mockKvEval = jest.fn();

jest.mock("@/infrastructure/redis/client", () => ({
  kv: {
    get:   (...args: unknown[]) => mockKvGet(...args),
    set:   (...args: unknown[]) => mockKvSet(...args),
    del:   (...args: unknown[]) => mockKvDel(...args),
    lpush: (...args: unknown[]) => mockKvLpush(...args),
    ltrim: (...args: unknown[]) => mockKvLtrim(...args),
    eval:  (...args: unknown[]) => mockKvEval(...args),
  },
}));

import {
  getCredits,
  addOrUpdateStudent,
  decrementCredit,
  restoreCredit,
  appendAuditLog,
} from "@/infrastructure/redis/credits-store";
import type { CreditRecord } from "@/domain/types";

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
    email:           "student@example.com",
    name:            "Ana García",
    credits:         5,
    packLabel:       "Pack 5 clases",
    packSize:        5,
    expiresAt:       futureDate(),
    lastUpdated:     new Date().toISOString(),
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

  it("reads the key with a lowercased, trimmed email", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    await getCredits("  UPPER@EXAMPLE.COM  ");
    expect(mockKvGet).toHaveBeenCalledWith("credits:upper@example.com");
  });

  it("falls back to parsing packSize from packLabel when packSize field is null", async () => {
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
    mockKvGet.mockResolvedValueOnce(
      makeRecord({ credits: 3, expiresAt: pastDate(), stripeSessionId: "cs_old" })
    );
    mockKvSet.mockResolvedValueOnce("OK");

    await addOrUpdateStudent("student@example.com", "Ana García", 5, "Pack 5 clases", "cs_new");

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.credits).toBe(5); // 0 (reset) + 5
  });

  it("is idempotent: skips write when stripeSessionId was already processed", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ stripeSessionId: "cs_already_done" }));

    await addOrUpdateStudent("student@example.com", "Ana García", 5, "Pack 5 clases", "cs_already_done");

    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("writes the email in lowercase", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    mockKvSet.mockResolvedValueOnce("OK");

    await addOrUpdateStudent("UPPER@EXAMPLE.COM", "Carlos", 5, "Pack 5 clases", "cs_x");

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.email).toBe("upper@example.com");
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
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: false, remaining: 0 }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("returns ok:false when credits are already 0", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 0 }));
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: false, remaining: 0 }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("decrements credits by 1 and returns remaining", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 4 }));
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: true, remaining: 3 }));

    const result = await decrementCredit("student@example.com");
    expect(result).toEqual({ ok: true, remaining: 3 });
  });

  it("handles the last credit correctly (remaining becomes 0)", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 1 }));
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: true, remaining: 0 }));

    const result = await decrementCredit("student@example.com");
    expect(result).toEqual({ ok: true, remaining: 0 });
  });

  it("concurrency: exactly one of two simultaneous requests on credits:1 succeeds", async () => {
    mockKvGet.mockResolvedValue(makeRecord({ credits: 1 }));
    mockKvEval
      .mockResolvedValueOnce(JSON.stringify({ ok: true,  remaining: 0 }))
      .mockResolvedValueOnce(JSON.stringify({ ok: false, remaining: 0 }));

    const [r1, r2] = await Promise.all([
      decrementCredit("student@example.com"),
      decrementCredit("student@example.com"),
    ]);
    const successes = [r1, r2].filter(r => r.ok);
    expect(successes).toHaveLength(1);
    expect(successes[0].remaining).toBe(0);
  });

  it("Lua path: returns ok:false for an expired pack", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ expiresAt: pastDate() }));
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: false, remaining: 0 }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
  });

  it("Lua path: returns ok:false when credits are 0", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 0 }));
    mockKvEval.mockResolvedValueOnce(JSON.stringify({ ok: false, remaining: 0 }));
    expect(await decrementCredit("student@example.com")).toEqual({ ok: false, remaining: 0 });
  });
});

// ─── restoreCredit ────────────────────────────────────────────────────────────

describe("restoreCredit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns ok:false when the student is not found", async () => {
    mockKvGet.mockResolvedValueOnce(null);
    expect(await restoreCredit("ghost@example.com")).toEqual({ ok: false, credits: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("returns ok:false when the pack is expired", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ expiresAt: pastDate() }));
    expect(await restoreCredit("student@example.com")).toEqual({ ok: false, credits: 0 });
    expect(mockKvSet).not.toHaveBeenCalled();
  });

  it("restores 1 credit and writes the updated record", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 3, packSize: 5 }));
    mockKvSet.mockResolvedValueOnce("OK");

    const result = await restoreCredit("student@example.com");
    expect(result).toEqual({ ok: true, credits: 4 });

    const [, savedRecord] = mockKvSet.mock.calls[0];
    expect(savedRecord.credits).toBe(4);
  });

  it("caps restored credits at packSize — never exceeds purchased amount", async () => {
    mockKvGet.mockResolvedValueOnce(makeRecord({ credits: 5, packSize: 5 }));
    mockKvSet.mockResolvedValueOnce("OK");

    const result = await restoreCredit("student@example.com");
    expect(result).toEqual({ ok: true, credits: 5 }); // already at cap
  });

  it("uses packLabel to infer packSize when packSize field is null", async () => {
    mockKvGet.mockResolvedValueOnce(
      makeRecord({ credits: 4, packSize: null, packLabel: "Pack 5 clases" })
    );
    mockKvSet.mockResolvedValueOnce("OK");

    const result = await restoreCredit("student@example.com");
    expect(result).toEqual({ ok: true, credits: 5 }); // inferred packSize = 5, capped
  });
});

// ─── appendAuditLog ───────────────────────────────────────────────────────────

describe("appendAuditLog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls lpush with the audit key and a serialized entry", async () => {
    mockKvLpush.mockResolvedValueOnce(1);
    mockKvLtrim.mockResolvedValueOnce("OK");

    await appendAuditLog("student@example.com", "decrement", { credits: 3 });

    expect(mockKvLpush).toHaveBeenCalledTimes(1);
    const [auditKey, entry] = mockKvLpush.mock.calls[0];
    expect(auditKey).toBe("audit:student@example.com");
    const parsed = JSON.parse(entry);
    expect(parsed.action).toBe("decrement");
    expect(parsed.credits).toBe(3);
    expect(parsed.ts).toBeDefined();
  });

  it("calls ltrim to cap the log at MAX_AUDIT_ENTRIES", async () => {
    mockKvLpush.mockResolvedValueOnce(1);
    mockKvLtrim.mockResolvedValueOnce("OK");

    await appendAuditLog("student@example.com", "restore", {});

    expect(mockKvLtrim).toHaveBeenCalledTimes(1);
    const [, start, stop] = mockKvLtrim.mock.calls[0];
    expect(start).toBe(0);
    expect(stop).toBeGreaterThan(0); // MAX_AUDIT_ENTRIES - 1
  });

  it("does not throw when Redis is unavailable (best-effort)", async () => {
    mockKvLpush.mockRejectedValueOnce(new Error("Redis connection failed"));

    // Should resolve without throwing — audit log is non-critical
    await expect(appendAuditLog("student@example.com", "decrement", {})).resolves.not.toThrow();
  });
});
