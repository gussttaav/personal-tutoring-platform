// REFACTOR-R4-P3-02 — AdminService: the admin panel's reads and the manual credit
// adjustment moved out of POST /api/admin/students/[email].
//
// Real CreditService + PricingService over the in-memory repositories, so the
// adjustment is checked against an actual balance: a debit stops at it and says so,
// and a failure that is not "no credits left" propagates instead of being swallowed.
//
// ADMIN-USERS-01 — the users list (every account but the admin's, one tab per
// relationship) and the course views. The in-memory repository mirrors migration 0027;
// these tests pin what the service adds on top: the published lessons it sends, the
// titles and percentages from the catalog, paging, and a user's own course status.
import {
  AdminService,
  COURSE_READERS_PAGE_SIZE,
  STUDENTS_PAGE_SIZE,
} from "../AdminService";
import { CreditService } from "../CreditService";
import { PricingService } from "../PricingService";
import { FakeAdminCourseCatalog, type FakeCourseSpec } from "@/__tests__/fixtures/FakeAdminCourseCatalog";
import { FakeCourseCatalog } from "@/__tests__/fixtures/FakeCourseCatalog";
import { InMemoryAdminQueryRepository } from "@/__tests__/fixtures/InMemoryAdminQueryRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { InMemoryCreditsRepository } from "@/__tests__/fixtures/InMemoryCreditsRepository";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { buildTestCourseService } from "@/__tests__/fixtures/services";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

const DAY_MS = 86_400_000;
const EMAIL  = "ana@example.com";
const ADMIN  = "admin@example.com";

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

/** Two courses: dl-nlp fully written (3 lessons over 2 blocks), llm-agents still being
 *  written (2 published lessons). */
const COURSES: FakeCourseSpec[] = [
  {
    slug:    "dl-nlp",
    title:   "Deep Learning para NLP: del Perceptrón al Transformer",
    blocks:  [{ id: 1, title: "Fundamentos" }, { id: 2, title: "Secuencias" }, { id: 3, title: "Sin publicar" }],
    lessons: [
      { slug: "perceptron", block: 1, title: "El perceptrón" },
      { slug: "mlp",        block: 1, title: "El MLP" },
      { slug: "rnn",        block: 2, title: "Las RNN" },
    ],
  },
  {
    slug:     "llm-agents",
    title:    "Modelos de Lenguaje: del Transformer al Agente",
    lessons:  [{ slug: "atencion" }, { slug: "gpt" }],
    complete: false,
  },
];

function setup(courses: FakeCourseSpec[] = COURSES) {
  const queries     = new InMemoryAdminQueryRepository();
  const creditsRepo = new InMemoryCreditsRepository();
  const audit       = new InMemoryAuditRepository();
  const pricingRepo = new InMemoryPricingRepository();
  const credits     = new CreditService(creditsRepo, audit);
  const pricing     = new PricingService(pricingRepo, audit);
  // CourseService over the same published lessons the admin catalog declares.
  const courseSvc   = buildTestCourseService({
    catalog: new FakeCourseCatalog(Object.fromEntries(courses.map((c) => [c.slug, c.lessons.map((l) => l.slug)]))),
  });
  const service     = new AdminService(
    queries, credits, pricing, audit, courseSvc.service, new FakeAdminCourseCatalog(courses),
  );
  return { service, queries, creditsRepo, audit, pricingRepo, courseService: courseSvc.service };
}

async function seedCredits(creditsRepo: InMemoryCreditsRepository, credits: number) {
  await creditsRepo.addCredits({
    email: EMAIL, name: "Ana", creditsToAdd: credits, packLabel: "pack5",
    stripeSessionId: `cs_seed_${credits}`, expiresAt: inDays(30),
  });
}

