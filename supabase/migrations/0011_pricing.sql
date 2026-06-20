-- Admin-editable pricing: single source of truth for session/pack prices.
--
-- Context: the app charges via Stripe PaymentIntents with a raw `amount` in
-- cents. The previous STRIPE_PRICE_ID_* env vars were used only to look up that
-- number — never as line_items — so we move the canonical amount into Postgres
-- and let the admin edit it. Stripe still records each charge's amount normally.
--
-- Only 4 rows ever exist. `free15min` is intentionally NOT a row (it's free and
-- stays hardcoded as price: null in the UI).

CREATE TABLE pricing (
  product_key           TEXT PRIMARY KEY
                          CHECK (product_key IN ('session1h','session2h','pack5','pack10')),
  amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0),
  original_amount_cents INTEGER CHECK (original_amount_cents IS NULL OR original_amount_cents >= amount_cents),
  currency              TEXT    NOT NULL DEFAULT 'eur',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            TEXT
);

-- Seed with the prices currently hardcoded in the app.
INSERT INTO pricing (product_key, amount_cents, original_amount_cents) VALUES
  ('session1h', 1600,  NULL),
  ('session2h', 3000,  NULL),
  ('pack5',     7500,  8000),
  ('pack10',    14000, 16000);

-- REFACTOR-P2-01 pattern: explicit deny-anon RLS (see 0007_rls_deny_anon.sql).
-- All DB access uses the service-role key, which bypasses RLS; this is
-- defense-in-depth so the table denies everything if the anon key is ever used.
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_pricing_select   ON pricing FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_pricing_insert   ON pricing FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_pricing_update   ON pricing FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_pricing_delete   ON pricing FOR DELETE TO anon USING (false);
