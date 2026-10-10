// COURSE-P6-02 / COURSE-P6-02b — POST /api/admin/course-announce. BLOG-15: count only.
// COURSE-ANNOUNCE-01: the logic moved to CourseAnnouncementService.
//
// Same shape as ../../blog-announce/__tests__ (mock factories before the route import, real
// NextRequest objects). Who a course announcement reaches, the three kinds and their keys, and
// the chunked walk are CourseAnnouncementService's job and are tested there; this pins the
// route's own job. It guards the one route in the codebase whose real side effect cannot be
// undone: admin-only, CSRF-checked, and only a body with `confirm: true` can reach the send.

import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...a: unknown[]) => mockIsValidOrigin(...a) }));

const mockPreview = jest.fn();
const mockSend    = jest.fn();
jest.mock("@/services", () => ({
  courseAnnouncementService: {
    preview: (...a: unknown[]) => mockPreview(...a),
    send:    (...a: unknown[]) => mockSend(...a),
  },
}));

import { POST } from "@/app/api/admin/course-announce/route";

const ORIGIN = "http://localhost:3000";

function req(body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/admin/course-announce`, {
    method:  "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "admin@example.com", isAdmin: true } });
  mockIsValidOrigin.mockReturnValue(true);
  mockPreview.mockResolvedValue({ dryRun: true, pending: 3 });
  mockSend.mockResolvedValue({ dryRun: false, sent: 3 });
});

describe("guards", () => {
  it("401s when signed out", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a cross-origin request", async () => {
    mockIsValidOrigin.mockReturnValue(false);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("404s an unknown course", async () => {
    mockPreview.mockResolvedValue(null);
    mockSend.mockResolvedValue(null);
    const dry  = await POST(req({ courseSlug: "nope", kind: "launch" }));
    const real = await POST(req({ courseSlug: "nope", kind: "launch", confirm: true }));

    expect(dry.status).toBe(404);
    expect(real.status).toBe(404);
    expect(await real.json()).toEqual({ error: "UNKNOWN_COURSE" });
  });
});

// COURSE-P6-02b: the request must say which of the three emails goes out, and an `update` must
// say what changed. The schema refuses both before the service is reached.
describe("validation", () => {
  it("400s a request that does not say which kind", async () => {
    expect((await POST(req({ courseSlug: "dl-nlp" }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("400s an update without a whatsNew line — there is nothing to announce", async () => {
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "update" }))).status).toBe(400);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "update", whatsNew: "   " }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s countOnly combined with confirm, and sends nothing", async () => {
    const res = await POST(req({ courseSlug: "dl-nlp", kind: "launch", countOnly: true, confirm: true }));

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s a body that is not JSON", async () => {
    const res = await POST(new NextRequest(`${ORIGIN}/api/admin/course-announce`, {
      method:  "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body:    "not json",
    }));

    expect(res.status).toBe(400);
  });
});

describe("modes", () => {
  it("dry run is the default: counts with samples, never sends", async () => {
    await POST(req({ courseSlug: "dl-nlp", kind: "launch" }));
    await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: false }));

    expect(mockPreview).toHaveBeenCalledTimes(2);
    expect(mockPreview.mock.calls.every(([input]) => input.samples === true)).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("count only: counts without samples, never sends", async () => {
    const res = await POST(req({ courseSlug: "dl-nlp", kind: "launch", countOnly: true }));

    expect(res.status).toBe(200);
    expect(mockPreview).toHaveBeenCalledWith({ courseSlug: "dl-nlp", kind: "launch", samples: false });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("count only is allowed for an update before its line is written", async () => {
    const res = await POST(req({ courseSlug: "dl-nlp", kind: "update", countOnly: true }));

    expect(res.status).toBe(200);
    expect(mockPreview).toHaveBeenCalledWith({ courseSlug: "dl-nlp", kind: "update", samples: false });
  });

  it("confirm sends one chunk with the given key, offset and limit", async () => {
    const res = await POST(req({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito.",
      announcementKey: "update:dl-nlp:2026-10-10", offset: 0, limit: 10, confirm: true,
    }));

    expect(mockSend).toHaveBeenCalledWith({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito.",
      announcementKey: "update:dl-nlp:2026-10-10", offset: 0, limit: 10,
    });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ dryRun: false, sent: 3 });
  });

  it("passes the whatsNew line and key to the dry run too", async () => {
    await POST(req({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito.", announcementKey: "k",
    }));

    expect(mockPreview).toHaveBeenCalledWith({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito.",
      announcementKey: "k", samples: true,
    });
  });
});