describe("AdminService.adjustCredits", () => {
  it("a positive adjustment creates a manual pack with the configured validity", async () => {
    const { service, creditsRepo, audit, pricingRepo } = setup();
    await pricingRepo.updateSettings({ packValidityDays: 90, updatedBy: ADMIN });

    const before = Date.now();
    const result = await service.adjustCredits({ email: EMAIL, amount: 3, reason: "Reposición", by: ADMIN });

    expect(result).toEqual({ requested: 3, applied: 3 });
    const balance = await creditsRepo.getCredits(EMAIL);
    expect(balance?.credits).toBe(3);
    const expiresAt = new Date(balance!.expiresAt!).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 90 * DAY_MS);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 90 * DAY_MS);

    const [purchase, adjust] = audit.getAll(EMAIL);
    expect(purchase).toMatchObject({ action: "purchase", creditsAdded: 3, packLabel: "Ajuste manual: Reposición" });
    expect(purchase.stripeSessionId).toMatch(/^manual-[0-9a-f-]{36}$/);
    expect(adjust).toMatchObject({ action: "admin_adjust", amount: 3, applied: 3, reason: "Reposición", by: ADMIN });
  });

  it("two manual grants get distinct pack ids (neither is dropped as a duplicate payment)", async () => {
    const { service, creditsRepo } = setup();

    await service.adjustCredits({ email: EMAIL, amount: 1, reason: "a", by: ADMIN });
    await service.adjustCredits({ email: EMAIL, amount: 1, reason: "b", by: ADMIN });

    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(2);
  });

  it("a debit within the balance applies in full", async () => {
    const { service, creditsRepo } = setup();
    await seedCredits(creditsRepo, 3);

    const result = await service.adjustCredits({ email: EMAIL, amount: -2, reason: "Corrección", by: ADMIN });

    expect(result).toEqual({ requested: -2, applied: -2 });
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(1);
  });

  it("−3 on a 1-credit student stops at 0 and reports −1 applied, in the response and the audit", async () => {
    const { service, creditsRepo, audit } = setup();
    await seedCredits(creditsRepo, 1);

    const result = await service.adjustCredits({ email: EMAIL, amount: -3, reason: "Corrección", by: ADMIN });

    expect(result).toEqual({ requested: -3, applied: -1 });
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(0);
    const entries = audit.getAll(EMAIL);
    expect(entries.filter((e) => e.action === "decrement")).toHaveLength(1);
    expect(entries.at(-1)).toMatchObject({
      action: "admin_adjust", amount: -3, applied: -1, reason: "Corrección", by: ADMIN,
    });
  });

  it("a debit on a student with no credits applies nothing and still records the attempt", async () => {
    const { service, audit } = setup();

    const result = await service.adjustCredits({ email: EMAIL, amount: -2, reason: "x", by: ADMIN });

    expect(result).toEqual({ requested: -2, applied: 0 });
    expect(audit.getAll(EMAIL)).toEqual([
      expect.objectContaining({ action: "admin_adjust", amount: -2, applied: 0 }),
    ]);
  });

  it("a failure that is not InsufficientCredits propagates, after the credits already taken", async () => {
    const { service, creditsRepo, audit } = setup();
    await seedCredits(creditsRepo, 3);
    const decrement = jest.spyOn(creditsRepo, "decrementCredit");
    decrement.mockImplementationOnce(InMemoryCreditsRepository.prototype.decrementCredit.bind(creditsRepo));
    decrement.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      service.adjustCredits({ email: EMAIL, amount: -3, reason: "Corrección", by: ADMIN }),
    ).rejects.toThrow("connection reset");

    expect(decrement).toHaveBeenCalledTimes(2);
    expect((await creditsRepo.getCredits(EMAIL))?.credits).toBe(2);
    expect(audit.getAll(EMAIL).some((e) => e.action === "admin_adjust")).toBe(false);
  });

  it("amount 0 touches no credits but records the attribution", async () => {
    const { service, creditsRepo, audit } = setup();
    const decrement = jest.spyOn(creditsRepo, "decrementCredit");
    const add       = jest.spyOn(creditsRepo, "addCredits");

    const result = await service.adjustCredits({ email: EMAIL, amount: 0, reason: "noop", by: ADMIN });

    expect(result).toEqual({ requested: 0, applied: 0 });
    expect(decrement).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(audit.getAll(EMAIL)).toHaveLength(1);
  });
});

