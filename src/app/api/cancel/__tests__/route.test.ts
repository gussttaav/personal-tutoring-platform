// REFACTOR-R3-P2-02: POST /api/cancel — per-IP rate limit and handler ordering.
// The route is deliberately unauthenticated (emailed cancel tokens), so the
// limiter is the only thing capping token guessing.
import { NextRequest } from "next/server";

// Counting fake for the sliding-window limiter: 5 hits per IP, then blocked.
const LIMIT = 5;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  cancelRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...args: unknown[]) => mockIsValidOrigin(...args) }));

const mockCancelByToken = jest.fn();
jest.mock("@/services", () => ({
  bookingService: { cancelByToken: (...args: unknown[]) => mockCancelByToken(...args) },
}));

jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "es" }) }),
}));

import { POST } from "@/app/api/cancel/route";

const TOKEN = "t".repeat(64);

function makeReq(ip: string, origin = "http://localhost:3000"): NextRequest {
  return new NextRequest("http://localhost:3000/api/cancel", {
    method:  "POST",
    headers: { "x-forwarded-for": ip, origin, "content-type": "application/json" },
    body:    JSON.stringify({ token: TOKEN }),
  });
}

describe("REFACTOR-R3-P2-02: POST /api/cancel rate limiting", () => {
  beforeEach(() => {
    hits.clear();
    jest.clearAllMocks();
    mockIsValidOrigin.mockReturnValue(true);
    mockCancelByToken.mockResolvedValue({ refunded: true });
  });

  it("allows the first 5 requests from one IP", async () => {
    for (let i = 1; i <= LIMIT; i++) {
      const res = await POST(makeReq("203.0.113.1"));
      expect(res.status).toBe(200);
    }
    expect(mockCancelByToken).toHaveBeenCalledTimes(LIMIT);
  });

  it("429s the 6th request from the same IP without touching the service", async () => {
    for (let i = 1; i <= LIMIT; i++) await POST(makeReq("203.0.113.1"));
    mockCancelByToken.mockClear();

    const res = await POST(makeReq("203.0.113.1"));

    expect(res.status).toBe(429);
    expect(mockCancelByToken).not.toHaveBeenCalled();
  });

  it("keys the limiter per IP — a second IP has its own budget", async () => {
    for (let i = 1; i <= LIMIT + 1; i++) await POST(makeReq("203.0.113.1"));

    const res = await POST(makeReq("198.51.100.7"));

    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenLastCalledWith("198.51.100.7");
  });

  it("takes only the leftmost x-forwarded-for hop as the key", async () => {
    await POST(makeReq("203.0.113.1, 10.0.0.1, 172.16.0.1"));

    expect(mockLimit).toHaveBeenCalledWith("203.0.113.1");
  });

  it("rejects with 429 before the CSRF check, not 403", async () => {
    for (let i = 1; i <= LIMIT; i++) await POST(makeReq("203.0.113.1"));
    mockIsValidOrigin.mockClear();
    mockIsValidOrigin.mockReturnValue(false);

    const res = await POST(makeReq("203.0.113.1", "https://evil.example"));

    expect(res.status).toBe(429);
    expect(mockIsValidOrigin).not.toHaveBeenCalled();
  });
});
