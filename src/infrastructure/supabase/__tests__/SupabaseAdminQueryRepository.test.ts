// REFACTOR-R4-P3-02: integration test for the admin_list_students RPC (migration 0024)
// behind SupabaseAdminQueryRepository.listStudents.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
//
// Three seeded users: a course reader (no booking, no pack), a booker holding 4
// credits, and a pack holder with 1 active credit plus an expired pack of 5. Every
// query is scoped to this run's stamp, so rows other tests leave in the shared test
// database never reach the assertions.
import { SupabaseAdminQueryRepository } from "../SupabaseAdminQueryRepository";
import { SupabaseUserRepository } from "../SupabaseUserRepository";
import { uniqueFutureSlot } from "./slot-helpers";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

const DAY_MS = 86_400_000;

describeDb("SupabaseAdminQueryRepository.listStudents (admin_list_students)", () => {
  const repo   = new SupabaseAdminQueryRepository();
  const users  = new SupabaseUserRepository();
  const stamp  = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const reader = `test-admin-list-${stamp}-a-reader@example.com`;
  const booker = `test-admin-list-${stamp}-b-booker@example.com`;
  const holder = `test-admin-list-${stamp}-c-holder@example.com`;
  const slot   = uniqueFutureSlot();
  const holderExpiry = new Date(Date.now() + 40 * DAY_MS).toISOString();

  beforeAll(async () => {
    // Fail loudly rather than mysteriously if migration 0024 has not been applied.
    const { error } = await supabase.rpc("admin_list_students", { p_limit: 0 });
    if (error) {
      throw new Error(
        `admin_list_students is not available in this database — apply ` +
        `supabase/migrations/0024_admin_students.sql first. (${error.message})`,
      );
    }

    await users.upsert(reader, `Lector ${stamp}`);
    const bookerId = await users.upsert(booker, `Booker ${stamp}`);
    const holderId = await users.upsert(holder, `Holder ${stamp}`);

    const packs = await supabase.from("credit_packs").insert([
      {
        user_id: bookerId, pack_size: 5, credits_remaining: 4,
        stripe_payment_id: `pi_admin_list_b_${stamp}`,
        expires_at: new Date(Date.now() + 90 * DAY_MS).toISOString(),
      },
      {
        user_id: holderId, pack_size: 5, credits_remaining: 1,
        stripe_payment_id: `pi_admin_list_c1_${stamp}`, expires_at: holderExpiry,
      },
      {
        // Expired: its 5 credits must not lift the holder out of "low credit".
        user_id: holderId, pack_size: 5, credits_remaining: 5,
        stripe_payment_id: `pi_admin_list_c2_${stamp}`,
        expires_at: new Date(Date.now() - DAY_MS).toISOString(),
      },
    ]);
    if (packs.error) throw packs.error;

    const booking = await supabase.from("bookings").insert({
      user_id: bookerId, session_type: "session1h",
      starts_at: slot.startIso, ends_at: slot.endIso, status: "confirmed",
      cancel_token: `cancel-admin-list-${stamp}`, join_token: `join-admin-list-${stamp}`,
    });
    if (booking.error) throw booking.error;
  });

  afterAll(async () => {
    // delete_user_account walks every user-linked table in FK-safe order (0017/0021).
    for (const email of [reader, booker, holder]) {
      await supabase.rpc("delete_user_account", { p_email: email });
    }
  });

  it("lists the booker and the pack holder, not the course reader", async () => {
    const page = await repo.listStudents({ query: stamp, lowCredit: false, limit: 50, offset: 0 });

    expect(page.rows.map((r) => r.email)).toEqual([booker, holder]);
    expect(page.total).toBe(2);
    expect(page.lowCreditTotal).toBe(1);

    const [b, h] = page.rows;
    expect(b).toMatchObject({ name: `Booker ${stamp}`, totalCredits: 4 });
    expect(new Date(b.nextSession!).toISOString()).toBe(slot.startIso);
    expect(h).toMatchObject({ name: `Holder ${stamp}`, totalCredits: 1, nextSession: null });
    expect(new Date(h.earliestExpiry!).toISOString()).toBe(holderExpiry);
  });

  it("the low-credit tab lists the holder and keeps the unfiltered total", async () => {
    const page = await repo.listStudents({ query: stamp, lowCredit: true, limit: 50, offset: 0 });

    expect(page.rows.map((r) => r.email)).toEqual([holder]);
    expect(page).toMatchObject({ total: 2, lowCreditTotal: 1 });
  });

  it("finds a student by a name fragment, case-insensitively", async () => {
    const page = await repo.listStudents({ query: `BOOKER ${stamp}`, lowCredit: false, limit: 50, offset: 0 });

    expect(page.rows.map((r) => r.email)).toEqual([booker]);
    expect(page.total).toBe(1);
  });

  it("pages with limit/offset, and an empty page still carries both counts", async () => {
    const first  = await repo.listStudents({ query: stamp, lowCredit: false, limit: 1, offset: 0 });
    const second = await repo.listStudents({ query: stamp, lowCredit: false, limit: 1, offset: 1 });
    const past   = await repo.listStudents({ query: stamp, lowCredit: false, limit: 1, offset: 2 });

    expect(first.rows.map((r) => r.email)).toEqual([booker]);
    expect(second.rows.map((r) => r.email)).toEqual([holder]);
    expect(past).toEqual({ rows: [], total: 2, lowCreditTotal: 1 });
  });

  it("an empty low-credit tab still reports the total", async () => {
    const page = await repo.listStudents({ query: `Booker ${stamp}`, lowCredit: true, limit: 50, offset: 0 });

    expect(page).toEqual({ rows: [], total: 1, lowCreditTotal: 0 });
  });

  it("the course reader is still reachable by email", async () => {
    expect(await repo.getStudent(reader)).toMatchObject({ email: reader, name: `Lector ${stamp}` });
    expect(await repo.getStudent(`nobody-${stamp}@example.com`)).toBeNull();
  });

  it("the dashboard's low-credit count includes the seeded holder", async () => {
    const counts = await repo.dashboardCounts();

    expect(counts.lowCreditStudents).toBeGreaterThanOrEqual(1);
  });
});