describe("AdminService.listUsers", () => {
  /** One user per relationship, plus the admin's own account. Accounts are created in this
   *  order, so "newest first" is reader-only first. */
  function seedUsers(queries: InMemoryAdminQueryRepository) {
    queries.addUser("admin@example.com", "Gustavo", { role: "admin" });
    queries.addPack("admin@example.com", { credits: 5, expiresAt: inDays(60) });

    queries.addUser("holder@example.com", "Hugo Holder");            // credits to book
    queries.addPack("holder@example.com", { credits: 3, expiresAt: inDays(60) });
    queries.addPack("holder@example.com", { credits: 5, expiresAt: inDays(-1) });  // expired

    queries.addUser("spent@example.com", "Sara Spent");              // pack used up, booked ahead
    queries.addPack("spent@example.com", { credits: 0, expiresAt: inDays(60) });
    queries.addBooking("spent@example.com", { startsAt: inDays(5), sessionType: "pack" });

    queries.addUser("caller@example.com", "Carla Caller");           // free call, done
    queries.addBooking("caller@example.com", { startsAt: inDays(-10), status: "completed", sessionType: "free15min" });

    queries.addUser("quitter@example.com", "Quique Quitter");        // cancelled only
    queries.addBooking("quitter@example.com", { startsAt: inDays(3), status: "cancelled" });

    queries.addUser("subscriber@example.com", "Susana Sub");         // newsletter only
    queries.addSubscription("subscriber@example.com", "blog", { areas: ["ia"] });

    queries.addUser("reader@example.com", "Lola Lectora");           // course only
    queries.addLessonProgress("reader@example.com", "dl-nlp", "perceptron", { status: "completed", lastSeenAt: inDays(-2) });
    queries.addLessonProgress("reader@example.com", "dl-nlp", "mlp", { lastSeenAt: inDays(-1) });
  }

  const emails = (page: { rows: { email: string }[] }) => page.rows.map((r) => r.email);

  it("lists every account but the admin's, newest first, with every tab count", async () => {
    const { service, queries } = setup();
    seedUsers(queries);

    const page = await service.listUsers({ segment: "all", page: 1, pageSize: STUDENTS_PAGE_SIZE });

    expect(emails(page)).toEqual([
      "reader@example.com", "subscriber@example.com", "quitter@example.com",
      "caller@example.com", "spent@example.com", "holder@example.com",
    ]);
    expect(page.counts).toEqual({
      all: 6, credits: 1, upcoming: 1, booked: 2, courses: 1, subscribed: 1,
    });
  });

  it("«Con créditos»: unbooked credits in unexpired packs only, with the soonest expiry", async () => {
    const { service, queries } = setup();
    seedUsers(queries);
    const lateExpiry = inDays(10);
    queries.addUser("late@example.com", "Luis Late");
    queries.addPack("late@example.com", { credits: 1, expiresAt: lateExpiry });
    queries.addPack("late@example.com", { credits: 2, expiresAt: inDays(90) });

    const page = await service.listUsers({ segment: "credits", page: 1, pageSize: STUDENTS_PAGE_SIZE });

    // Soonest expiry first; the used-up pack and the expired 5 never count.
    expect(emails(page)).toEqual(["late@example.com", "holder@example.com"]);
    expect(page.rows[0]).toMatchObject({ unbookedCredits: 3, earliestExpiry: lateExpiry });
    expect(page.rows[1]).toMatchObject({ unbookedCredits: 3 });
    expect(page.counts.credits).toBe(2);
  });

  it("«Clases próximas» and «Han reservado»: the free call counts, a cancellation doesn't", async () => {
    const { service, queries } = setup();
    seedUsers(queries);

    const upcoming = await service.listUsers({ segment: "upcoming", page: 1, pageSize: 50 });
    const booked   = await service.listUsers({ segment: "booked", page: 1, pageSize: 50 });

    expect(emails(upcoming)).toEqual(["spent@example.com"]);
    expect(upcoming.rows[0].nextSession).not.toBeNull();
    // Most recently booked first: the caller's booking was created after the spender's.
    expect(emails(booked)).toEqual(["caller@example.com", "spent@example.com"]);
    expect(booked.rows.map((r) => r.bookingsCount)).toEqual([1, 1]);
  });

  it("«En cursos» carries each course's title and progress against the published lessons", async () => {
    const { service, queries } = setup();
    seedUsers(queries);
    // A completion on a lesson that is no longer published must not count.
    queries.addLessonProgress("reader@example.com", "dl-nlp", "retired-lesson", { status: "completed", lastSeenAt: inDays(-1) });

    const page = await service.listUsers({ segment: "courses", page: 1, pageSize: 50 });

    expect(emails(page)).toEqual(["reader@example.com"]);
    expect(page.rows[0].courses).toEqual([{
      slug:             "dl-nlp",
      title:            "Deep Learning para NLP: del Perceptrón al Transformer",
      completedLessons: 1,
      totalLessons:     3,
      percent:          33,
    }]);
    expect(queries.listCalls.at(-1)?.courseLessons).toEqual({
      "dl-nlp":     ["perceptron", "mlp", "rnn"],
      "llm-agents": ["atencion", "gpt"],
    });
  });

  it("a course that left the catalog shows its slug and 0%", async () => {
    const { service, queries } = setup();
    queries.addUser("old@example.com");
    queries.addLessonProgress("old@example.com", "retired-course", "x", { status: "completed", lastSeenAt: inDays(-1) });

    const page = await service.listUsers({ segment: "courses", page: 1, pageSize: 50 });

    expect(page.rows[0].courses).toEqual([
      { slug: "retired-course", title: "retired-course", completedLessons: 0, totalLessons: 0, percent: 0 },
    ]);
  });

  it("«Suscritos» carries the blog areas; null means every area", async () => {
    const { service, queries } = setup();
    seedUsers(queries);
    queries.addSubscription("reader@example.com", "courses");
    queries.addSubscription("reader@example.com", "blog");

    const page = await service.listUsers({ segment: "subscribed", page: 1, pageSize: 50 });

    // Latest opt-in first.
    expect(emails(page)).toEqual(["reader@example.com", "subscriber@example.com"]);
    expect(page.rows[0].subscriptions).toEqual([
      { type: "blog", areas: null },
      { type: "courses", areas: null },
    ]);
    expect(page.rows[1].subscriptions).toEqual([{ type: "blog", areas: ["ia"] }]);
  });

  it("the search narrows the rows and every count", async () => {
    const { service, queries } = setup();
    seedUsers(queries);

    const page = await service.listUsers({ query: "  HOLDER ", segment: "all", page: 1, pageSize: 50 });

    expect(emails(page)).toEqual(["holder@example.com"]);
    expect(page.counts).toEqual({ all: 1, credits: 1, upcoming: 0, booked: 0, courses: 0, subscribed: 0 });
    expect(queries.listCalls.at(-1)?.query).toBe("HOLDER");
  });

  it("maps the 1-based page to an offset; a blank query or a nonsense page reads as none / 1", async () => {
    const { service, queries } = setup();

    await service.listUsers({ query: "  ana  ", segment: "booked", page: 3, pageSize: 50 });
    await service.listUsers({ query: "   ", segment: "all", page: 0, pageSize: 50 });
    await service.listUsers({ segment: "all", page: 2.5, pageSize: 50 });

    expect(queries.listCalls.map(({ query, segment, limit, offset }) => ({ query, segment, limit, offset }))).toEqual([
      { query: "ana",     segment: "booked", limit: 50, offset: 100 },
      { query: undefined, segment: "all",    limit: 50, offset: 0 },
      { query: undefined, segment: "all",    limit: 50, offset: 0 },
    ]);
  });

  it("finds a user past the first 100 and pages them", async () => {
    const { service, queries } = setup();
    for (let i = 0; i < 120; i++) {
      queries.addUser(`usuario-${String(i).padStart(3, "0")}@example.com`, `Usuario ${i}`);
    }

    const found = await service.listUsers({ query: "usuario-110", segment: "all", page: 1, pageSize: 50 });
    const page3 = await service.listUsers({ segment: "all", page: 3, pageSize: 50 });

    expect(emails(found)).toEqual(["usuario-110@example.com"]);
    // Newest first: page 3 holds the 20 oldest accounts.
    expect(emails(page3)).toContain("usuario-000@example.com");
    expect(page3.rows).toHaveLength(20);
    expect(page3.counts.all).toBe(120);
  });
});

