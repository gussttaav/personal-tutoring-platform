// REFACTOR-R4-P1-01: POST /api/book — the per-user rate limit and the mapping of the
// slot validator's domain errors. The validation itself lives in BookingService
// (BookingService.test.ts); the route only has to get the status codes right.
import { NextRequest } from "next/server";
import { FreeSessionAlreadyUsedError, InvalidSlotError, SlotUnavailableError } from "@/domain/errors";

// Counting fake for the sliding-window limiter: 10 hits per key, then blocked.
const LIMIT = 10;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  bookRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...args: unknown[]) => mockIsValidOrigin(...args) }));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockCreateBooking = jest.fn();
jest.mock("@/services", () => ({
  bookingService: { createBooking: (...args: unknown[]) => mockCreateBooking(...args) },
}));

import { POST } from "@/app/api/book/route";

const BODY = {
  startIso:    "2026-10-05T13:30:00.000Z",
  endIso:      "2026-10-05T13:45:00.000Z",
  sessionType: "free15min",
};

function makeReq(body: unknown = BODY): NextRequest {
  return new NextRequest("http://localhost:3000/api/book", {
    method:  "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const signedIn = (email: string) => mockGetSession.mockResolvedValue({ user: { email, name: "Ana" } });

beforeEach(() => {
  hits.clear();
  jest.clearAllMocks();
  mockIsValidOrigin.mockReturnValue(true);
  mockCreateBooking.mockResolvedValue({ eventId: "evt1", cancelToken: "c", joinToken: "j", emailFailed: false });
  signedIn("ana@test.com");
});

describe("REFACTOR-R4-P1-01: POST /api/book rate limit", () => {
  it("allows 10 requests a minute for one user", async () => {
    for (let i = 1; i <= LIMIT; i++) {
      expect((await POST(makeReq())).status).toBe(200);
    }
    expect(mockCreateBooking).toHaveBeenCalledTimes(LIMIT);
  });

  it("429s the 11th request without reaching the service", async () => {
    for (let i = 1; i <= LIMIT; i++) await POST(makeReq());
    mockCreateBooking.mockClear();

    const res = await POST(makeReq());

    expect(res.status).toBe(429);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it("keys the limiter by the session email, so another user has their own budget", async () => {
    for (let i = 1; i <= LIMIT + 1; i++) await POST(makeReq());

    signedIn("ben@test.com");
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenLastCalledWith("ben@test.com");
  });

  it("does not spend budget on unauthenticated requests", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe("REFACTOR-R4-P1-01: POST /api/book slot-validation errors", () => {
  it.each([
    [new InvalidSlotError(),            400, "INVALID_SLOT"],
    [new SlotUnavailableError(),        409, "SLOT_UNAVAILABLE"],
    [new FreeSessionAlreadyUsedError(), 409, "FREE_SESSION_ALREADY_USED"],
  ])("maps %p to %i", async (err, status, code) => {
    mockCreateBooking.mockRejectedValue(err);

    const res = await POST(makeReq());

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it("books with the session identity and the client's window", async () => {
    await POST(makeReq());

    expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({
      email: "ana@test.com", startIso: BODY.startIso, endIso: BODY.endIso, sessionType: "free15min",
    }));
  });
});
