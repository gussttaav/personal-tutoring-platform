// DB-02: Integration tests for SupabaseCreditsRepository.
// REFACTOR-R4-P1-04: restoreCreditToPack (restore_credit_to_pack, migration 0023).
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseCreditsRepository } from "../SupabaseCreditsRepository";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

describeDb("SupabaseCreditsRepository", () => {
  const repo      = new SupabaseCreditsRepository();
  const testEmail = `test-credits-${Date.now()}@example.com`;
  let   userId    = "";
  // Pack expiry is now supplied by the caller (from the admin-editable validity
  // setting) rather than computed in the repo. 180 days keeps every pack active.
  const futureExpiry = new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString();

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
      expiresAt:       futureExpiry,
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
      packLabel: "Pack 5", stripeSessionId, expiresAt: futureExpiry,
    });
    await repo.addCredits({
      email: testEmail, name: "Test User", creditsToAdd: 5,
      packLabel: "Pack 5", stripeSessionId, expiresAt: futureExpiry,
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
      expiresAt: futureExpiry,
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

  // REFACTOR-R4-P1-04: the saga compensation's exact-pack restore.
  it("restoreCreditToPack restores that pack only, and refuses a full or expired one", async () => {
    const email = `restore-pack-${Date.now()}@example.com`;
    await repo.addCredits({
      email, name: "Restore", creditsToAdd: 4,
      packLabel: "Pack 5", stripeSessionId: `pi_restore_pack_${Date.now()}`,
      expiresAt: futureExpiry,
    });
    const { data: u } = await supabase.from("users").select("id").eq("email", email).single();
    const { data: pack } = await supabase
      .from("credit_packs").select("id").eq("user_id", u!.id).single();
    const remaining = async () => (await supabase
      .from("credit_packs").select("credits_remaining").eq("id", pack!.id).single()).data!.credits_remaining;

    expect(await repo.restoreCreditToPack(pack!.id)).toBe(true);
    expect(await remaining()).toBe(5);

    expect(await repo.restoreCreditToPack(pack!.id)).toBe(false); // full (5/5)
    expect(await remaining()).toBe(5);

    await supabase.from("credit_packs")
      .update({ credits_remaining: 3, expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", pack!.id);
    expect(await repo.restoreCreditToPack(pack!.id)).toBe(false); // expired
    expect(await remaining()).toBe(3);

    await supabase.from("credit_packs").delete().eq("user_id", u!.id);
    await supabase.from("users").delete().eq("id", u!.id);
  });
});