describe("AdminService course views", () => {
  /** dl-nlp (3 lessons): Ana finished, Beto halfway and active, Ciro idle for 40 days. */
  function seedReaders(queries: InMemoryAdminQueryRepository) {
    queries.addUser("admin@example.com", "Gustavo", { role: "admin" });
    queries.addLessonProgress("admin@example.com", "dl-nlp", "perceptron", { status: "completed", lastSeenAt: inDays(-1) });

    queries.addUser("ana@example.com", "Ana");
    ["perceptron", "mlp", "rnn"].forEach((lesson, i) => {
      queries.addLessonProgress("ana@example.com", "dl-nlp", lesson, { status: "completed", lastSeenAt: inDays(-52 + i) });
    });
    queries.addUser("beto@example.com", "Beto");
    queries.addLessonProgress("beto@example.com", "dl-nlp", "perceptron", { status: "completed", lastSeenAt: inDays(-5) });
    queries.addLessonProgress("beto@example.com", "dl-nlp", "mlp", { lastSeenAt: inDays(-3) });
    queries.addUser("ciro@example.com", "Ciro");
    queries.addLessonProgress("ciro@example.com", "dl-nlp", "perceptron", { lastSeenAt: inDays(-40) });

    queries.addUser("dora@example.com", "Dora");                     // llm-agents, caught up
    queries.addLessonProgress("dora@example.com", "llm-agents", "atencion", { status: "completed", lastSeenAt: inDays(-90) });
    queries.addLessonProgress("dora@example.com", "llm-agents", "gpt", { status: "completed", lastSeenAt: inDays(-90) });
  }

  it("listCourses: per-course counts by status and the average progress", async () => {
    const { service, queries } = setup();
    seedReaders(queries);

    const courses = await service.listCourses();

    expect(courses).toEqual([
      {
        slug: "dl-nlp", title: "Deep Learning para NLP: del Perceptrón al Transformer",
        totalLessons: 3, complete: true,
        counts: { all: 3, active: 1, finished: 1, inactive: 1 },
        // (3 + 1 + 0) / 3 readers = 1.33 lessons of 3 → 44%
        avgPercent: 44,
      },
      {
        slug: "llm-agents", title: "Modelos de Lenguaje: del Transformer al Agente",
        totalLessons: 2, complete: false,
        counts: { all: 1, active: 0, finished: 1, inactive: 0 },
        avgPercent: 100,
      },
    ]);
    // Counts only, with the published lessons and a 30-day window.
    const call = queries.courseListCalls[0];
    expect(call).toMatchObject({ courseSlug: "dl-nlp", lessons: ["perceptron", "mlp", "rnn"], status: "all", limit: 0 });
    const days = (Date.now() - new Date(call.activeSince).getTime()) / DAY_MS;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
  });

  it("getCourseReaders: latest activity first, with percent and the last lesson's title", async () => {
    const { service, queries } = setup();
    seedReaders(queries);

    const list = await service.getCourseReaders("dl-nlp", { status: "all", page: 1, pageSize: COURSE_READERS_PAGE_SIZE });

    expect(list?.rows.map((r) => [r.email, r.status, r.percent, r.lastLessonTitle])).toEqual([
      ["beto@example.com", "active",   33,  "El MLP"],
      ["ciro@example.com", "inactive", 0,   "El perceptrón"],
      ["ana@example.com",  "finished", 100, "Las RNN"],
    ]);
    expect(list?.course.counts).toEqual({ all: 3, active: 1, finished: 1, inactive: 1 });
  });

  it("getCourseReaders: a status tab filters the rows, not the counts, and pages", async () => {
    const { service, queries } = setup();
    seedReaders(queries);

    const inactive = await service.getCourseReaders("dl-nlp", { status: "inactive", page: 1, pageSize: 50 });
    await service.getCourseReaders("dl-nlp", { status: "active", page: 2, pageSize: 50 });

    expect(inactive?.rows.map((r) => r.email)).toEqual(["ciro@example.com"]);
    expect(inactive?.course.counts.all).toBe(3);
    expect(queries.courseListCalls.at(-1)).toMatchObject({ status: "active", limit: 50, offset: 50 });
  });

  it("an unpublished course has no reader page and no funnel", async () => {
    const { service } = setup();

    expect(await service.getCourseReaders("nope", { status: "all", page: 1, pageSize: 50 })).toBeNull();
    expect(await service.getCourseLessonStats("nope")).toBeNull();
  });

  it("getCourseLessonStats: published lessons by block, in reading order, admin left out", async () => {
    const { service, queries } = setup();
    seedReaders(queries);
    queries.addLessonProgress("beto@example.com", "dl-nlp", "retired-lesson", { lastSeenAt: inDays(-1) });

    const blocks = await service.getCourseLessonStats("dl-nlp");

    // Block 3 has nothing published; the retired lesson is dropped.
    expect(blocks).toEqual([
      {
        id: 1, title: "Fundamentos",
        lessons: [
          { slug: "perceptron", title: "El perceptrón", started: 3, completed: 2 },
          { slug: "mlp",        title: "El MLP",        started: 2, completed: 1 },
        ],
      },
      {
        id: 2, title: "Secuencias",
        lessons: [{ slug: "rnn", title: "Las RNN", started: 1, completed: 1 }],
      },
    ]);
  });
});

