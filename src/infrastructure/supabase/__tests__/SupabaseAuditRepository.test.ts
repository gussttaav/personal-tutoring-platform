// DB-02: Integration tests for SupabaseAuditRepository.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseAuditRepository } from "../SupabaseAuditRepository";
import { supabase } from "../client";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

describeDb("SupabaseAuditRepository", () => {
  const repo      = new SupabaseAuditRepository();
  const testEmail = `test-audit-${Date.now()}@example.com`;

  afterAll(async () => {
    const { data: user } = await supabase
      .from("users").select("id").eq("email", testEmail).maybeSingle();
    if (user) {
      await supabase.from("audit_log").delete().eq("user_id", user.id);
      await supabase.from("users").delete().eq("id", user.id);
    }
  });

  it("list returns empty array for unknown user", async () => {
    const entries = await repo.list("nobody-audit@example.com");
    expect(entries).toEqual([]);
  });

  it("append + list round-trip preserves action and extra fields", async () => {
    await repo.append(testEmail, {
      action: "purchase",
      creditsAdded: 5,
      stripeSessionId: "pi_audit_test",
    });

    const entries = await repo.list(testEmail);
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const entry = entries[0];
    expect(entry.action).toBe("purchase");
    expect(entry.ts).toBeDefined();
    expect((entry as Record<string, unknown>).creditsAdded).toBe(5);
  });

  it("list respects limit parameter", async () => {
    await repo.append(testEmail, { action: "decrement" });
    await repo.append(testEmail, { action: "restore" });

    const limited = await repo.list(testEmail, 1);
    expect(limited).toHaveLength(1);
  });
});
