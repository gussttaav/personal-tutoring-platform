// COURSE-P4-02 — POST /api/courses/attempt.
//
// Same shape as the sibling progress route test. The extra thing pinned here is the
// `answer` size cap: the JSONB column records WHAT was answered, and must not become
// a place to park a student's edited code.
import { NextRequest } from "next/server";

const LIMIT = 3;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  courseProgressRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockIsValidOrigin = jest.fn();
jest.mock("@/lib/csrf", () => ({ isValidOrigin: (...args: unknown[]) => mockIsValidOrigin(...args) }));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockRecordAttempt = jest.fn();
jest.mock("@/services", () => ({
  courseService: { recordQuizAttempt: (...args: unknown[]) => mockRecordAttempt(...args) },
}));

import { POST } from "@/app/api/courses/attempt/route";

const EMAIL  = "student@example.com";
const ORIGIN = "http://localhost:3000";

function req(body: unknown, origin = ORIGIN): NextRequest {
  return new NextRequest(`${ORIGIN}/api/courses/attempt`, {
    method:  "POST",
    headers: { origin, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const quizAttempt = {
  courseSlug: "dl-nlp",
  lessonSlug: "l1",
  quizId:     "q1",
  correct:    true,
  answer:     { kind: "quiz", questionType: "single-choice", value: "a", hintUsed: false, attempt: 1 },
};

beforeEach(() => {
  hits.clear();
  jest.clearAllMocks();
  mockIsValidOrigin.mockReturnValue(true);
  mockGetSession.mockResolvedValue({ user: { email: EMAIL } });
  mockRecordAttempt.mockResolvedValue(undefined);
});

describe("COURSE-P4-02: POST /api/courses/attempt", () => {
  it("returns 204 for a signed-out reader and records nothing", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(req(quizAttempt));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockRecordAttempt).not.toHaveBeenCalled();
  });

  it("403s a cross-site origin before reading the session", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await POST(req(quizAttempt, "https://evil.example"));

    expect(res.status).toBe(403);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("records a quiz attempt with the parsed arguments", async () => {
    const res = await POST(req(quizAttempt));

    expect(res.status).toBe(200);
    expect(mockRecordAttempt).toHaveBeenCalledWith(
      EMAIL,
      "dl-nlp",
      "l1",
      "q1",
      true,
      quizAttempt.answer,
    );
  });

  it("records a code-challenge attempt through the same path", async () => {
    const challenge = {
      courseSlug: "dl-nlp",
      lessonSlug: "l1",
      quizId:     "softmax",
      correct:    false,
      answer:     { kind: "challenge", passed: 2, total: 3, attempt: 1, solutionRevealed: false },
    };

    const res = await POST(req(challenge));

    expect(res.status).toBe(200);
    expect(mockRecordAttempt).toHaveBeenCalledWith(EMAIL, "dl-nlp", "l1", "softmax", false, challenge.answer);
  });

  it("400s a body missing `correct`", async () => {
    const res = await POST(req({ courseSlug: "dl-nlp", lessonSlug: "l1", quizId: "q1" }));

    expect(res.status).toBe(400);
    expect(mockRecordAttempt).not.toHaveBeenCalled();
  });

  it("400s an oversized answer — the column is not free storage for student code", async () => {
    const res = await POST(req({ ...quizAttempt, answer: { blob: "x".repeat(5000) } }));

    expect(res.status).toBe(400);
    expect(mockRecordAttempt).not.toHaveBeenCalled();
  });

  it("429s past the budget, keyed by email, without recording", async () => {
    for (let i = 0; i < LIMIT; i++) await POST(req(quizAttempt));
    mockRecordAttempt.mockClear();

    const res = await POST(req(quizAttempt));

    expect(res.status).toBe(429);
    expect(mockLimit).toHaveBeenLastCalledWith(EMAIL);
    expect(mockRecordAttempt).not.toHaveBeenCalled();
  });

  it("maps an infrastructure failure through http-errors", async () => {
    mockRecordAttempt.mockRejectedValue(new Error("supabase down"));

    const res = await POST(req(quizAttempt));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
  });
});
