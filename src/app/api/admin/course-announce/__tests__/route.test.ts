// COURSE-P6-02 — POST /api/admin/course-announce.
//
// Same shape as src/app/api/courses/__tests__ (mock factories before the route import,
// real NextRequest objects). Everything the route touches is mocked: this is the one
// route in the codebase whose real side effect cannot be undone, so the test's whole job
// is to pin the guards around it — admin-only, confirm-only, and never double-send.

import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...a: unknown[]) => mockIsValidOrigin(...a) }));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const mockListSubscribers = jest.fn();
jest.mock("@/services", () => ({
  subscriptionService: { listSubscribers: (...a: unknown[]) => mockListSubscribers(...a) },
}));

const mockListNotifiedEmails = jest.fn();
const mockAppend             = jest.fn();
jest.mock("@/infrastructure/supabase", () => ({
  supabaseAuditRepository: {
    listNotifiedEmails: (...a: unknown[]) => mockListNotifiedEmails(...a),
    append:             (...a: unknown[]) => mockAppend(...a),
  },
}));

const mockRender = jest.fn();
const mockSend   = jest.fn();
jest.mock("@/infrastructure/resend/email-functions", () => ({
  renderCourseNewsEmail: (...a: unknown[]) => mockRender(...a),
  sendCourseNewsEmail:   (...a: unknown[]) => mockSend(...a),
}));

const mockGetCatalogEntry = jest.fn();
jest.mock("@/lib/courses/catalog-view", () => ({
  getCatalogEntry: (...a: unknown[]) => mockGetCatalogEntry(...a),
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

const recipients = [
  { userId: "u1", email: "a@example.com", locale: "es" },
  { userId: "u2", email: "b@example.com", locale: "en" },
  { userId: "u3", email: "c@example.com", locale: "es" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "admin@example.com", isAdmin: true } });
  mockIsValidOrigin.mockReturnValue(true);
  mockListSubscribers.mockResolvedValue(recipients);
  mockListNotifiedEmails.mockResolvedValue(new Set<string>());
  mockAppend.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
  mockRender.mockResolvedValue({ subject: "S", html: "<p>H</p>" });
  mockGetCatalogEntry.mockReturnValue({
    course:        { slug: "dl-nlp", title: "Curso" },
    contentLocale: "es",
    lessons:       [{ slug: "intro" }, { slug: "dos" }],
  });
});

describe("guards", () => {
  it("401s when signed out", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(req({ courseSlug: "dl-nlp" }))).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });
    expect((await POST(req({ courseSlug: "dl-nlp" }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a cross-origin request", async () => {
    mockIsValidOrigin.mockReturnValue(false);
    expect((await POST(req({ courseSlug: "dl-nlp", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("404s an unknown course", async () => {
    mockGetCatalogEntry.mockReturnValue(null);
    expect((await POST(req({ courseSlug: "nope", confirm: true }))).status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("dry run — the default", () => {
  it("sends nothing and reports the audience", async () => {
    const res  = await POST(req({ courseSlug: "dl-nlp" }));
    const body = await res.json();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAppend).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      dryRun: true,
      subscribers: 3,
      pending: 3,
      byLocale: { es: 2, en: 1 },
    });
    // A real rendered email per locale — the only way to read it before it is irreversible.
    expect(body.samples.es).toEqual({ subject: "S", html: "<p>H</p>" });
    expect(body.samples.en).toEqual({ subject: "S", html: "<p>H</p>" });
  });

  it("sends nothing when confirm is false rather than absent", async () => {
    await POST(req({ courseSlug: "dl-nlp", confirm: false }));
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("confirmed send", () => {
  it("sends once per recipient, in that recipient's locale, and records each", async () => {
    const res  = await POST(req({ courseSlug: "dl-nlp", confirm: true }));
    const body = await res.json();

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend.mock.calls.map(([p]) => [p.to, p.locale])).toEqual([
      ["a@example.com", "es"],
      ["b@example.com", "en"],
      ["c@example.com", "es"],
    ]);
    expect(mockAppend).toHaveBeenCalledTimes(3);
    expect(mockAppend).toHaveBeenCalledWith("a@example.com", {
      action: "course_announcement_sent",
      announcementKey: "launch:dl-nlp",
      courseSlug: "dl-nlp",
    });
    expect(body).toMatchObject({ dryRun: false, sent: 3, failed: 0, remaining: 0 });
  });

  it("skips addresses already recorded — a retry does not double-send", async () => {
    mockListNotifiedEmails.mockResolvedValue(new Set(["a@example.com", "c@example.com"]));

    const body = await (await POST(req({ courseSlug: "dl-nlp", confirm: true }))).json();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("b@example.com");
    expect(body).toMatchObject({ sent: 1 });
  });

  it("one failing send does not abort the batch, and is not recorded as sent", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend 422"));

    const body = await (await POST(req({ courseSlug: "dl-nlp", confirm: true }))).json();

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockAppend).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({ sent: 2, failed: 1, failedTo: ["a@example.com"] });
  });

  it("honours offset/limit and reports where to resume", async () => {
    const body = await (await POST(
      req({ courseSlug: "dl-nlp", confirm: true, offset: 1, limit: 1 }),
    )).json();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("b@example.com");
    expect(body).toMatchObject({ sent: 1, nextOffset: 2, remaining: 1 });
  });

  it("uses a custom announcementKey so a second announcement is not suppressed", async () => {
    await POST(req({ courseSlug: "dl-nlp", confirm: true, announcementKey: "english-launch" }));

    expect(mockListNotifiedEmails).toHaveBeenCalledWith(
      "course_announcement_sent",
      "english-launch",
    );
    expect(mockAppend).toHaveBeenCalledWith(
      "a@example.com",
      expect.objectContaining({ announcementKey: "english-launch" }),
    );
  });
});
