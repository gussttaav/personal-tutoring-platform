// CONTENT-FEEDBACK-01 — POST /api/content/report.
//
// Same shape as vote.test.ts. What is specific here: the User-Agent is read from
// the request (and capped), the body `email` reaches the service only as the
// anonymous reporter's hint — the session email is passed separately and wins in
// the service — and no URL is ever taken from the client.
import { NextRequest } from "next/server";

const LIMIT = 2;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  contentReportRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...args: unknown[]) => mockIsValidOrigin(...args) }));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockReport = jest.fn();
jest.mock("@/services", () => ({
  contentFeedbackService: { report: (...args: unknown[]) => mockReport(...args) },
}));

import { POST } from "@/app/api/content/report/route";

const EMAIL  = "reader@example.com";
const ORIGIN = "http://localhost:3000";
const UA     = "Mozilla/5.0 (test)";

function postReq(body: unknown, origin = ORIGIN, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}/api/content/report`, {
    method:  "POST",
    headers: {
      origin,
      "content-type":    "application/json",
      "x-forwarded-for": "203.0.113.7",
      "user-agent":      UA,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  contentType: "post",
  contentKey:  "por-que-empiezo-un-blog",
  locale:      "en",
  message:     "The second code block does not run.",
};

beforeEach(() => {
  hits.clear();
  jest.clearAllMocks();
  mockIsValidOrigin.mockReturnValue(true);
  mockGetSession.mockResolvedValue(null);
  mockReport.mockResolvedValue(undefined);
});

describe("CONTENT-FEEDBACK-01: POST /api/content/report", () => {
  it("files an anonymous report with the optional email and the User-Agent", async () => {
    const res = await POST(postReq({ ...validBody, email: "anon@example.com" }));

    expect(res.status).toBe(200);
    expect(mockReport).toHaveBeenCalledWith({
      ref:       { contentType: "post", contentKey: "por-que-empiezo-un-blog" },
      locale:    "en",
      message:   "The second code block does not run.",
      email:     "anon@example.com",
      userEmail: null,
      userAgent: UA,
    });
  });

  it("passes the session email separately when signed in", async () => {
    mockGetSession.mockResolvedValue({ user: { email: EMAIL } });

    await POST(postReq({ ...validBody, email: "someone-else@example.com" }));

    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: EMAIL, email: "someone-else@example.com" }),
    );
  });

  it("caps the User-Agent at 512 characters and tolerates its absence", async () => {
    await POST(postReq(validBody, ORIGIN, { "user-agent": "u".repeat(600) }));
    expect(mockReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ userAgent: "u".repeat(512) }),
    );

    const bare = new NextRequest(`${ORIGIN}/api/content/report`, {
      method:  "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body:    JSON.stringify(validBody),
    });
    await POST(bare);
    expect(mockReport).toHaveBeenLastCalledWith(expect.objectContaining({ userAgent: null }));
  });

  it("rate-limits by IP when anonymous and 429s past the budget", async () => {
    for (let i = 0; i < LIMIT; i++) await POST(postReq(validBody));
    expect(mockLimit).toHaveBeenLastCalledWith("ip:203.0.113.7");
    mockReport.mockClear();

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(429);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("rejects a cross-site origin with 403", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await POST(postReq(validBody, "https://evil.example"));

    expect(res.status).toBe(403);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it.each([
    ["a message under 10 characters",       { ...validBody, message: "typo" }],
    ["a whitespace-padded short message",   { ...validBody, message: "   typo      " }],
    ["a message over 2000 characters",      { ...validBody, message: "x".repeat(2001) }],
    ["a malformed email",                   { ...validBody, email: "not-an-email" }],
    ["a lesson key with a single segment",  { ...validBody, contentType: "lesson", contentKey: "solo" }],
  ])("400s %s without calling the service", async (_label, body) => {
    const res = await POST(postReq(body));

    expect(res.status).toBe(400);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
