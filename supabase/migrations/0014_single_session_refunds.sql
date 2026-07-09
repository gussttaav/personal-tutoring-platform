-- SINGLE-SESSION-CONFIRM-01: queryable record of single-session payments that were
-- refunded because the slot was taken during async booking. Backs the `slot_taken`
-- polling status and makes the refund path idempotent. Keyed by Stripe PaymentIntent id.
CREATE TABLE single_session_refunds (
  stripe_payment_id TEXT PRIMARY KEY,                 -- pi_… ; same key the client polls by
  reason            TEXT        NOT NULL DEFAULT 'slot_taken',
  refunded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE single_session_refunds ENABLE ROW LEVEL SECURITY;

-- Deny-anon, per the 0007 pattern (service-role backend bypasses RLS; anon denied).
CREATE POLICY deny_anon_single_session_refunds_select ON single_session_refunds FOR SELECT TO anon USING (false);
CREATE POLICY deny_anon_single_session_refunds_insert ON single_session_refunds FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY deny_anon_single_session_refunds_update ON single_session_refunds FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY deny_anon_single_session_refunds_delete ON single_session_refunds FOR DELETE TO anon USING (false);
