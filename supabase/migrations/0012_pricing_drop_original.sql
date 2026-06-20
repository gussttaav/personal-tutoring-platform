-- The pack "original price" (strikethrough) is fully derived: it's the 1-hour
-- session price × the pack's hours (e.g. 5h pack original = 16 € × 5 = 80 €).
-- Storing it was redundant and let it drift from the session price, so the
-- column is dropped — the value is now computed in src/lib/pricing-display.ts.
ALTER TABLE pricing DROP COLUMN IF EXISTS original_amount_cents;
