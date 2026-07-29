// COURSE-P4-02 — GET/POST /api/courses/progress.
//
// Follows the src/app/api/cancel/__tests__ pattern (mock factories declared before
// the route import; real NextRequest objects).
//
// The case worth stating out loud is the signed-out one: this route answers 204, not
// 401, because it serves a statically generated page that anyone may read, and a 401
// per lesson view would fill every anonymous reader's console. That is the assertion
// most likely to be "fixed" by someone restoring the house 401, so it is pinned here
// along with "the service was never called".
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

const mockMarkSeen        = jest.fn();
const mockMarkCompleted   = jest.fn();
const mockGetDetail       = jest.fn();
const mockListEnrollments = jest.fn();
jest.mock("@/services", () => ({
  courseService: {
    markLessonSeen:          (...args: unknown[]) => mockMarkSeen(...args),
    markLessonCompleted:     (...args: unknown[]) => mockMarkCompleted(...args),
    getCourseProgressDetail: (...args: unknown[]) => mockGetDetail(...args),
    listEnrollments:         (...args: unknown[]) => mockListEnrollments(...args),
  },
}));

// COURSE-P4-03: the list shape merges titles in from the registry, which reads the
// filesystem. Mocked here so the route test stays off disk; the merge itself is
// covered in src/lib/courses/__tests__/enrollment-view.test.ts.
const mockGetCourse   = jest.fn();
const mockListLessons = jest.fn();
jest.mock("@/lib/courses/registry", () => ({
  getCourse:   (...args: unknown[]) => mockGetCourse(...args),
  listLessons: (...args: unknown[]) => mockListLessons(...args),
}));

import { GET, POST } from "@/app/api/courses/progress/route";

const EMAIL  = "student@example.com";
const ORIGIN = "http://localhost:3000";

