// REFACTOR-P3-03: stateful in-memory kv mock so coalescing can be exercised —
// the loser-of-lock caller must be able to re-read what the winner wrote.
jest.mock("@/infrastructure/redis/client", () => {
  const store = new Map<string, unknown>();
  return {
    kv: {
      get: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
      set: jest.fn(async (key: string, value: unknown, opts?: { nx?: boolean }) => {
        if (opts?.nx && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }),
      del: jest.fn(async (key: string) => { store.delete(key); return 1; }),
      __store: store,
    },
  };
});

import { cacheTTLSeconds, getOrCompute } from "@/lib/availability-cache";
import { kv } from "@/infrastructure/redis/client";

describe("cacheTTLSeconds", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(cacheTTLSeconds(today)).toBe(0);
  });

  it("returns 0 for tomorrow", () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(0);
  });

  it("returns 300 for 3 days ahead", () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(300);
  });

  it("returns 300 for 7 days ahead", () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(300);
  });

  it("returns 900 for 14 days ahead", () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    expect(cacheTTLSeconds(d.toISOString().slice(0, 10))).toBe(900);
  });
});

describe("REFACTOR-P3-03: getOrCompute cache coalescing", () => {
  beforeEach(() => {
    (kv as unknown as { __store: Map<string, unknown> }).__store.clear();
    jest.clearAllMocks();
  });

  it("collapses two concurrent misses into one compute call", async () => {
    const value = { slots: [{ start: "s", end: "e", label: "l" }] };
    const computeFn = jest.fn().mockResolvedValue(value);

    const [a, b] = await Promise.all([
      getOrCompute("avail:test", computeFn, 60),
      getOrCompute("avail:test", computeFn, 60),
    ]);

    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).toEqual(value);
  });

  it("falls through to compute if lock acquire fails", async () => {
    // Lock not acquired and value still absent on re-read → compute ourselves.
    jest.spyOn(kv, "set").mockResolvedValueOnce(null as never);
    const computeFn = jest.fn().mockResolvedValue({ slots: [] });

    await getOrCompute("avail:test-2", computeFn, 60);

    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it("skips cache and lock for the no-cache window (ttl 0)", async () => {
    const computeFn = jest.fn().mockResolvedValue({ slots: [] });

    await getOrCompute("avail:test-3", computeFn, 0);

    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it("returns the cached value on a hit without computing", async () => {
    const cached = { slots: [{ start: "x", end: "y", label: "z" }] };
    await kv.set("avail:test-4", cached, { ex: 60 });
    const computeFn = jest.fn().mockResolvedValue({ slots: [] });

    const result = await getOrCompute("avail:test-4", computeFn, 60);

    expect(result).toEqual(cached);
    expect(computeFn).not.toHaveBeenCalled();
  });
});
