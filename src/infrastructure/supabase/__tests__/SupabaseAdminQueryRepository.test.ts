// REFACTOR-R4-P3-02: integration test for the admin reads behind SupabaseAdminQueryRepository.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
//
// ADMIN-USERS-01: pins the three functions of migration 0027 — admin_list_users (every
// user but the admin, one tab per relationship), admin_list_course_users and
// admin_course_lesson_stats. Six seeded users, created in this order (so "newest first" is
// the reverse):
//
//   reader      course only: completed lesson a + an unpublished one, viewing b now
//   booker      an upcoming confirmed class + a pack with 4 credits
//   holder      1 active credit + an expired pack of 5; finished the course 50 days ago
//   subscriber  blog opt-in (area ia); opened lesson a 40 days ago and stopped
//   canceller   a cancelled booking only
//   admin       users.role = 'admin', with credits and a completed lesson: never counted
//
// Every query is scoped to this run's stamp (the users' emails and names, and a course slug
// no real content uses), so rows other tests leave in the shared test database never reach
// the assertions.
import { SupabaseAdminQueryRepository } from "../SupabaseAdminQueryRepository";
import { SupabaseUserRepository } from "../SupabaseUserRepository";
import { uniqueFutureSlot } from "./slot-helpers";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

describeDb("SupabaseAdminQueryRepository (admin_list_users, admin_list_course_users)", () => {
  const repo   = new SupabaseAdminQueryRepository();
  const users  = new SupabaseUserRepository();
  const stamp  = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email  = (who: string) => `test-admin-users-${stamp}-${who}@example.com`;
  const reader     = email("reader");
  const booker     = email("booker");
  const holder     = email("holder");
  const subscriber = email("subscriber");
  const canceller  = email("canceller");
  const admin      = email("admin");
  const course     = `test-course-${stamp}`;
  const lessons    = ["lesson-a", "lesson-b"];
  const slot       = uniqueFutureSlot();
  const holderExpiry = new Date(Date.now() + 40 * DAY_MS).toISOString();
  const ids: Record<string, string> = {};

  const all = () => repo.listUsers({
    query: stamp, segment: "all", courseLessons: { [course]: lessons }, limit: 50, offset: 0,
  });

  beforeAll(async () => {
    // Fail loudly rather than mysteriously if migration 0027 has not been applied.
    const { error } = await supabase.rpc("admin_list_users", { p_limit: 0 });
    if (error) {
      throw new Error(
        `admin_list_users is not available in this database — apply ` +
        `supabase/migrations/0027_admin_users.sql first. (${error.message})`,
      );
    }

    // One at a time: created_at orders the «all» tab.
    for (const [who, mail] of Object.entries({ reader, booker, holder, subscriber, canceller, admin })) {
      ids[who] = await users.upsert(mail, `${who} ${stamp}`);
    }
    const role = await supabase.from("users").update({ role: "admin" }).eq("id", ids.admin);
    if (role.error) throw role.error;

    const packs = await supabase.from("credit_packs").insert([
      {
        user_id: ids.booker, pack_size: 5, credits_remaining: 4,
        stripe_payment_id: `pi_admin_users_b_${stamp}`,
        expires_at: new Date(Date.now() + 90 * DAY_MS).toISOString(),
      },
      {
        user_id: ids.holder, pack_size: 5, credits_remaining: 1,
        stripe_payment_id: `pi_admin_users_h1_${stamp}`, expires_at: holderExpiry,
      },
      {
        // Expired: its 5 credits are not credits to book.
        user_id: ids.holder, pack_size: 5, credits_remaining: 5,
        stripe_payment_id: `pi_admin_users_h2_${stamp}`, expires_at: daysAgo(1),
      },
      {
        user_id: ids.admin, pack_size: 5, credits_remaining: 5,
        stripe_payment_id: `pi_admin_users_a_${stamp}`,
        expires_at: new Date(Date.now() + 90 * DAY_MS).toISOString(),
      },
    ]);
    if (packs.error) throw packs.error;

    const cancelledSlot = uniqueFutureSlot();
    const bookings = await supabase.from("bookings").insert([
      {
        user_id: ids.booker, session_type: "session1h",
        starts_at: slot.startIso, ends_at: slot.endIso, status: "confirmed",
        cancel_token: `cancel-admin-users-${stamp}`, join_token: `join-admin-users-${stamp}`,
      },
      {
        user_id: ids.canceller, session_type: "session1h",
        starts_at: cancelledSlot.startIso, ends_at: cancelledSlot.endIso, status: "cancelled",
        cancel_token: `cancel-admin-users-c-${stamp}`, join_token: `join-admin-users-c-${stamp}`,
      },
    ]);
    if (bookings.error) throw bookings.error;

    const subs = await supabase.from("subscriptions").insert({ user_id: ids.subscriber, type: "blog", areas: ["ia"] });
    if (subs.error) throw subs.error;

    const enrollments = await supabase.from("enrollments").insert([
      { user_id: ids.reader,     course_slug: course, enrolled_at: daysAgo(3) },
      { user_id: ids.holder,     course_slug: course, enrolled_at: daysAgo(60) },
      { user_id: ids.subscriber, course_slug: course, enrolled_at: daysAgo(40) },
      { user_id: ids.admin,      course_slug: course, enrolled_at: daysAgo(1) },
    ]);
    if (enrollments.error) throw enrollments.error;

    const done = (userId: string, lesson: string, seen: string) => ({
      user_id: userId, course_slug: course, lesson_slug: lesson,
      status: "completed", completed_at: seen, last_seen_at: seen,
    });
    const progress = await supabase.from("lesson_progress").insert([
      done(ids.reader, "lesson-a", daysAgo(2)),
      done(ids.reader, "retired-lesson", daysAgo(2)),     // not published: never counts
      { user_id: ids.reader, course_slug: course, lesson_slug: "lesson-b", status: "started", last_seen_at: new Date().toISOString() },
      done(ids.holder, "lesson-a", daysAgo(51)),
      done(ids.holder, "lesson-b", daysAgo(50)),
      { user_id: ids.subscriber, course_slug: course, lesson_slug: "lesson-a", status: "started", last_seen_at: daysAgo(40) },
      done(ids.admin, "lesson-a", daysAgo(1)),
    ]);
    if (progress.error) throw progress.error;
  });

  afterAll(async () => {
    // delete_user_account walks every user-linked table in FK-safe order (0017/0021/0022).
    for (const mail of [reader, booker, holder, subscriber, canceller, admin]) {
      await supabase.rpc("delete_user_account", { p_email: mail });
    }
  });

  // ─── admin_list_users ────────────────────────────────────────────────────────

  it("lists every user but the admin, newest account first, with every tab count", async () => {
    const page = await all();

    expect(page.rows.map((r) => r.email)).toEqual([canceller, subscriber, holder, booker, reader]);
    expect(page.counts).toEqual({ all: 5, credits: 2, upcoming: 1, booked: 1, courses: 3, subscribed: 1 });

    const byEmail = Object.fromEntries(page.rows.map((r) => [r.email, r]));
    expect(byEmail[booker]).toMatchObject({
      name: `booker ${stamp}`, unbookedCredits: 4, bookingsCount: 1, nextSession: slot.startIso,
      courses: [], subscriptions: [],
    });
    expect(byEmail[holder]).toMatchObject({ unbookedCredits: 1, earliestExpiry: holderExpiry, nextSession: null });
    expect(byEmail[canceller]).toMatchObject({ bookingsCount: 0, nextSession: null });
    expect(byEmail[reader].createdAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
  });

  it("«credits»: soonest expiry first", async () => {
    const page = await repo.listUsers({ query: stamp, segment: "credits", courseLessons: {}, limit: 50, offset: 0 });

    expect(page.rows.map((r) => r.email)).toEqual([holder, booker]);
  });

  it("«upcoming» and «booked» leave the cancelled booking out", async () => {
    const upcoming = await repo.listUsers({ query: stamp, segment: "upcoming", courseLessons: {}, limit: 50, offset: 0 });
    const booked   = await repo.listUsers({ query: stamp, segment: "booked",   courseLessons: {}, limit: 50, offset: 0 });

    expect(upcoming.rows.map((r) => r.email)).toEqual([booker]);
    expect(booked.rows.map((r) => r.email)).toEqual([booker]);
  });

  it("«courses»: latest activity first, counting only the published lessons passed in", async () => {
    const page = await repo.listUsers({
      query: stamp, segment: "courses", courseLessons: { [course]: lessons }, limit: 50, offset: 0,
    });

    expect(page.rows.map((r) => r.email)).toEqual([reader, subscriber, holder]);
    expect(page.rows.map((r) => r.courses)).toEqual([
      [{ slug: course, completedLessons: 1 }],
      [{ slug: course, completedLessons: 0 }],
      [{ slug: course, completedLessons: 2 }],
    ]);
  });

  it("a course missing from the lesson map counts no completed lesson", async () => {
    const page = await repo.listUsers({ query: holder, segment: "courses", courseLessons: {}, limit: 50, offset: 0 });

    expect(page.rows[0].courses).toEqual([{ slug: course, completedLessons: 0 }]);
  });

  it("«subscribed» carries the type and the blog areas", async () => {
    const page = await repo.listUsers({ query: stamp, segment: "subscribed", courseLessons: {}, limit: 50, offset: 0 });

    expect(page.rows.map((r) => [r.email, r.subscriptions])).toEqual([
      [subscriber, [{ type: "blog", areas: ["ia"] }]],
    ]);
  });

  it("finds a user by a name fragment, case-insensitively, and the counts follow the search", async () => {
    const page = await repo.listUsers({ query: `BOOKER ${stamp}`, segment: "all", courseLessons: {}, limit: 50, offset: 0 });

    expect(page.rows.map((r) => r.email)).toEqual([booker]);
    expect(page.counts).toEqual({ all: 1, credits: 1, upcoming: 1, booked: 1, courses: 0, subscribed: 0 });
  });

  it("pages with limit/offset, and an empty page still carries the counts", async () => {
    const first = await repo.listUsers({ query: stamp, segment: "credits", courseLessons: {}, limit: 1, offset: 0 });
    const second = await repo.listUsers({ query: stamp, segment: "credits", courseLessons: {}, limit: 1, offset: 1 });
    const past  = await repo.listUsers({ query: stamp, segment: "credits", courseLessons: {}, limit: 1, offset: 2 });

    expect(first.rows.map((r) => r.email)).toEqual([holder]);
    expect(second.rows.map((r) => r.email)).toEqual([booker]);
    expect(past.rows).toEqual([]);
    expect(past.counts.all).toBe(5);
  });

  it("the admin's account is never listed nor counted", async () => {
    const page = await repo.listUsers({ query: admin, segment: "all", courseLessons: {}, limit: 50, offset: 0 });

    expect(page).toEqual({
      rows: [], counts: { all: 0, credits: 0, upcoming: 0, booked: 0, courses: 0, subscribed: 0 },
    });
  });

  it("getStudent reaches any user and carries the account's creation date", async () => {
    const user = await repo.getStudent(reader);

    expect(user).toMatchObject({ id: ids.reader, email: reader, name: `reader ${stamp}` });
    expect(user?.createdAt).toMatch(/Z$/);
    expect(await repo.getStudent(`nobody-${stamp}@example.com`)).toBeNull();
  });

  it("the dashboard's count includes the seeded credit holders", async () => {
    const counts = await repo.dashboardCounts();

    expect(counts.usersWithCredits).toBeGreaterThanOrEqual(2);
  });

  // ─── admin_list_course_users / admin_course_lesson_stats ─────────────────────

  const readers = (status: "all" | "active" | "finished" | "inactive", limit = 50, offset = 0) =>
    repo.listCourseReaders({
      courseSlug: course, lessons, status, activeSince: daysAgo(30), limit, offset,
    });

  it("classifies every reader but the admin, latest activity first", async () => {
    const page = await readers("all");

    expect(page.rows.map((r) => [r.email, r.status, r.completedLessons, r.lastLessonSlug])).toEqual([
      [reader,     "active",   1, "lesson-b"],
      [subscriber, "inactive", 0, "lesson-a"],
      [holder,     "finished", 2, "lesson-b"],
    ]);
    expect(page.counts).toEqual({ all: 3, active: 1, finished: 1, inactive: 1 });
    // (1 + 0 + 2) / 3
    expect(page.avgCompletedLessons).toBeCloseTo(1, 5);
    expect(page.rows[2].enrolledAt).toMatch(/Z$/);
  });

  it("a status tab filters the rows, not the counts; p_limit 0 gives the counts alone", async () => {
    const inactive = await readers("inactive");
    const countsOnly = await readers("all", 0);

    expect(inactive.rows.map((r) => r.email)).toEqual([subscriber]);
    expect(inactive.counts.all).toBe(3);
    expect(countsOnly.rows).toEqual([]);
    expect(countsOnly.counts).toEqual({ all: 3, active: 1, finished: 1, inactive: 1 });
  });

  it("an unknown course has no readers and zero counts", async () => {
    const page = await repo.listCourseReaders({
      courseSlug: `nope-${stamp}`, lessons, status: "all", activeSince: daysAgo(30), limit: 50, offset: 0,
    });

    expect(page).toEqual({ rows: [], counts: { all: 0, active: 0, finished: 0, inactive: 0 }, avgCompletedLessons: 0 });
  });

  it("courseLessonStats counts who opened and who completed each lesson, admin left out", async () => {
    const stats = await repo.courseLessonStats(course);
    const bySlug = Object.fromEntries(stats.map((s) => [s.lessonSlug, s]));

    expect(bySlug["lesson-a"]).toEqual({ lessonSlug: "lesson-a", started: 3, completed: 2 });
    expect(bySlug["lesson-b"]).toEqual({ lessonSlug: "lesson-b", started: 2, completed: 1 });
    // Unpublished lessons come back too; the service drops them.
    expect(bySlug["retired-lesson"]).toEqual({ lessonSlug: "retired-lesson", started: 1, completed: 1 });
  });

  it("listUserSubscriptions returns the opt-ins with their dates", async () => {
    const subs = await repo.listUserSubscriptions(subscriber);

    expect(subs).toEqual([{ type: "blog", areas: ["ia"], createdAt: expect.stringMatching(/Z$/) }]);
    expect(await repo.listUserSubscriptions(`nobody-${stamp}@example.com`)).toEqual([]);
  });

  // ADMIN-02: the sidebar badge counts open reports only. The reports hang off the
  // reader's user_id, so afterAll's delete_user_account removes them.
  it("navCounts counts an open content report and ignores a resolved one", async () => {
    const before = await repo.navCounts();

    const report = (status: "open" | "resolved") => ({
      content_type: "post", content_key: `test-admin-nav-${stamp}`, locale: "es",
      page_url: `/blog/test-admin-nav-${stamp}`, message: "Errata de prueba (ADMIN-02)",
      user_id: ids.reader, status,
    });
    const inserted = await supabase.from("content_reports").insert([report("open"), report("resolved")]);
    if (inserted.error) throw inserted.error;

    const after = await repo.navCounts();
    expect(after.openReports - before.openReports).toBe(1);
    expect(after.failedBookings).toBeGreaterThanOrEqual(0);
  });
});
