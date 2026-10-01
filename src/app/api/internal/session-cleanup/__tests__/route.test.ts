// CRON-AUTH-01: the session-cleanup cron must reject every request when CRON_SECRET is
// unset (the template literal would otherwise accept the header "Bearer undefined").
import { NextRequest } from "next/server";

const mockList = jest.fn();
jest.mock("@/infrastructure/supabase", () => ({
  supabaseBookingRepository: {
    listDuePendingTerminations:    (...args: unknown[]) => mockList(...args),
    deletePendingTermination:      jest.fn(),
    recordPendingTerminationFailure: jest.fn(),
  },
}));

const mockFinalize = jest.fn();
jest.mock("@/services", () => ({
  bookingService: { finalizePastSession: (...args: unknown[]) => mockFinalize(...args) },
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
    mockList.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 403 with a wrong secret", async () => {
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns 403 when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq("Bearer undefined"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(mockList).not.toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("runs with the right secret", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalled();
  });
});
