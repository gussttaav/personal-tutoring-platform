// REFACTOR-R4-P3-02 — POST /api/admin/failed-bookings (dead-letter retry).
//
// Same shape as src/app/api/admin/feedback/__tests__ (mock factories before the route
// import, real NextRequest objects), but with the REAL isValidOrigin: the route used to
// skip the CSRF check every other admin mutation makes. Pins that a cross-site request
// is refused before the session is read, and that a same-origin one still retries.
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const mockReprocess = jest.fn();
jest.mock("@/services", () => ({
  paymentService: {
    reprocessFailedBooking: (...a: unknown[]) => mockReprocess(...a),
    listFailedBookings:     jest.fn().mockResolvedValue([]),
  },
}));

import { POST } from "@/app/api/admin/failed-bookings/route";

const ORIGIN = "http://localhost:3000";
const ADMIN  = { user: { email: "admin@example.com", isAdmin: true } };
const savedBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

function req(headers: Record<string, string>, body: unknown = { stripeSessionId: "pi_123" }) {
  return POST(new NextRequest(`${ORIGIN}/api/admin/failed-bookings`, {
    method:  "POST",
    headers: { "content-type": "application/json", ...headers },
    body:    JSON.stringify(body),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_BASE_URL = ORIGIN;
  mockAuth.mockResolvedValue(ADMIN);
  mockReprocess.mockResolvedValue({ ok: true });
});

afterAll(() => {
  if (savedBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_BASE_URL = savedBaseUrl;
});

describe("REFACTOR-R4-P3-02: POST /api/admin/failed-bookings", () => {
  it("retries a failed booking for a same-origin admin request", async () => {
    const res = await req({ origin: ORIGIN });

    expect(res.status).toBe(200);
    expect(mockReprocess).toHaveBeenCalledWith("pi_123");
  });

  it("403s a cross-site request before reading the session", async () => {
    const res = await req({ origin: "https://evil.example", "sec-fetch-site": "cross-site" });

    expect(res.status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockReprocess).not.toHaveBeenCalled();
  });

  it("403s a foreign Origin even without Sec-Fetch-Site", async () => {
    const res = await req({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(mockReprocess).not.toHaveBeenCalled();
  });

  it("403s a request with no Origin", async () => {
    const res = await req({});

    expect(res.status).toBe(403);
    expect(mockReprocess).not.toHaveBeenCalled();
  });

  it("401s a same-origin request without a session", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await req({ origin: ORIGIN });

    expect(res.status).toBe(401);
    expect(mockReprocess).not.toHaveBeenCalled();
  });
});
