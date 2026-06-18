/**
 * e2e/fixtures/seed.ts
 *
 * Server-side test data seeding, used so a spec can exercise credit-gated UI
 * (book + cancel) without performing a live Stripe payment.
 *
 * Why: Stripe's PaymentElement is not localized by our app (we pass no locale
 * to Elements), so completing a live payment in BOTH locales adds no coverage
 * and trips a Stripe-side throttle on repeated Elements sessions in one run.
 * Only one locale per spec pays live; the other seeds credits here and still
 * covers the localized book + cancel flow.
 *
 * Runs server-side from Node (service-role key) — never imported into browser
 * assertions.
 */

import { createClient } from "@supabase/supabase-js";
import { loadMergedEnv, pick } from "./cleanup";

/**
 * Upserts the user and grants an active pack of `credits` credits (matching
 * what a completed Pack purchase would leave). Mirrors the columns the credits
 * query filters on: a future `expires_at` and `credits_remaining > 0`.
 */
export async function seedPackCredits(
  email: string,
  name = "E2E Test",
  credits = 5,
): Promise<void> {
  const env = loadMergedEnv();
  const supabaseUrl    = pick(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = pick(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("[e2e] seedPackCredits: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const normalized = email.toLowerCase().trim();

  const { data: user, error: userErr } = await supabase
    .from("users")
    .upsert({ email: normalized, name }, { onConflict: "email" })
    .select("id")
    .single();
  if (userErr) throw new Error(`[e2e] seedPackCredits user upsert failed: ${userErr.message}`);

  // ~6 months out, well within a pack's validity window.
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * 6).toISOString();

  const { error: packErr } = await supabase.from("credit_packs").insert({
    user_id:           user.id,
    pack_size:         credits >= 10 ? 10 : 5,
    credits_remaining: credits,
    // Unique idempotency key — namespaced so it can't collide with a real
    // Stripe payment id and is obvious in the DB as seeded test data.
    stripe_payment_id: `e2e-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expires_at:        expiresAt,
  });
  if (packErr) throw new Error(`[e2e] seedPackCredits credit_pack insert failed: ${packErr.message}`);
}
