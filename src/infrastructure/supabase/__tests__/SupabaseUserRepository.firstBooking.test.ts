// BOOKING-ATTRIBUTION-01: recordFirstBooking writes the first booking's type and source
// to the users row once (migration 0025), and never overwrites it.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseUserRepository } from "../SupabaseUserRepository";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

jest.setTimeout(20_000);

describeDb("SupabaseUserRepository.recordFirstBooking", () => {
  const repo  = new SupabaseUserRepository();
  const email = `test-first-booking-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  beforeAll(() => repo.upsert(email, "First Booking Test"));
  afterAll(async () => { await supabase.from("users").delete().eq("email", email); });

  it("writes once and keeps the first", async () => {
    const first = await repo.recordFirstBooking(email, {
      sessionType: "free15min",
      bookedAt:    "2026-10-03T10:00:00.000Z",
      attribution: {
        source: "linkedin", medium: "profile", campaign: "topcard",
        referrerHost: "linkedin.com", landingPath: "/mentoria",
      },
    });
    const second = await repo.recordFirstBooking(email, {
      sessionType: "session1h",
      bookedAt:    "2026-10-04T10:00:00.000Z",
      attribution: { source: "google" },
    });

    expect(first).toBe(true);
    expect(second).toBe(false);

    const { data, error } = await supabase
      .from("users")
      .select("first_booking_type, first_booked_at, utm_source, utm_medium, utm_campaign, referrer_host, landing_path")
      .eq("email", email)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      first_booking_type: "free15min",
      utm_source:         "linkedin",
      utm_medium:         "profile",
      utm_campaign:       "topcard",
      referrer_host:      "linkedin.com",
      landing_path:       "/mentoria",
    });
    expect(new Date(data!.first_booked_at!).toISOString()).toBe("2026-10-03T10:00:00.000Z");
  });

  it("is a no-op for an unknown user", async () => {
    await expect(repo.recordFirstBooking(`no-such-${email}`, {
      sessionType: "pack", bookedAt: new Date().toISOString(),
    })).resolves.toBe(false);
  });
});
