/**
 * ADMIN-01 — Unit tests for admin API routes.
 * Mocks auth, services, repos, and data helpers. No real I/O.
 */

import { NextRequest } from "next/server";
import type { Session } from "next-auth";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockAuth = jest.fn<Promise<Session | null>, []>();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockAddCredits = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockUseCredit  = jest.fn<Promise<{ remaining: number }>, [string]>().mockResolvedValue({ remaining: 0 });
jest.mock("@/services", () => ({
  creditService: {
    addCredits: (...args: unknown[]) => mockAddCredits(args),
    useCredit:  (email: string) => mockUseCredit(email),
  },
  paymentService: { listFailedBookings: jest.fn().mockResolvedValue([]) },
}));

const mockAuditAppend = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockAuditList   = jest.fn().mockResolvedValue([]);
jest.mock("@/infrastructure/supabase", () => ({
  supabaseAuditRepository: {
    append: (...args: unknown[]) => mockAuditAppend(args),
    list:   () => mockAuditList(),
  },
}));

jest.mock("@/app/admin/_data", () => ({
  fetchStudents:       jest.fn().mockResolvedValue([]),
  fetchStudent:        jest.fn().mockResolvedValue({ id: "u1", email: "test@example.com", name: "Test User" }),
  fetchCreditPacks:    jest.fn().mockResolvedValue([]),
  fetchStudentBookings: jest.fn().mockResolvedValue([]),
  fetchAuditLog:       jest.fn().mockResolvedValue([]),
  fetchAllBookings:    jest.fn().mockResolvedValue([]),
  fetchPayments:       jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(email: string, isAdmin = false): Session {
  return { user: { email, name: "Test", isAdmin }, expires: new Date(Date.now() + 3_600_000).toISOString() };
}

function makeRequest(body: unknown, email = "target@example.com"): NextRequest {
  return new NextRequest(`http://localhost/api/admin/students/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const ADMIN_EMAIL = "admin@example.com";

// ─── POST /api/admin/students/[email] ────────────────────────────────────────

describe("POST /api/admin/students/[email]", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ email: string }> }) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/admin/students/[email]/route"));
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    jest.clearAllMocks();
    mockAddCredits.mockResolvedValue(undefined);
    mockUseCredit.mockResolvedValue({ remaining: 0 });
    mockAuditAppend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  const params = Promise.resolve({ email: encodeURIComponent("target@example.com") });

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

  it("calls addCredits for positive adjustment", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 3, reason: "Reposición" }), { params });
    expect(res.status).toBe(200);
    expect(mockAddCredits).toHaveBeenCalledTimes(1);
    expect(mockUseCredit).not.toHaveBeenCalled();
    expect(mockAuditAppend).toHaveBeenCalledTimes(1);
  });

  it("loops useCredit for negative adjustment", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: -2, reason: "Corrección" }), { params });
    expect(res.status).toBe(200);
    expect(mockUseCredit).toHaveBeenCalledTimes(2);
    expect(mockAddCredits).not.toHaveBeenCalled();
    expect(mockAuditAppend).toHaveBeenCalledTimes(1);
  });

  it("does nothing for amount 0", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await POST(makeRequest({ action: "adjust_credits", amount: 0, reason: "noop" }), { params });
    expect(res.status).toBe(200);
    expect(mockAddCredits).not.toHaveBeenCalled();
    expect(mockUseCredit).not.toHaveBeenCalled();
    // audit attribution still written
    expect(mockAuditAppend).toHaveBeenCalledTimes(1);
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
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  function makeGetRequest() {
    return new NextRequest("http://localhost/api/admin/students");
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

  it("returns 200 with students for admin", async () => {
    mockAuth.mockResolvedValue(makeSession(ADMIN_EMAIL, true));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { students: unknown[] };
    expect(Array.isArray(body.students)).toBe(true);
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
