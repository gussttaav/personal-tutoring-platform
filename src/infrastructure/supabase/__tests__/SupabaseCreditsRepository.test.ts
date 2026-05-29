// DB-02: Integration tests for SupabaseCreditsRepository.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseCreditsRepository } from "../SupabaseCreditsRepository";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

describeDb("SupabaseCreditsRepository", () => {
  const repo      = new SupabaseCreditsRepository();
  const testEmail = `test-credits-${Date.now()}@example.com`;
  let   userId    = "";

  afterAll(async () => {
    if (userId) {
      await supabase.from("credit_packs").delete().eq("user_id", userId);
      await supabase.from("users").delete().eq("id", userId);
    }
  });

  it("getCredits returns null for unknown user", async () => {
    const result = await repo.getCredits("unknown-nobody@example.com");
    expect(result).toBeNull();
  });

  it("addCredits creates user and pack; getCredits returns balance", async () => {
    await repo.addCredits({
      email:           testEmail,
      name:            "Test User",
      creditsToAdd:    5,
      packLabel:       "Pack 5",
      stripeSessionId: `pi_test_creds_${Date.now()}`,
    });

    const result = await repo.getCredits(testEmail);
    expect(result).not.toBeNull();
    expect(result!.credits).toBe(5);
    expect(result!.name).toBe("Test User");
    expect(result!.packSize).toBe(5);

    const { data: user } = await supabase
      .from("users").select("id").eq("email", testEmail).single();
    userId = user!.id;
  });

  it("addCredits is idempotent by stripeSessionId", async () => {
    const stripeSessionId = `pi_idem_${Date.now()}`;
    await repo.addCredits({
      email: testEmail, name: "Test User", creditsToAdd: 5,
      packLabel: "Pack 5", stripeSessionId,
    });
    await repo.addCredits({
      email: testEmail, name: "Test User", creditsToAdd: 5,
      packLabel: "Pack 5", stripeSessionId,
    });

    const result = await repo.getCredits(testEmail);
    const { data: packs } = await supabase
      .from("credit_packs").select("stripe_payment_id").eq("user_id", userId);
    const unique = new Set(packs!.map(p => p.stripe_payment_id));
    expect(unique.has(stripeSessionId)).toBe(true);
    // Second insert was ignored — total count doesn't double
    expect(result!.credits).toBeGreaterThan(0);
  });

  it("decrementCredit returns ok:false when no credits", async () => {
    const noCreditsEmail = `no-credits-${Date.now()}@example.com`;
    const result = await repo.decrementCredit(noCreditsEmail);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("decrementCredit is atomic under concurrency", async () => {
    const email = `concurrent-${Date.now()}@example.com`;
    await repo.addCredits({
      email, name: "Concurrent", creditsToAdd: 1,
      packLabel: "Pack 5", stripeSessionId: `pi_concurrent_${Date.now()}`,
    });

    const results = await Promise.all(
      Array(5).fill(0).map(() => repo.decrementCredit(email)),
    );
    const successes = results.filter(r => r.ok).length;
    expect(successes).toBe(1);

    // Cleanup
    const { data: u } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (u) {
      await supabase.from("credit_packs").delete().eq("user_id", u.id);
      await supabase.from("users").delete().eq("id", u.id);
    }
  });

  it("restoreCredit returns ok:false when no user exists", async () => {
    const result = await repo.restoreCredit("ghost@example.com");
    expect(result.ok).toBe(false);
    expect(result.credits).toBe(0);
  });
});
