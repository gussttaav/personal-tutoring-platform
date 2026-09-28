// CONTENT-FEEDBACK-01 — PATCH /api/admin/feedback/reports/[id].
//
// Same shape as src/app/api/admin/course-announce/__tests__ (mock factories before
// the route import, real NextRequest objects). Pins the guard ladder — session,
// admin role, origin, uuid, body — and the 404 for an id no report has.
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...a: unknown[]) => mockIsValidOrigin(...a) }));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const mockSetStatus = jest.fn();
jest.mock("@/services", () => ({
  contentFeedbackService: { setReportStatus: (...a: unknown[]) => mockSetStatus(...a) },
}));

import { PATCH } from "@/app/api/admin/feedback/reports/[id]/route";

const ORIGIN = "http://localhost:3000";
const ID     = "0b8f3c2a-1d4e-4f5a-9b6c-7d8e9f0a1b2c";
const ADMIN  = { user: { email: "admin@example.com", isAdmin: true } };

function req(id: string, body: unknown) {
  const request = new NextRequest(`${ORIGIN}/api/admin/feedback/reports/${id}`, {
    method:  "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(ADMIN);
  mockIsValidOrigin.mockReturnValue(true);
  mockSetStatus.mockResolvedValue(true);
});

describe("CONTENT-FEEDBACK-01: PATCH /api/admin/feedback/reports/[id]", () => {
  it("resolves a report for an admin", async () => {
    const res = await req(ID, { status: "resolved" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSetStatus).toHaveBeenCalledWith(ID, "resolved");
  });

  it("401s without a session", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await req(ID, { status: "resolved" });

    expect(res.status).toBe(401);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });

    const res = await req(ID, { status: "resolved" });

    expect(res.status).toBe(403);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it("403s a cross-site origin even for an admin", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await req(ID, { status: "resolved" });

    expect(res.status).toBe(403);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it("400s a non-uuid id and an unknown status", async () => {
    expect((await req("not-a-uuid", { status: "resolved" })).status).toBe(400);
    expect((await req(ID, { status: "archived" })).status).toBe(400);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it("404s when no report has that id", async () => {
    mockSetStatus.mockResolvedValue(false);

    const res = await req(ID, { status: "open" });

    expect(res.status).toBe(404);
  });
});
