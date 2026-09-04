// ACCOUNT-DELETE-01: integration test for the delete_user_account stored procedure.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
//
// This is the test that actually proves the FK-safe ordering in migration 0017:
// it seeds one row in EVERY table that references a user (directly or through a
// booking), runs the deletion, and asserts nothing is left behind. Eleven of those
// foreign keys are RESTRICT or no-action, so a wrong order surfaces here as a
// foreign-key violation rather than as silent orphan rows in production.
import { SupabaseUserRepository } from "../SupabaseUserRepository";
import { UserNotFoundError } from "@/domain/errors";
import { uniqueFutureSlot } from "./slot-helpers";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

describeDb("delete_user_account", () => {
  const repo   = new SupabaseUserRepository();
  const stamp  = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email  = `test-deletion-${stamp}@example.com`;
  const eventId = `evt-deletion-${stamp}`;

  let userId = "";
  let bookingId = "";

  beforeAll(async () => {
    // Fail loudly rather than mysteriously if migration 0017 has not been applied.
    const { error } = await supabase.rpc("delete_user_account", {
      p_email: `no-such-user-${stamp}@example.com`,
    });
    if (error) {
      throw new Error(
        `delete_user_account is not available in this database — apply ` +
        `supabase/migrations/0017_delete_user_account.sql first. (${error.message})`,
      );
    }

    userId = await repo.upsert(email, "Deletion Test");

    const { startIso, endIso } = uniqueFutureSlot();

    const { data: pack } = await supabase.from("credit_packs").insert({
      user_id: userId, pack_size: 5, credits_remaining: 4,
      stripe_payment_id: `pi_pack_${stamp}`,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }).select("id").single();

    const { data: booking } = await supabase.from("bookings").insert({
      user_id: userId, credit_pack_id: pack!.id, session_type: "pack",
      starts_at: startIso, ends_at: endIso, status: "confirmed",
      calendar_event_id: eventId,
      cancel_token: `cancel-${stamp}`, join_token: `join-${stamp}`,
    }).select("id").single();
    bookingId = booking!.id;

    const { data: zoomSession } = await supabase.from("zoom_sessions").insert({
      booking_id: bookingId, session_name: `sess-${stamp}`, session_passcode: "1234",
    }).select("id").single();

    await Promise.all([
      supabase.from("session_messages").insert({ zoom_session_id: zoomSession!.id, content: "hola" }),
      supabase.from("pending_terminations").insert({
        event_id: eventId, fire_at: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      supabase.from("reviews").insert({ booking_id: bookingId, user_id: userId, rating: 5 }),
      supabase.from("payments").insert({
        user_id: userId, stripe_payment_id: `pi_pay_${stamp}`,
        amount_cents: 1600, checkout_type: "single",
      }),
      supabase.from("audit_log").insert({ user_id: userId, action: "purchase" }),
      supabase.from("failed_bookings").insert({
        stripe_session_id: `cs_${stamp}`, user_id: userId,
        start_iso: startIso, failed_at: new Date().toISOString(), error: "test",
      }),
      supabase.from("subscriptions").insert({ user_id: userId, type: "courses" }),
      supabase.from("google_review_prompts").insert({ user_id: userId, shown_count: 1 }),
      supabase.from("enrollments").insert({ user_id: userId, course_slug: "dl-nlp" }),
      supabase.from("lesson_progress").insert({
        user_id: userId, course_slug: "dl-nlp", lesson_slug: "01-intro", status: "completed",
      }),
      supabase.from("quiz_attempts").insert({
        user_id: userId, course_slug: "dl-nlp", lesson_slug: "01-intro",
        quiz_id: "q1", correct: true,
      }),
    ]);
  });

  afterAll(async () => {
    // Only reached if the deletion test failed partway; the RPC is the happy path.
    await supabase.from("pending_terminations").delete().eq("event_id", eventId);
    const { data: user } = await supabase
      .from("users").select("id").eq("email", email).maybeSingle();
    if (user) await supabase.rpc("delete_user_account", { p_email: email });
  });

  it("erases every user-linked row in one call", async () => {
    const counts = await repo.deleteAccount(email);

    // Each seeded table reports exactly the row we planted.
    expect(counts).toMatchObject({
      pending_terminations: 1,
      zoom_sessions:        1,
      reviews:              1,
      bookings:             1,
      credit_packs:         1,
      payments:             1,
      audit_log:            1,
      failed_bookings:      1,
      subscriptions:        1,
      enrollments:          1,
      lesson_progress:      1,
      quiz_attempts:        1,
      google_review_prompts: 1,
    });

    const remaining = await Promise.all([
      supabase.from("users").select("id").eq("id", userId),
      supabase.from("credit_packs").select("id").eq("user_id", userId),
      supabase.from("bookings").select("id").eq("user_id", userId),
      supabase.from("payments").select("id").eq("user_id", userId),
      supabase.from("audit_log").select("id").eq("user_id", userId),
      supabase.from("failed_bookings").select("stripe_session_id").eq("user_id", userId),
      supabase.from("subscriptions").select("id").eq("user_id", userId),
      supabase.from("reviews").select("id").eq("user_id", userId),
      supabase.from("google_review_prompts").select("user_id").eq("user_id", userId),
      supabase.from("enrollments").select("id").eq("user_id", userId),
      supabase.from("lesson_progress").select("id").eq("user_id", userId),
      supabase.from("quiz_attempts").select("id").eq("user_id", userId),
      supabase.from("zoom_sessions").select("id").eq("booking_id", bookingId),
      // No FK backs this one — an orphan here would make the cleanup cron chase
      // a booking that no longer exists.
      supabase.from("pending_terminations").select("event_id").eq("event_id", eventId),
    ]);

    for (const { data, error } of remaining) {
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("throws UserNotFoundError for an account that is already gone", async () => {
    await expect(repo.deleteAccount(email)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it("normalises the email before looking the account up", async () => {
    const other = `test-deletion-case-${stamp}@example.com`;
    await repo.upsert(other, "Case Test");

    const counts = await repo.deleteAccount(`  ${other.toUpperCase()}  `);
    expect(counts.bookings).toBe(0);

    const { data } = await supabase.from("users").select("id").eq("email", other);
    expect(data).toEqual([]);
  });
});