function postReq(body: unknown, origin = ORIGIN): NextRequest {
  return new NextRequest(`${ORIGIN}/api/courses/progress`, {
    method:  "POST",
    headers: { origin, "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function getReq(query: string): NextRequest {
  return new NextRequest(`${ORIGIN}/api/courses/progress${query}`, { method: "GET" });
}

const validBody = { courseSlug: "dl-nlp", lessonSlug: "l1", action: "seen" };

beforeEach(() => {
  hits.clear();
  jest.clearAllMocks();
  mockIsValidOrigin.mockReturnValue(true);
  mockGetSession.mockResolvedValue({ user: { email: EMAIL } });
  mockMarkSeen.mockResolvedValue(undefined);
  mockMarkCompleted.mockResolvedValue(undefined);
  mockGetDetail.mockResolvedValue({ courseSlug: "dl-nlp", totalLessons: 2, completedLessonSlugs: [] });
  mockListEnrollments.mockResolvedValue([]);
  mockGetCourse.mockReturnValue({ slug: "dl-nlp", title: "Curso" });
  mockListLessons.mockReturnValue([{ slug: "l1" }, { slug: "l2" }]);
});

describe("COURSE-P4-02: POST /api/courses/progress", () => {
  it("returns 204 with NO body for a signed-out reader, and never calls the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("does not even rate-limit a signed-out reader", async () => {
    mockGetSession.mockResolvedValue(null);

    await POST(postReq(validBody));

    // Anonymous readers are the majority; they must not touch Redis at all.
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("rejects a cross-site origin with 403 before reading the session", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await POST(postReq(validBody, "https://evil.example"));

    expect(res.status).toBe(403);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("400s an invalid body without calling the service", async () => {
    const res = await POST(postReq({ courseSlug: "dl-nlp", action: "teleported" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("routes action:'seen' to markLessonSeen with the session email", async () => {
    const res = await POST(postReq(validBody));

    expect(res.status).toBe(200);
    expect(mockMarkSeen).toHaveBeenCalledWith(EMAIL, "dl-nlp", "l1");
    expect(mockMarkCompleted).not.toHaveBeenCalled();
  });

  it("routes action:'completed' to markLessonCompleted", async () => {
    const res = await POST(postReq({ ...validBody, action: "completed" }));

    expect(res.status).toBe(200);
    expect(mockMarkCompleted).toHaveBeenCalledWith(EMAIL, "dl-nlp", "l1");
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("429s past the limiter budget, keyed by email", async () => {
    for (let i = 0; i < LIMIT; i++) await POST(postReq(validBody));
    mockMarkSeen.mockClear();

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(429);
    expect(mockLimit).toHaveBeenLastCalledWith(EMAIL);
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it("gives a second reader their own budget", async () => {
    for (let i = 0; i <= LIMIT; i++) await POST(postReq(validBody));
    mockGetSession.mockResolvedValue({ user: { email: "other@example.com" } });

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(200);
  });

  it("maps an infrastructure failure through http-errors instead of throwing", async () => {
    mockMarkSeen.mockRejectedValue(new Error("supabase down"));

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
  });
});

describe("COURSE-P4-02: GET /api/courses/progress", () => {
  it("returns 204 for a signed-out reader without calling the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(getReq("?courseSlug=dl-nlp"));

    expect(res.status).toBe(204);
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  // Was a 400 until P4-03: a GET with no courseSlug is now the enrolment list,
  // exercised in the describe block below.

  it("returns the detail summary for the signed-in reader", async () => {
    const detail = {
      courseSlug: "dl-nlp",
      totalLessons: 4,
      completedLessons: 1,
      percentComplete: 25,
      lastSeenLessonSlug: "l1",
      enrolledAt: "2026-07-01T00:00:00.000Z",
      completedAt: null,
      completedLessonSlugs: ["l1"],
    };
    mockGetDetail.mockResolvedValue(detail);

    const res = await GET(getReq("?courseSlug=dl-nlp"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(detail);
    expect(mockGetDetail).toHaveBeenCalledWith(EMAIL, "dl-nlp");
  });

  it("does not require an Origin header — it is a read, not a state change", async () => {
    mockIsValidOrigin.mockReturnValue(false);

    const res = await GET(getReq("?courseSlug=dl-nlp"));

    expect(res.status).toBe(200);
  });
});

describe("COURSE-P4-03: GET /api/courses/progress (enrolment list)", () => {
  const enrollment = {
    courseSlug:         "dl-nlp",
    totalLessons:       2,
    completedLessons:   1,
    percentComplete:    50,
    lastSeenLessonSlug: "l1",
    enrolledAt:         "2026-07-01T00:00:00.000Z",
    completedAt:        null,
  };

  it("returns every enrolment merged with its registry title", async () => {
    mockListEnrollments.mockResolvedValue([enrollment]);

    const res = await GET(getReq(""));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      enrollments: [
        {
          courseSlug:       "dl-nlp",
          title:            "Curso",
          totalLessons:     2,
          completedLessons: 1,
          percentComplete:  50,
          resumeLessonSlug: "l1",
          completedAt:      null,
          contentLocale:    "es",
        },
      ],
    });
    expect(mockListEnrollments).toHaveBeenCalledWith(EMAIL);
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it("reads titles from the requested locale", async () => {
    mockListEnrollments.mockResolvedValue([enrollment]);
    mockGetCourse.mockImplementation((_slug: string, locale: string) =>
      locale === "en" ? { slug: "dl-nlp", title: "Course" } : { slug: "dl-nlp", title: "Curso" },
    );

    const res = await GET(getReq("?locale=en"));

    expect((await res.json()).enrollments[0]).toMatchObject({
      title:         "Course",
      contentLocale: "en",
    });
  });

  it("ignores an unknown locale rather than 400ing — it only picks a content tree", async () => {
    mockListEnrollments.mockResolvedValue([enrollment]);

    const res = await GET(getReq("?locale=klingon"));

    expect(res.status).toBe(200);
    expect((await res.json()).enrollments[0].contentLocale).toBe("es");
  });

  it("returns an empty list for a reader with no enrolments", async () => {
    const res = await GET(getReq(""));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enrollments: [] });
  });

  it("returns 204 for a signed-out reader without calling the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(getReq(""));

    expect(res.status).toBe(204);
    expect(mockListEnrollments).not.toHaveBeenCalled();
  });

  it("429s past the limiter budget, keyed by email", async () => {
    for (let i = 0; i < LIMIT; i++) await GET(getReq(""));
    mockListEnrollments.mockClear();

    const res = await GET(getReq(""));

    expect(res.status).toBe(429);
    expect(mockLimit).toHaveBeenLastCalledWith(EMAIL);
    expect(mockListEnrollments).not.toHaveBeenCalled();
  });

  it("maps an infrastructure failure through http-errors instead of throwing", async () => {
    mockListEnrollments.mockRejectedValue(new Error("supabase down"));

    const res = await GET(getReq(""));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
  });
});