describe("AdminService.listUserCourses", () => {
  it("reports the reader's own progress, last lesson and status per course", async () => {
    const { service, courseService } = setup();
    await courseService.markLessonCompleted(EMAIL, "dl-nlp", "perceptron");
    await courseService.markLessonSeen(EMAIL, "dl-nlp", "mlp");
    await courseService.markLessonCompleted(EMAIL, "llm-agents", "atencion");
    await courseService.markLessonCompleted(EMAIL, "llm-agents", "gpt");

    const courses = await service.listUserCourses(EMAIL);

    expect(courses).toEqual([
      expect.objectContaining({
        slug: "dl-nlp", title: "Deep Learning para NLP: del Perceptrón al Transformer",
        completedLessons: 1, totalLessons: 3, percent: 33,
        lastLessonTitle: "El MLP", courseComplete: true,
      }),
      expect.objectContaining({
        slug: "llm-agents", completedLessons: 2, totalLessons: 2, percent: 100,
        status: "finished", courseComplete: false,
      }),
    ]);
  });

  it("the status uses the same 30-day window as the course page", async () => {
    const { service, courseService } = setup();
    await courseService.markLessonSeen(EMAIL, "dl-nlp", "mlp");
    // InMemoryCourseRepository's clock sits in January 2026: long before the window.
    const [course] = await service.listUserCourses(EMAIL);

    expect(course.status).toBe("inactive");
  });

  it("an unknown user has no courses", async () => {
    const { service } = setup();

    expect(await service.listUserCourses("nobody@example.com")).toEqual([]);
  });
});

