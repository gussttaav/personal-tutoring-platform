// BUILD-02: unit tests for the bounded build-time retry helper. Covers the
// three behaviours the [locale] layout loaders rely on: no delay on first
// success, ride out a transient Supabase blip, and rethrow the real error once
// attempts are exhausted (so a genuinely-broken read still fails the build).
import { withRetry } from "@/lib/with-retry";

// Silence the structured logger (avoids Sentry side effects in tests).
jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

describe("withRetry", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("resolves on the first attempt without a backoff delay", async () => {
    const fn = jest.fn<Promise<string>, []>().mockResolvedValue("ok");
    await expect(withRetry(fn, "t")).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and then resolves", async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("PGRST303 JWT issued at future"))
      .mockResolvedValueOnce("ok");

    const p = withRetry(fn, "t");
    await jest.runAllTimersAsync(); // flush the backoff timer(s)
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows the last error after exhausting all attempts", async () => {
    const err = new Error("still down");
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(err);

    const p = withRetry(fn, "t", 3);
    const assertion = expect(p).rejects.toThrow("still down"); // attach early
    await jest.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
