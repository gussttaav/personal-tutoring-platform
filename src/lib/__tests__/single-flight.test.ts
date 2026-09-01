// BUILD-04: the prerender fired six identical concurrent reads and one
// PGRST303 rejection aborted the export. These cover the two guarantees the
// fix relies on: concurrent callers share ONE underlying call, and a single
// rejection is retried rather than propagated.
import { singleFlight, withRetry } from "@/lib/single-flight";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

describe("singleFlight", () => {
  it("collapses concurrent callers into one underlying call", async () => {
    let resolveFn: (v: string) => void = () => {};
    const fn = jest.fn(() => new Promise<string>((res) => { resolveFn = res; }));
    const read = singleFlight("t", fn);

    // Six concurrent callers, mirroring the observed prerender burst.
    const all = Promise.all([read(), read(), read(), read(), read(), read()]);
    resolveFn("value");

    expect(await all).toEqual(Array(6).fill("value"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs again once the previous call has settled", async () => {
    const fn = jest.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const read = singleFlight("t", fn);
    expect(await read()).toBe("a");
    expect(await read()).toBe("b");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not latch a rejection — a later call retries", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("PGRST303"))
      .mockResolvedValueOnce("ok");
    const read = singleFlight("t", fn);
    await expect(read()).rejects.toThrow("PGRST303");
    await expect(read()).resolves.toBe("ok");
  });
});

describe("withRetry", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("recovers from a single PGRST303 rejection", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("JWT issued at future"))
      .mockResolvedValueOnce("ok");
    const p = withRetry(fn, "t");
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows after exhausting attempts", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("down"));
    const p = withRetry(fn, "t", 3);
    const assertion = expect(p).rejects.toThrow("down");
    await jest.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
