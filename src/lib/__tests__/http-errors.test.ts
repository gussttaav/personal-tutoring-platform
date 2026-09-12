// OBS-03: Verify unexpected-error serialisation, in particular Supabase's
// PostgrestError shape (a plain object, not an Error instance).
import * as Sentry from "@sentry/nextjs";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { DomainError } from "@/domain/errors";

jest.mock("@sentry/nextjs");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function loggedError(): string {
  const call = (console.error as jest.Mock).mock.calls[0][0] as string;
  return JSON.parse(call).error;
}

describe("mapDomainErrorToResponse", () => {
  it("maps a DomainError to its HTTP status without logging", async () => {
    const err = new DomainError("no credits", "INSUFFICIENT_CREDITS");
    const res = mapDomainErrorToResponse(err);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "INSUFFICIENT_CREDITS" });
    expect(console.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("logs an Error instance's name and message", () => {
    mapDomainErrorToResponse(new TypeError("boom"));
    expect(loggedError()).toBe("TypeError: boom");
  });

  it("logs a Supabase PostgrestError-shaped object as code: message", () => {
    const postgrestError = {
      code: "PGRST205",
      message: "Could not find the table 'public.content_votes' in the schema cache",
      details: null,
      hint: null,
    };

    mapDomainErrorToResponse(postgrestError);

    expect(loggedError()).toBe(
      "PGRST205: Could not find the table 'public.content_votes' in the schema cache"
    );
  });

  it("appends details and hint when present", () => {
    const postgrestError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (id)=(1) already exists.",
      hint: "Use an upsert instead.",
    };

    mapDomainErrorToResponse(postgrestError);

    expect(loggedError()).toBe(
      "23505: duplicate key value violates unique constraint | details: Key (id)=(1) already exists. | hint: Use an upsert instead."
    );
  });

  it("falls back to JSON.stringify for a plain object without code/message", () => {
    mapDomainErrorToResponse({ foo: "bar" });
    expect(loggedError()).toBe('{"foo":"bar"}');
  });

  it("falls back to String() when JSON.stringify would throw", () => {
    const circular: Record<string, unknown> = { foo: "bar" };
    circular.self = circular;

    mapDomainErrorToResponse(circular);
    expect(loggedError()).toBe(String(circular));
  });

  it("still captures the raw value to Sentry and returns 500", async () => {
    const postgrestError = { code: "PGRST205", message: "missing table" };
    const res = mapDomainErrorToResponse(postgrestError, { route: "/api/content/vote" });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "INTERNAL_ERROR" });
    expect(Sentry.captureException).toHaveBeenCalledWith(postgrestError, {
      extra: { route: "/api/content/vote" },
    });
  });
});
