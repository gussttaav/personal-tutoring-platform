// PRICING-STUDENT-01 — POST /api/admin/students/[email]/pricing.
//
// Same shape as src/app/api/admin/feedback/__tests__ (mock factories before the
// route import, real NextRequest objects). Pins the guard ladder — session, admin
// role, origin, body — the 404 for an unknown student, the email normalization,
// and that a null amount reaches the service as a clear rather than being dropped.
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...a: unknown[]) => mockIsValidOrigin(...a) }));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const mockSetUserOverrides = jest.fn();
const mockFindByEmail      = jest.fn();
jest.mock("@/services", () => ({
  pricingService: { setUserOverrides: (...a: unknown[]) => mockSetUserOverrides(...a) },
  userService:    { findByEmail: (...a: unknown[]) => mockFindByEmail(...a) },
}));

import { POST } from "@/app/api/admin/students/[email]/pricing/route";

const ORIGIN = "http://localhost:3000";
const EMAIL  = "ana@example.com";
const ADMIN  = { user: { email: "admin@example.com", isAdmin: true } };

const BODY = {
  prices: [{ productKey: "pack10", amountCents: 30000 }],
  reason: "beca parcial",
};

function req(email: string, body: unknown) {
  const encoded = encodeURIComponent(email);
  const request = new NextRequest(`${ORIGIN}/api/admin/students/${encoded}/pricing`, {
    method:  "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ email: encoded }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(ADMIN);
  mockIsValidOrigin.mockReturnValue(true);
  mockFindByEmail.mockResolvedValue({ id: "user-1" });
  mockSetUserOverrides.mockResolvedValue(undefined);
});

describe("PRICING-STUDENT-01: POST /api/admin/students/[email]/pricing", () => {
  it("sets an override for an admin", async () => {
    const res = await req(EMAIL, BODY);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSetUserOverrides).toHaveBeenCalledWith({
      userId: "user-1",
      email:  EMAIL,
      prices: [{ key: "pack10", amountCents: 30000 }],
      by:     "admin@example.com",
      reason: "beca parcial",
    });
  });

  it("passes a null amount through as a clear", async () => {
    const res = await req(EMAIL, {
      prices: [{ productKey: "session1h", amountCents: null }],
      reason: "beca terminada",
    });

    expect(res.status).toBe(200);
    expect(mockSetUserOverrides).toHaveBeenCalledWith(
      expect.objectContaining({ prices: [{ key: "session1h", amountCents: null }] }),
    );
  });

  it("normalizes the email before the lookup", async () => {
    await req("  ANA@Example.COM  ", BODY);

    expect(mockFindByEmail).toHaveBeenCalledWith(EMAIL);
    expect(mockSetUserOverrides).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL }),
    );
  });

  it("401s without a session", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await req(EMAIL, BODY);

    expect(res.status).toBe(401);
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });

    const res = await req(EMAIL, BODY);

    expect(res.status).toBe(403);
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });

  it("403s a cross-site origin even for an admin", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await req(EMAIL, BODY);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid origin" });
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });

  it("404s for an email with no users row", async () => {
    mockFindByEmail.mockResolvedValue(null);

    const res = await req("ghost@example.com", BODY);

    expect(res.status).toBe(404);
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing reason",        { prices: [{ productKey: "pack10", amountCents: 30000 }] }],
    ["an empty reason",         { prices: [{ productKey: "pack10", amountCents: 30000 }], reason: "" }],
    ["an empty price list",     { prices: [], reason: "x" }],
    ["an unknown product key",  { prices: [{ productKey: "pack7", amountCents: 100 }], reason: "x" }],
    ["a zero amount",           { prices: [{ productKey: "pack10", amountCents: 0 }], reason: "x" }],
    ["a negative amount",       { prices: [{ productKey: "pack10", amountCents: -100 }], reason: "x" }],
    ["a fractional amount",     { prices: [{ productKey: "pack10", amountCents: 10.5 }], reason: "x" }],
    ["more than four rows",     { prices: Array(5).fill({ productKey: "pack10", amountCents: 100 }), reason: "x" }],
  ])("400s on %s", async (_label, body) => {
    const res = await req(EMAIL, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });

  it("400s on a non-JSON body without throwing", async () => {
    const request = new NextRequest(`${ORIGIN}/api/admin/students/x/pricing`, {
      method:  "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body:    "not json",
    });

    const res = await POST(request, { params: Promise.resolve({ email: "x" }) });

    expect(res.status).toBe(400);
    expect(mockSetUserOverrides).not.toHaveBeenCalled();
  });
});
