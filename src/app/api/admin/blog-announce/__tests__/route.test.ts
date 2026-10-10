// BLOG-15 — POST /api/admin/blog-announce.
//
// Same shape as ../../course-announce/__tests__ (mock factories before the route import,
// real NextRequest objects). Who a post reaches is BlogAnnouncementService's job and is
// tested there; this pins the route's own job — admin-only, CSRF, and that only a body with
// `confirm: true` can reach the send.

import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...a: unknown[]) => mockIsValidOrigin(...a) }));

const mockPreview = jest.fn();
const mockSend    = jest.fn();
jest.mock("@/services", () => ({
  blogAnnouncementService: {
    preview: (...a: unknown[]) => mockPreview(...a),
    send:    (...a: unknown[]) => mockSend(...a),
  },
}));

import { POST } from "@/app/api/admin/blog-announce/route";

const ORIGIN = "http://localhost:3000";

function req(body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/admin/blog-announce`, {
    method:  "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "admin@example.com", isAdmin: true } });
  mockIsValidOrigin.mockReturnValue(true);
  mockPreview.mockResolvedValue({ dryRun: true, pending: 2 });
  mockSend.mockResolvedValue({ dryRun: false, sent: 2 });
});

describe("guards", () => {
  it("401s when signed out", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(req({ slug: "arboles-b", confirm: true }))).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });
    expect((await POST(req({ slug: "arboles-b", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a cross-origin request", async () => {
    mockIsValidOrigin.mockReturnValue(false);
    expect((await POST(req({ slug: "arboles-b", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s a body without a slug", async () => {
    expect((await POST(req({ confirm: true }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s countOnly combined with confirm, and sends nothing", async () => {
    expect((await POST(req({ slug: "arboles-b", countOnly: true, confirm: true }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("404s a post that is not published", async () => {
    mockPreview.mockResolvedValue(null);
    mockSend.mockResolvedValue(null);
    expect((await POST(req({ slug: "nope" }))).status).toBe(404);
    expect((await POST(req({ slug: "nope", confirm: true }))).status).toBe(404);
  });
});

describe("modes", () => {
  it("count only: counts without samples, never sends", async () => {
    const res = await POST(req({ slug: "arboles-b", countOnly: true }));

    expect(res.status).toBe(200);
    expect(mockPreview).toHaveBeenCalledWith({ slug: "arboles-b", samples: false, offset: undefined, limit: undefined });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("dry run is the default: counts with samples, never sends", async () => {
    await POST(req({ slug: "arboles-b" }));
    await POST(req({ slug: "arboles-b", confirm: false }));

    expect(mockPreview).toHaveBeenCalledTimes(2);
    expect(mockPreview.mock.calls.every(([input]) => input.samples === true)).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("confirm sends one chunk with the given offset and limit", async () => {
    const body = await (await POST(req({ slug: "arboles-b", confirm: true, offset: 0, limit: 10 }))).json();

    expect(mockSend).toHaveBeenCalledWith({ slug: "arboles-b", offset: 0, limit: 10 });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(body).toEqual({ dryRun: false, sent: 2 });
  });
});
