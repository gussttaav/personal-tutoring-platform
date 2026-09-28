// CONTENT-FEEDBACK-01 — POST /api/content/vote.
//
// Follows src/app/api/courses/__tests__ (mock factories before the route import;
// real NextRequest objects).
//
// The cases worth pinning: an ANONYMOUS reader is a normal caller (null session →
// still 200, service called with `userEmail: null`), and the rate-limit key is
// tiered — `ip:` for him, `user:` once signed in — so a classroom on one NAT never
// shares a budget with a signed-in student.
import { NextRequest } from "next/server";

const LIMIT = 3;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  contentVoteRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...args: unknown[]) => mockIsValidOrigin(...args) }));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockVote = jest.fn();
jest.mock("@/services", () => ({
  contentFeedbackService: { vote: (...args: unknown[]) => mockVote(...args) },
}));

import { POST } from "@/app/api/content/vote/route";

const EMAIL     = "reader@example.com";
const ORIGIN    = "http://localhost:3000";
const CLIENT_ID = "6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7";

function postReq(body: unknown, origin = ORIGIN, ip = "203.0.113.7"): NextRequest {
  return new NextRequest(`${ORIGIN}/api/content/vote`, {
    method:  "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": ip },
    body:    JSON.stringify(body),
  });
}

const validBody = {
  contentType: "lesson",
  contentKey:  "dl-nlp/texto-como-numeros",
  locale:      "es",
  clientId:    CLIENT_ID,
  vote:        1,
};

beforeEach(() => {
  hits.clear();
  jest.clearAllMocks();
  mockIsValidOrigin.mockReturnValue(true);
  mockGetSession.mockResolvedValue(null);
  mockVote.mockResolvedValue(undefined);
});

describe("CONTENT-FEEDBACK-01: POST /api/content/vote", () => {
  it("accepts an anonymous reader and passes userEmail: null", async () => {
    const res = await POST(postReq(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockVote).toHaveBeenCalledWith({
      ref:       { contentType: "lesson", contentKey: "dl-nlp/texto-como-numeros" },
      locale:    "es",
      vote:      1,
      comment:   undefined,
      clientId:  CLIENT_ID,
      userEmail: null,
    });
  });

  it("passes the session email when signed in", async () => {
    mockGetSession.mockResolvedValue({ user: { email: EMAIL } });

    await POST(postReq({ ...validBody, vote: -1, comment: "  falta un ejemplo  " }));

    expect(mockVote).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: EMAIL, vote: -1, comment: "falta un ejemplo" }),
    );
  });

  it("rate-limits anonymous readers by IP and signed-in ones by email", async () => {
    await POST(postReq(validBody));
    expect(mockLimit).toHaveBeenLastCalledWith("ip:203.0.113.7");

    mockGetSession.mockResolvedValue({ user: { email: EMAIL } });
    await POST(postReq(validBody));
    expect(mockLimit).toHaveBeenLastCalledWith(`user:${EMAIL}`);
  });

  it("429s once the budget is spent, without calling the service", async () => {
    for (let i = 0; i < LIMIT; i++) await POST(postReq(validBody));
    mockVote.mockClear();

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(429);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it("rejects a cross-site origin with 403 before reading the session", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await POST(postReq(validBody, "https://evil.example"));

    expect(res.status).toBe(403);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockVote).not.toHaveBeenCalled();
  });

  it.each([
    ["a vote outside {1,-1}",        { ...validBody, vote: 0 }],
    ["a key that is not a slug pair", { ...validBody, contentKey: "Dl-Nlp/x y" }],
    ["a non-uuid clientId",           { ...validBody, clientId: "abc" }],
    ["an unknown content type",       { ...validBody, contentType: "video" }],
    ["an unknown locale",             { ...validBody, locale: "fr" }],
    ["an over-long comment",          { ...validBody, comment: "x".repeat(1001) }],
  ])("400s %s without calling the service", async (_label, body) => {
    const res = await POST(postReq(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(mockVote).not.toHaveBeenCalled();
  });

  it("maps an unexpected service failure to 500", async () => {
    mockVote.mockRejectedValue(new Error("db down"));

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(500);
  });
});
