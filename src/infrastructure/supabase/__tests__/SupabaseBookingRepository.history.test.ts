// BOOKING-HISTORY-01: integration tests for listHistoryByUser.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
//
// These exercise what the unit tests over booking-history.ts cannot: the actual
// keyset predicate against Postgres, the past-only filter, and the three bulk
// joins (reviews, credit_packs, payments). Rows are inserted directly rather than
// through createBooking so the test can control status and place bookings in the past.
import { SupabaseBookingRepository } from "../SupabaseBookingRepository";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;

// A far-past base, randomised per file so parallel test files never collide.
const PAST_BASE = Date.now() - (400 + Math.floor(Math.random() * 3000)) * DAY_MS;
const pastSlot = (n: number) => {
  const start = PAST_BASE + n * 2 * HOUR_MS;
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(start + HOUR_MS).toISOString() };
};

describeDb("SupabaseBookingRepository.listHistoryByUser", () => {
  const repo  = new SupabaseBookingRepository();
  const email = `test-history-${Date.now()}@example.com`;
  let userId  = "";

  async function purge() {
    const { data: user } = await supabase
      .from("users").select("id").eq("email", email).maybeSingle();
    if (!user) return;
    // reviews cascade off bookings; credit_packs/payments must go before users.
    await supabase.from("bookings").delete().eq("user_id", user.id);
    await supabase.from("credit_packs").delete().eq("user_id", user.id);
    await supabase.from("payments").delete().eq("user_id", user.id);
    await supabase.from("users").delete().eq("id", user.id);
  }

  beforeAll(async () => {
    await purge();
    const { data: user, error } = await supabase
      .from("users").insert({ email, name: "History Student" }).select("id").single();
    if (error) throw error;
    userId = user.id;
  });

  afterAll(purge);

  it("returns an empty page for a user with no bookings", async () => {
    const page = await repo.listHistoryByUser("nobody-history@example.com", { limit: 10 });
    expect(page).toEqual({ entries: [], nextCursor: null });
  });

  it("excludes future bookings, includes every status, and orders newest first", async () => {
    const past    = pastSlot(0);
    const alsoPast = pastSlot(1);
    const future  = {
      startsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
      endsAt:   new Date(Date.now() + 30 * DAY_MS + HOUR_MS).toISOString(),
    };

    const { error } = await supabase.from("bookings").insert([
      { user_id: userId, session_type: "session1h", status: "completed", calendar_event_id: "evt-h1", ...toCols(past) },
      { user_id: userId, session_type: "session1h", status: "no_show",   calendar_event_id: "evt-h2", ...toCols(alsoPast) },
      { user_id: userId, session_type: "session1h", status: "confirmed", calendar_event_id: "evt-h3", ...toCols(future) },
    ]);
    if (error) throw error;

    const { entries, nextCursor } = await repo.listHistoryByUser(email, { limit: 10 });

    expect(entries.map(e => e.eventId)).toEqual(["evt-h2", "evt-h1"]); // newest first
    expect(entries.map(e => e.status)).toEqual(["no_show", "completed"]); // no_show is not hidden
    expect(nextCursor).toBeNull();

    await supabase.from("bookings").delete().eq("user_id", userId);
  });

  it("never emits cancel or join tokens", async () => {
    const { error } = await supabase.from("bookings").insert({
      user_id: userId, session_type: "session1h", status: "completed",
      calendar_event_id: "evt-tok", cancel_token: "c".repeat(64), join_token: "j".repeat(64),
      ...toCols(pastSlot(2)),
    });
    if (error) throw error;

    const { entries } = await repo.listHistoryByUser(email, { limit: 10 });
    const serialized  = JSON.stringify(entries);

    expect(serialized).not.toContain("c".repeat(64));
    expect(serialized).not.toContain("j".repeat(64));

    await supabase.from("bookings").delete().eq("user_id", userId);
  });

  // The regression the composite cursor exists to prevent. bookings_no_overlap is
  // scoped `WHERE (status = 'confirmed')`, so a cancelled booking and the confirmed
  // one that replaced it legitimately share a starts_at. A cursor keyed on starts_at
  // alone would skip one of them at the page boundary.
  it("does not skip rows that share an identical starts_at when paging", async () => {
    const slot = pastSlot(3);

    const { error } = await supabase.from("bookings").insert([
      { user_id: userId, session_type: "session1h", status: "cancelled", calendar_event_id: "evt-dup-a", ...toCols(slot) },
      { user_id: userId, session_type: "session1h", status: "confirmed", calendar_event_id: "evt-dup-b", ...toCols(slot) },
    ]);
    if (error) throw error;

    // Page one row at a time — the boundary falls exactly between the twins.
    const seen: string[] = [];
    let cursor: string | undefined = undefined;

    for (let i = 0; i < 5; i++) {
      const page: Awaited<ReturnType<typeof repo.listHistoryByUser>> =
        await repo.listHistoryByUser(email, { limit: 1, cursor });
      seen.push(...page.entries.map(e => e.eventId));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(seen.sort()).toEqual(["evt-dup-a", "evt-dup-b"]);
    expect(new Set(seen).size).toBe(2); // no duplicates either

    await supabase.from("bookings").delete().eq("user_id", userId);
  });

  it("rejects a malformed cursor instead of restarting from page one", async () => {
    await expect(repo.listHistoryByUser(email, { limit: 5, cursor: "garbage" }))
      .rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });

  it("joins the review and derives the per-class price for a pack booking", async () => {
    // €300 pack of 10 → €30 for this one class.
    const stripeId = `pi_pack_${Date.now()}`;
    await supabase.from("payments").insert({
      user_id: userId, stripe_payment_id: stripeId,
      amount_cents: 30000, currency: "eur", checkout_type: "pack", status: "succeeded",
    });
    const { data: pack } = await supabase.from("credit_packs").insert({
      user_id: userId, pack_size: 10, credits_remaining: 9, stripe_payment_id: stripeId,
      expires_at: new Date(Date.now() + 90 * DAY_MS).toISOString(),
    }).select("id").single();

    const { data: booking } = await supabase.from("bookings").insert({
      user_id: userId, session_type: "pack", status: "completed",
      calendar_event_id: "evt-pack", credit_pack_id: pack!.id, note: "Repasar hooks",
      ...toCols(pastSlot(4)),
    }).select("id").single();

    await supabase.from("reviews").insert({
      booking_id: booking!.id, user_id: userId, rating: 5, comment: "Genial",
    });

    const { entries } = await repo.listHistoryByUser(email, { limit: 10 });
    const entry = entries.find(e => e.eventId === "evt-pack")!;

    expect(entry.amountCents).toBe(3000);
    expect(entry.currency).toBe("eur");
    expect(entry.packSize).toBe(10);
    expect(entry.note).toBe("Repasar hooks");
    expect(entry.review).toEqual({ rating: 5, comment: "Genial" });

    await supabase.from("bookings").delete().eq("user_id", userId);
    await supabase.from("credit_packs").delete().eq("user_id", userId);
    await supabase.from("payments").delete().eq("user_id", userId);
  });

  it("reports a free class as unpriced and an unreviewed class as unreviewed", async () => {
    const { error } = await supabase.from("bookings").insert({
      user_id: userId, session_type: "free15min", status: "completed",
      calendar_event_id: "evt-free", ...toCols(pastSlot(5)),
    });
    if (error) throw error;

    const { entries } = await repo.listHistoryByUser(email, { limit: 10 });
    const entry = entries.find(e => e.eventId === "evt-free")!;

    expect(entry.amountCents).toBeNull();
    expect(entry.currency).toBeNull();
    expect(entry.review).toBeNull();
    expect(entry.note).toBeNull();

    await supabase.from("bookings").delete().eq("user_id", userId);
  });
});

function toCols(slot: { startsAt: string; endsAt: string }) {
  return { starts_at: slot.startsAt, ends_at: slot.endsAt };
}