describe("AdminService.listUserSubscriptions", () => {
  it("returns the user's opt-ins with their areas and dates", async () => {
    const { service, queries } = setup();
    queries.addUser(EMAIL, "Ana");
    queries.addSubscription(EMAIL, "courses", { createdAt: "2026-03-01T00:00:00.000Z" });
    queries.addSubscription(EMAIL, "blog", { areas: ["ia", "matematicas"], createdAt: "2026-02-01T00:00:00.000Z" });

    expect(await service.listUserSubscriptions(EMAIL)).toEqual([
      { type: "blog",    areas: ["ia", "matematicas"], createdAt: "2026-02-01T00:00:00.000Z" },
      { type: "courses", areas: null,                  createdAt: "2026-03-01T00:00:00.000Z" },
    ]);
    expect(await service.listUserSubscriptions("nobody@example.com")).toEqual([]);
  });
});

describe("AdminService dashboard reads", () => {
  it("revenueLast30Days sums succeeded payments inside the window", async () => {
    const { service, queries } = setup();
    queries.addUser(EMAIL, "Ana");
    queries.addPayment(EMAIL, { amountCents: 1600, createdAt: inDays(-2) });
    queries.addPayment(EMAIL, { amountCents: 3000, createdAt: inDays(-29) });
    queries.addPayment(EMAIL, { amountCents: 9999, createdAt: inDays(-31) });
    queries.addPayment(EMAIL, { amountCents: 7500, status: "refunded", createdAt: inDays(-1) });

    expect(await service.revenueLast30Days()).toBe(4600);
  });

  it("dashboardCounts counts users with credits still to book", async () => {
    const { service, queries } = setup();
    queries.addUser("reader@example.com");
    queries.addUser("spent@example.com");
    queries.addPack("spent@example.com", { credits: 0, expiresAt: inDays(10) });
    queries.addUser("holder@example.com");
    queries.addPack("holder@example.com", { credits: 1, expiresAt: inDays(10) });
    queries.addBooking("holder@example.com", { startsAt: inDays(2) });
    queries.failedBookings = 2;

    expect(await service.dashboardCounts()).toEqual({
      upcomingBookings: 1, usersWithCredits: 1, failedBookings: 2,
    });
  });
});

// ADMIN-02: the sidebar badges, read by the admin layout on every page.
describe("AdminService.navCounts", () => {
  it("returns the failed-booking and open-report counts", async () => {
    const { service, queries } = setup();
    queries.failedBookings = 2;
    queries.openReports    = 3;

    expect(await service.navCounts()).toEqual({ failedBookings: 2, openReports: 3 });
  });

  it("a read error answers null (no badges) and logs, instead of failing the page", async () => {
    const { service, queries } = setup();
    queries.navCountsError = new Error("supabase down");
    const { log } = jest.requireMock("@/lib/logger") as { log: jest.Mock };
    log.mockClear();

    await expect(service.navCounts()).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(
      "warn",
      expect.stringContaining("nav counts"),
      expect.objectContaining({ service: "AdminService", err: expect.stringContaining("supabase down") }),
    );
  });
});
