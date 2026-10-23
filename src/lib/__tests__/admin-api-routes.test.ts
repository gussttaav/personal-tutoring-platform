/**
 * ADMIN-01 — Unit tests for admin API routes.
 * Mocks auth and services. No real I/O.
 *
 * REFACTOR-R4-P3-02: the routes read through adminService (the admin `_data.ts` module
 * they used to import is gone) and the credit adjustment moved into
 * AdminService.adjustCredits, so the POST tests assert the delegation and the
 * { requested, applied } response; the debit loop itself is covered in
 * src/services/__tests__/AdminService.test.ts. The POST runs the REAL isValidOrigin:
 * a cross-site request is refused before the session is even read.
 *
 * ADMIN-USERS-01: GET /api/admin/students lists users (adminService.listUsers) by tab and
 * answers { users, counts, filter, page, pageSize }.
 */

import { NextRequest } from "next/server";
import type { Session } from "next-auth";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockAuth = jest.fn<Promise<Session | null>, []>();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockAdjustCredits = jest.fn();
const mockListUsers     = jest.fn();
jest.mock("@/services", () => ({
  adminService: {
    adjustCredits:       (...args: unknown[]) => mockAdjustCredits(...args),
    listUsers:           (...args: unknown[]) => mockListUsers(...args),
    getStudent:          jest.fn().mockResolvedValue({ id: "u1", email: "test@example.com", name: "Test User" }),
    listCreditPacks:     jest.fn().mockResolvedValue([]),
    listStudentBookings: jest.fn().mockResolvedValue([]),
    listAuditLog:        jest.fn().mockResolvedValue([]),
    listAllBookings:     jest.fn().mockResolvedValue([]),
    listPayments:        jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost";

function makeSession(email: string, isAdmin = false): Session {
  return { user: { email, name: "Test", isAdmin }, expires: new Date(Date.now() + 3_600_000).toISOString() };
}

function makeRequest(
  body: unknown,
  email = "target@example.com",
  headers: Record<string, string> = { origin: BASE_URL },
): NextRequest {
  return new NextRequest(`${BASE_URL}/api/admin/students/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body:    JSON.stringify(body),
  });
}

const ADMIN_EMAIL = "admin@example.com";

const COUNTS = { all: 0, credits: 0, upcoming: 0, booked: 0, courses: 0, subscribed: 0 };

// ─── POST /api/admin/students/[email] ────────────────────────────────────────

describe("POST /api/admin/students/[email]", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ email: string }> }) => Promise<Response>;
  const savedBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/admin/students/[email]/route"));
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    process.env.NEXT_PUBLIC_BASE_URL = BASE_URL;
    jest.clearAllMocks();
    mockAdjustCredits.mockImplementation(async ({ amount }: { amount: number }) => ({
      requested: amount, applied: amount,
    }));
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
    if (savedBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = savedBaseUrl;
  });

  const params = Promise.resolve({ email: encodeURIComponent("target@example.com") });

  it("returns 403 for a cross-site origin, before reading the session", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(
      makeRequest({ action: "adjust_credits", amount: 5, reason: "x" }, "target@example.com", {
        origin: "https://evil.example", "sec-fetch-site": "cross-site",
      }),
      { params },
    );
    expect(res.status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockAdjustCredits).not.toHaveBeenCalled();
  });

  it("returns 403 when the Origin header is missing", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(
      makeRequest({ action: "adjust_credits", amount: 5, reason: "x" }, "target@example.com", {}),
      { params },
    );
    expect(res.status).toBe(403);
    expect(mockAdjustCredits).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 1, reason: "test" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    mockAuth.mockResolvedValue(makeSession("student@example.com"));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 1, reason: "test" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 400 when reason is missing", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 1 }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is wrong", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "delete_user", amount: 1, reason: "x" }), { params });
    expect(res.status).toBe(400);
  });

  it("delegates a positive adjustment to adminService with admin attribution", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 3, reason: "Reposición" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, requested: 3, applied: 3 });
    expect(mockAdjustCredits).toHaveBeenCalledWith({
      email: "target@example.com", amount: 3, reason: "Reposición", by: ADMIN_EMAIL,
    });
  });

  it("reports a partial debit instead of a plain ok", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    mockAdjustCredits.mockResolvedValue({ requested: -3, applied: -1 });
    const res = await POST(makeRequest({ action: "adjust_credits", amount: -3, reason: "Corrección" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, requested: -3, applied: -1 });
  });

  it("delegates amount 0 too (the service records the attribution)", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 0, reason: "noop" }), { params });
    expect(res.status).toBe(200);
    expect(mockAdjustCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }));
  });

  it("returns 500 when the adjustment fails for a reason other than the balance", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    mockAdjustCredits.mockRejectedValue(new Error("connection reset"));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: -3, reason: "Corrección" }), { params });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
  });
});

// ─── GET /api/admin/students/route ───────────────────────────────────────────

describe("GET /api/admin/students", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/admin/students/route"));
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    jest.clearAllMocks();
    mockListUsers.mockResolvedValue({ rows: [], counts: COUNTS });
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  function makeGetRequest(query = "") {
    return new NextRequest(`http://localhost/api/admin/students${query}`);
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("student@example.com"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns 200 with users for admin, on the «all» tab by default", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { users: unknown[]; filter: string };
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.filter).toBe("all");
    expect(mockListUsers).toHaveBeenCalledWith({ query: undefined, segment: "all", page: 1, pageSize: 50 });
  });

  it("passes search, tab and page to the service and returns every count", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const row = {
      email: "ana@example.com", name: "Ana", createdAt: "2026-10-01T00:00:00.000Z",
      unbookedCredits: 2, earliestExpiry: null, nextSession: null, bookingsCount: 3,
      courses: [], subscriptions: [],
    };
    mockListUsers.mockResolvedValue({ rows: [row], counts: { ...COUNTS, all: 120, credits: 7 } });

    const res = await GET(makeGetRequest("?q=ana&filter=credits&page=2"));

    expect(mockListUsers).toHaveBeenCalledWith({ query: "ana", segment: "credits", page: 2, pageSize: 50 });
    expect(await res.json()).toEqual({
      users: [row], counts: { ...COUNTS, all: 120, credits: 7 }, filter: "credits", page: 2, pageSize: 50,
    });
  });

  it("an unknown tab — the old low-credit one included — reads as «all»", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));

    await GET(makeGetRequest("?filter=low-credit"));

    expect(mockListUsers).toHaveBeenCalledWith({ query: undefined, segment: "all", page: 1, pageSize: 50 });
  });
});

// ─── GET /api/admin/bookings ──────────────────────────────────────────────────

describe("GET /api/admin/bookings", () => {
  let GET: () => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/admin/bookings/route"));
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("student@example.com"));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with bookings for admin", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/admin/payments ──────────────────────────────────────────────────

describe("GET /api/admin/payments", () => {
  let GET: () => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/admin/payments/route"));
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("student@example.com"));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with payments for admin", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
