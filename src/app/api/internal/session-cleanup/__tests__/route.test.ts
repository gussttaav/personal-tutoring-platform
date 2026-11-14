// CRON-AUTH-01: the session-cleanup cron must reject every request when CRON_SECRET is
// unset (the template literal would otherwise accept the header "Bearer undefined").
import { NextRequest } from "next/server";

// REFACTOR-R5-P2-03: the sweep moved into BookingService.sweepPendingTerminations, so the
// route is tested against that one method: 200 passes its result through, a rejection is 500.
const mockSweep = jest.fn();
jest.mock("@/services", () => ({
  bookingService: { sweepPendingTerminations: (...args: unknown[]) => mockSweep(...args) },
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { GET } from "@/app/api/internal/session-cleanup/route";

const SECRET = "test-secret";

function makeReq(authorization: string | null = `Bearer ${SECRET}`): NextRequest {
  const headers: Record<string, string> = {};
  if (authorization !== null) headers.authorization = authorization;
  return new NextRequest("http://localhost/api/internal/session-cleanup", { headers });
}

describe("CRON-AUTH-01: GET /api/internal/session-cleanup auth", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mockSweep.mockResolvedValue({ cleared: 0, failed: 0, examined: 0 });
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 403 with a wrong secret", async () => {
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(403);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("returns 403 when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq("Bearer undefined"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it("runs with the right secret", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(mockSweep).toHaveBeenCalledWith({ maxBatch: 50, maxAttempts: 5 });
  });
});

describe("REFACTOR-R5-P2-03: GET /api/internal/session-cleanup answers what the sweep did", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 200 with the sweep's counts", async () => {
    mockSweep.mockResolvedValue({ cleared: 2, failed: 1, examined: 3 });

    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cleared: 2, failed: 1, examined: 3 });
  });

  it("returns 500 when the sweep rejects (listing failed)", async () => {
    mockSweep.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeReq());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Query failed" });
  });
});
