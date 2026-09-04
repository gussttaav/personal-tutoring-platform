-- SEC-RPC-01: revoke the default PUBLIC EXECUTE grant on the four RPCs that
-- predate the revoke convention introduced in 0017_delete_user_account.sql.
--
-- Postgres grants EXECUTE on every new function to PUBLIC, and PostgREST
-- exposes each one at /rest/v1/rpc/<name>. NEXT_PUBLIC_SUPABASE_ANON_KEY ships
-- to the browser (Realtime backs the payment-confirmation channel and the
-- in-session chat -- see src/lib/supabase-browser.ts), so until now anyone
-- holding that public key could invoke all four. Verified against the dev
-- project: anon POSTs to rpc/decrement_credit and rpc/restore_credit returned
-- HTTP 200, rpc/release_slot_lock returned 204.
--
-- Those calls were not exploitable, because none of these functions is
-- SECURITY DEFINER. A SECURITY INVOKER function runs its body with the
-- caller's privileges, so the deny-anon policies from 0007_rls_deny_anon.sql
-- apply *inside* the function: an anon decrement_credit against a seeded user
-- holding 3 credits selected no pack and returned {"ok": false}, leaving
-- credits_remaining at 3, and acquire_slot_lock failed with 42501 "new row
-- violates row-level security policy for table slot_locks". RLS was the only
-- thing stopping them.
--
-- Relying on that is exactly the failure mode 0007's own header warns about:
-- the next person who hits "RLS is denying my queries" inside one of these
-- functions and reaches for SECURITY DEFINER, or who adds a permissive policy
-- to credit_packs, silently turns decrement_credit into a credit-burn
-- primitive callable by anyone with the public key. The grant is the layer
-- that does not depend on getting the policies right.
--
-- Nothing in the app loses access: every backend caller goes through the
-- service-role client in src/infrastructure/supabase/client.ts
-- (SupabaseCreditsRepository, SupabaseBookingRepository).

REVOKE ALL ON FUNCTION decrement_credit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION decrement_credit(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_credit(UUID) TO service_role;

REVOKE ALL ON FUNCTION restore_credit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION restore_credit(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_credit(UUID) TO service_role;

REVOKE ALL ON FUNCTION acquire_slot_lock(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION acquire_slot_lock(TEXT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION acquire_slot_lock(TEXT, INT) TO service_role;

REVOKE ALL ON FUNCTION release_slot_lock(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_slot_lock(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION release_slot_lock(TEXT) TO service_role;

-- update_updated_at() is deliberately not listed: it RETURNS trigger, which
-- PostgREST does not expose as an RPC endpoint, and it is only ever reached
-- through the BEFORE UPDATE triggers declared in 0001.
