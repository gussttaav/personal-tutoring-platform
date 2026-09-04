-- Admin-editable commerce settings that belong with pricing but do not fit the
-- per-product `pricing` table (its product_key CHECK enum + amount_cents > 0 are
-- specific to the 4 priced products). This singleton row holds pricing-adjacent
-- policy values edited at /admin/pricing and surfaced via GET /api/pricing.
--
-- First setting: pack_validity_days — how long a purchased credit pack stays
-- redeemable. Previously hardcoded as PACK_VALIDITY_MONTHS = 6 in
-- src/constants/index.ts and applied at purchase time in SupabaseCreditsRepository
-- via addMonths(now, 6). Stored in DAYS (default 180) so the value is a single
-- clean integer for the mobile API; the purchase path computes
-- expires_at = now + pack_validity_days at insert time.
--
-- Write-once semantics are unchanged: each pack freezes its own expires_at at
-- purchase, so changing this setting only affects packs bought afterward.

CREATE TABLE pricing_settings (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pack_validity_days INTEGER NOT NULL DEFAULT 180 CHECK (pack_validity_days >= 1),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT
);

-- Seed settings (singleton). 180 days ≈ the previous 6-calendar-month rule.
INSERT INTO pricing_settings (id, pack_validity_days) VALUES (1, 180);

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the table denies everything if the anon key is ever used.
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_pricing_settings_select ON pricing_settings FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_pricing_settings_insert ON pricing_settings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_pricing_settings_update ON pricing_settings FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_pricing_settings_delete ON pricing_settings FOR DELETE TO anon USING (false);
