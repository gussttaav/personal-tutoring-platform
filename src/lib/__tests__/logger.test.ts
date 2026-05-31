// OBS-02: Verify that error-level logs are forwarded to Sentry.
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";
import { withRequestContext } from "@/lib/request-context";

jest.mock("@sentry/nextjs");

const mockCaptureMessage = Sentry.captureMessage as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("log()", () => {
  test("error level forwards to Sentry.captureMessage", () => {
    log("error", "something failed", { service: "test", foo: "bar" });

    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith("something failed", {
      level: "error",
      extra: expect.objectContaining({ service: "test", foo: "bar" }),
      tags: { service: "test" },
    });
  });

  test("warn level does not call Sentry", () => {
    log("warn", "something slow", { service: "kv" });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  test("info level does not call Sentry", () => {
    log("info", "credits updated", { service: "kv", credits: 3 });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  test("error with no context uses 'unknown' service tag", () => {
    log("error", "bare error");

    expect(mockCaptureMessage).toHaveBeenCalledWith("bare error", {
      level: "error",
      extra: {},
      tags: { service: "unknown" },
    });
  });
});

// REFACTOR-P4-02: request ID stamped onto every log line via AsyncLocalStorage.
describe("REFACTOR-P4-02: request ID in logs", () => {
  it("includes requestId when called inside withRequestContext", () => {
    withRequestContext({ requestId: "req_abc" }, () => {
      log("info", "test", { service: "test" });
    });
    const payload = JSON.parse(
      (console.log as jest.Mock).mock.calls[0][0] as string
    );
    expect(payload.requestId).toBe("req_abc");
  });

  it("omits requestId when called outside any context", () => {
    log("info", "test", { service: "test" });
    const payload = JSON.parse(
      (console.log as jest.Mock).mock.calls[0][0] as string
    );
    expect(payload.requestId).toBeUndefined();
  });

  it("forwards requestId to Sentry extra on error", () => {
    withRequestContext({ requestId: "req_err" }, () => {
      log("error", "boom", { service: "test" });
    });
    expect(mockCaptureMessage).toHaveBeenCalledWith("boom", {
      level: "error",
      extra: expect.objectContaining({ service: "test", requestId: "req_err" }),
      tags: { service: "test" },
    });
  });

  it("does not leak requestId between contexts", async () => {
    await Promise.all([
      withRequestContext({ requestId: "req_a" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        log("info", "from a");
      }),
      withRequestContext({ requestId: "req_b" }, async () => {
        log("info", "from b");
      }),
    ]);

    const payloads = (console.log as jest.Mock).mock.calls.map((c) =>
      JSON.parse(c[0] as string)
    );
    const fromA = payloads.find((p) => p.message === "from a");
    const fromB = payloads.find((p) => p.message === "from b");
    expect(fromA?.requestId).toBe("req_a");
    expect(fromB?.requestId).toBe("req_b");
  });
});
