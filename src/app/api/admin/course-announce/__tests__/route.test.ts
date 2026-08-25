// COURSE-P6-02 / COURSE-P6-02b — POST /api/admin/course-announce.
//
// Same shape as src/app/api/courses/__tests__ (mock factories before the route import,
// real NextRequest objects). Everything the route touches is mocked: this is the one
// route in the codebase whose real side effect cannot be undone, so the test's whole job
// is to pin the guards around it — admin-only, confirm-only, and never double-send.
//
// The three `kind`s add a second thing to pin: `launch` and `english` must never send twice,
// while `update` must be able to send again and again. Those are the same mechanism read in
// opposite directions, and the only thing separating them is the announcementKey.

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
    // englishCoverage() reads these to report how much of the course actually exists in EN.
    views:           [{ contentLocale: "es" }, { contentLocale: "es" }],
    fullyTranslated: false,
  });
});

describe("guards", () => {
  it("401s when signed out", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch" }))).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "student@example.com", isAdmin: false } });
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch" }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("403s a cross-origin request", async () => {
    mockIsValidOrigin.mockReturnValue(false);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("404s an unknown course", async () => {
    mockGetCatalogEntry.mockReturnValue(null);
    expect((await POST(req({ courseSlug: "nope", kind: "launch", confirm: true }))).status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("dry run — the default", () => {
  it("sends nothing and reports the audience", async () => {
    const res  = await POST(req({ courseSlug: "dl-nlp", kind: "launch" }));
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
    await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: false }));
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("confirmed send", () => {
  it("sends once per recipient, in that recipient's locale, and records each", async () => {
    const res  = await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }));
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
      kind: "launch",
    });
    expect(body).toMatchObject({ dryRun: false, sent: 3, failed: 0, remaining: 0 });
  });

  it("skips addresses already recorded — a retry does not double-send", async () => {
    mockListNotifiedEmails.mockResolvedValue(new Set(["a@example.com", "c@example.com"]));

    const body = await (await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).json();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("b@example.com");
    expect(body).toMatchObject({ sent: 1 });
  });

  it("one failing send does not abort the batch, and is not recorded as sent", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend 422"));

    const body = await (await POST(req({ courseSlug: "dl-nlp", kind: "launch", confirm: true }))).json();

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockAppend).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({ sent: 2, failed: 1, failedTo: ["a@example.com"] });
  });

  it("honours offset/limit and reports where to resume", async () => {
    const body = await (await POST(
      req({ courseSlug: "dl-nlp", kind: "launch", confirm: true, offset: 1, limit: 1 }),
    )).json();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("b@example.com");
    expect(body).toMatchObject({ sent: 1, nextOffset: 2, remaining: 1 });
  });

  it("uses a custom announcementKey so a second announcement is not suppressed", async () => {
    await POST(req({ courseSlug: "dl-nlp", kind: "english", confirm: true, announcementKey: "english-launch" }));

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

// ─── COURSE-P6-02b: the three kinds ───────────────────────────────────────────

describe("announcement kinds", () => {
  it("rejects a request that does not say which kind", async () => {
    expect((await POST(req({ courseSlug: "dl-nlp" }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it.each(["launch", "english", "update"] as const)(
    "renders and sends %s under its own kind",
    async (kind) => {
      const body = kind === "update"
        ? { courseSlug: "dl-nlp", kind, whatsNew: "Bloque 4 reescrito." }
        : { courseSlug: "dl-nlp", kind };

      // Dry run renders both locales for the chosen kind, and nothing else.
      await POST(req(body));
      expect(mockRender).toHaveBeenCalledTimes(2);
      expect(mockRender.mock.calls.map(([p]) => [p.locale, p.kind])).toEqual([
        ["es", kind],
        ["en", kind],
      ]);

      // The confirmed send carries the same kind through to every recipient.
      mockRender.mockClear();
      await POST(req({ ...body, confirm: true }));
      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend.mock.calls.every(([p]) => p.kind === kind)).toBe(true);
    },
  );

  it("defaults the key per kind, dating only the one that recurs", async () => {
    const keyFor = async (body: Record<string, unknown>) =>
      (await (await POST(req({ courseSlug: "dl-nlp", ...body }))).json()).announcementKey;

    expect(await keyFor({ kind: "launch" })).toBe("launch:dl-nlp");
    expect(await keyFor({ kind: "english" })).toBe("english:dl-nlp");
    expect(await keyFor({ kind: "update", whatsNew: "Algo" }))
      .toMatch(/^update:dl-nlp:\d{4}-\d{2}-\d{2}$/);
  });
});

describe("kind: update", () => {
  it("400s without a whatsNew line — there is nothing to announce", async () => {
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "update" }))).status).toBe(400);
    expect((await POST(req({ courseSlug: "dl-nlp", kind: "update", whatsNew: "   " }))).status)
      .toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("passes the whatsNew line to the template", async () => {
    await POST(req({ courseSlug: "dl-nlp", kind: "update", whatsNew: "Bloque 4 reescrito." }));
    expect(mockRender.mock.calls.every(([p]) => p.whatsNew === "Bloque 4 reescrito.")).toBe(true);
  });

  // The whole reason `update` gets a dated key. Two updates are two announcements; the audit
  // log must not read the second as a retry of the first.
  it("reaches everyone again under a new key", async () => {
    await POST(req({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Uno",
      announcementKey: "update:dl-nlp:2026-08-01", confirm: true,
    }));
    expect(mockSend).toHaveBeenCalledTimes(3);

    // Second update: everyone is recorded under the FIRST key, but this one asks about its own.
    mockSend.mockClear();
    mockListNotifiedEmails.mockImplementation(async (_action: string, key: string) =>
      key === "update:dl-nlp:2026-08-01"
        ? new Set(recipients.map((r) => r.email))
        : new Set<string>(),
    );

    const body = await (await POST(req({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Dos",
      announcementKey: "update:dl-nlp:2026-09-01", confirm: true,
    }))).json();

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({ sent: 3 });
  });

  it("reaches nobody when the key is reused — the trap the panel warns about", async () => {
    mockListNotifiedEmails.mockResolvedValue(new Set(recipients.map((r) => r.email)));

    const body = await (await POST(req({
      courseSlug: "dl-nlp", kind: "update", whatsNew: "Dos",
      announcementKey: "update:dl-nlp:2026-08-01", confirm: true,
    }))).json();

    expect(mockSend).not.toHaveBeenCalled();
    expect(body).toMatchObject({ sent: 0, remaining: 0 });
  });
});

describe("chunked walk", () => {
  const four = [
    { userId: "u1", email: "a@example.com", locale: "es" },
    { userId: "u2", email: "b@example.com", locale: "en" },
    { userId: "u3", email: "c@example.com", locale: "es" },
    { userId: "u4", email: "d@example.com", locale: "en" },
  ];

  // `offset` indexes into `pending`, which shrinks as sends are recorded — so the way to walk
  // a list is to re-POST with offset 0 and let the audit log do the paging. This is the test
  // that keeps the admin panel's "Continuar" button honest.
  it("reaches the whole list across chunks when each call re-POSTs with offset 0", async () => {
    mockListSubscribers.mockResolvedValue(four);

    const first = await (await POST(req({
      courseSlug: "dl-nlp", kind: "launch", confirm: true, limit: 2,
    }))).json();

    expect(mockSend.mock.calls.map(([p]) => p.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(first).toMatchObject({ sent: 2, remaining: 2 });

    // The first chunk is now on the audit log, so `pending` is c/d.
    mockSend.mockClear();
    mockListNotifiedEmails.mockResolvedValue(new Set(["a@example.com", "b@example.com"]));

    const second = await (await POST(req({
      courseSlug: "dl-nlp", kind: "launch", confirm: true, limit: 2,
    }))).json();

    expect(mockSend.mock.calls.map(([p]) => p.to)).toEqual(["c@example.com", "d@example.com"]);
    expect(second).toMatchObject({ sent: 2, remaining: 0 });
  });

  it("resuming at nextOffset instead would step clean over the rest of the list", async () => {
    mockListSubscribers.mockResolvedValue(four);
    // State after the first chunk above: a/b recorded, so `pending` is 2 long.
    mockListNotifiedEmails.mockResolvedValue(new Set(["a@example.com", "b@example.com"]));

    const body = await (await POST(req({
      courseSlug: "dl-nlp", kind: "launch", confirm: true, limit: 2, offset: 2,
    }))).json();

    expect(mockSend).not.toHaveBeenCalled();
    expect(body).toMatchObject({ sent: 0 });
  });
});
