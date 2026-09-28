# P1-04 — Atomic cancel, credit back to the originating pack

**Tag:** `REFACTOR-R4-P1-04` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Cancelling a pack class has three problems:
- It gives the credit back to **whichever active pack expires first**, not the pack the class was
  paid from, even though `bookings.credit_pack_id` records that pack (`BOOKING-PACKLINK-01`).
- If no active pack has room (the originating pack expired), nothing is restored. The code returns
  0 silently, while the API, the `/cancelar` page and the confirmation email all say
  "credit restored".
- The status flip and the restore are two separate writes. A failed restore after the flip returns
  500, and the retry gets `CANCEL_TOKEN_CONSUMED`, so the credit is lost for good.

Replace both writes with one `cancel_booking` stored procedure that cancels and restores (to the
originating pack first) in a single transaction, and report `creditsRestored` from what it actually
did. The saga's "restore decremented credit" compensation also targets the exact pack it
decremented.

## Context

- `supabase/migrations/0001_complete_schema.sql:202-232`, `restore_credit(p_user_id)`: picks
  `WHERE credits_remaining < pack_size AND expires_at > now() ORDER BY expires_at ASC LIMIT 1`. No
  notion of which pack the booking used. Returns `ok:false` when none qualifies.
- `supabase/migrations/0015_decrement_credit_pack_id.sql`: `decrement_credit` returns the `pack_id`
  it decremented. `BookingService` persists it as `bookings.credit_pack_id` (`BookingService.ts:206-212`, `:247`).
- `src/services/CreditService.ts:84-95`: `restoreCredit` treats `ok:false` as success ("silently succeed with credits=0").
- `src/services/BookingService.ts:347-441`, `cancelByToken`:
  - `:367` `consumeCancelToken` (write 1)
  - `:406-408` `restoreCredit(record.email)` (write 2, separate, can throw after write 1)
  - `:377`, `:425`, `:440` `creditsRestored: isPack`, **asserted**, never checked
- `src/app/[locale]/cancelar/page.tsx:59`: `setCreditsBack(data.creditsRestored)` shows it to the student.
- `src/infrastructure/resend/email-functions.ts:264-290`: the email's "credit restored" paragraph keys off the same flag.
- `src/services/BookingService.ts:207-210`: the createBooking compensation restores by **email**, not by the `packId` it just decremented.
- How the originating pack expires first: `decrement_credit` only requires `expires_at > now()` *at
  booking time*. A class booked on day 170 of a 180-day pack for day 185 is valid, and cancelling it
  on day 182 finds its pack expired.

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0023_cancel_booking.sql` (new) | `cancel_booking(p_cancel_token)` + `restore_credit_to_pack(p_pack_id)`; REVOKE/GRANT per `0018` |
| `src/infrastructure/supabase/types.ts` | Regenerate (`supabase gen types …`) |
| `src/domain/repositories/IBookingRepository.ts` + `SupabaseBookingRepository.ts` | `cancelByToken(token): Promise<CancelResult>` wrapping the RPC |
| `src/domain/repositories/ICreditsRepository.ts` + `SupabaseCreditsRepository.ts` | `restoreCreditToPack(packId)` |
| `src/services/CreditService.ts` | `restoreCreditToPack(email, packId)` (RPC + audit); `recordRestore(email, …)` for the cancel path's audit entry |
| `src/services/BookingService.ts` | `cancelByToken` uses the repository RPC; `creditsRestored` from its result; compensation restores by `packId` |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts`, `InMemoryCreditsRepository.ts` | Fake `cancelByToken` (needs a handle on the credits fake), `restoreCreditToPack` |
| `src/services/__tests__/BookingService.test.ts`, `CreditService.test.ts`, `src/__tests__/integration/cancellation.test.ts` | New cases |

## The change

### Migration `0023_cancel_booking.sql`

```sql
-- REFACTOR-R4-P1-04: cancel + credit restore in ONE transaction, restoring to the pack
-- the class was paid from (bookings.credit_pack_id, BOOKING-PACKLINK-01) first.
--
-- Decision (Gustavo, see PLAN.md) — default implemented here:
--   1. originating pack, if still redeemable and not full
--   2. else the earliest-expiring active pack with room (the pre-0023 behaviour)
--   3. else nothing — and the result says so ('restored': false)

CREATE OR REPLACE FUNCTION restore_credit_to_pack(p_pack_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE credit_packs
  SET credits_remaining = credits_remaining + 1
  WHERE id = p_pack_id
    AND credits_remaining < pack_size
    AND expires_at > now();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cancel_booking(p_cancel_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_id      UUID;
  v_user    UUID;
  v_type    TEXT;
  v_pack    UUID;
  v_target  UUID;
  v_total   INT;
BEGIN
  UPDATE bookings
  SET status = 'cancelled', cancel_token = NULL, join_token = NULL
  WHERE cancel_token = p_cancel_token AND status = 'confirmed'
  RETURNING id, user_id, session_type, credit_pack_id
  INTO v_id, v_user, v_type, v_pack;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false);
  END IF;

  IF v_type = 'pack' THEN
    IF v_pack IS NOT NULL AND restore_credit_to_pack(v_pack) THEN
      v_target := v_pack;
    ELSE
      SELECT id INTO v_target
      FROM credit_packs
      WHERE user_id = v_user AND credits_remaining < pack_size AND expires_at > now()
      ORDER BY expires_at ASC
      LIMIT 1
      FOR UPDATE;
      IF v_target IS NOT NULL THEN
        UPDATE credit_packs SET credits_remaining = credits_remaining + 1 WHERE id = v_target;
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_total
  FROM credit_packs WHERE user_id = v_user AND expires_at > now();

  RETURN jsonb_build_object(
    'consumed',        true,
    'restored',        v_target IS NOT NULL,
    'restoredPackId',  v_target,
    'fromOriginating', v_target IS NOT NULL AND v_target = v_pack,
    'credits',         v_total
  );
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION restore_credit_to_pack(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION restore_credit_to_pack(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_credit_to_pack(UUID) TO service_role;

REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking(TEXT) TO service_role;
```

### Service

```ts
// BookingService.cancelByToken — replaces :366-373 and :405-408
// REFACTOR-R4-P1-04: one transaction for the status flip and the credit restore.
// findByCancelToken above still verifies the HMAC and feeds the window check.
const result = await this.bookings.cancelByToken(token);
if (!result.consumed) {
  throw new DomainError("Cancel token has already been consumed.", "CANCEL_TOKEN_CONSUMED");
}
const creditsRestored = isPack && result.restored;
if (creditsRestored) {
  await this.credits.recordRestore(record.email, { credits: result.credits, packId: result.restoredPackId });
} else if (isPack) {
  log("error", "Pack class cancelled but no credit could be restored (pack expired) — manual follow-up", {
    service: "BookingService", eventId: record.eventId,
  });
}
// ...calendar/zoom/pending cleanup unchanged, emails + return use `creditsRestored`
```

```ts
// createBooking compensation — restore the exact pack just decremented
compensations.push({
  description: "restore decremented credit",
  run: async () => {
    await (packId
      ? this.credits.restoreCreditToPack(input.email, packId)
      : this.credits.restoreCredit(input.email));
  },
});
```

## Acceptance criteria

- [ ] Cancel a pack class whose pack is active while another active pack expires **sooner** → the credit goes to the booking's own `credit_pack_id` pack
- [ ] Cancel a pack class whose pack **expired** → credit goes to the earliest-expiring active pack with room; with none, `creditsRestored: false` in the API response, on `/cancelar`, and in the email (no "credit restored" paragraph); an `error` log names the event
- [ ] Status flip and restore are one transaction: a forced RPC failure leaves the booking `confirmed` and the token usable
- [ ] Two concurrent cancels with the same token → exactly one `consumed: true`, exactly one credit restored
- [ ] Booking saga compensation after a pack decrement restores to the same `packId`
- [ ] Non-pack cancels behave exactly as before (`restored: false`, no credit writes)
- [ ] Migration applied to the **test** DB; `types.ts` regenerated; file-top blocks carry `REFACTOR-R4-P1-04`

## Test plan

- **Existing:** `BookingService.test.ts` cancel cases, `CreditService.test.ts`,
  `src/__tests__/integration/cancellation.test.ts`, and `e2e/cancellation.spec.ts` stay green.
  Update any mock of `restoreCredit` on the cancel path to `cancelByToken`.
- **New (DB-gated, `SupabaseBookingRepository.test.ts`):** seed two packs (A expires in 180 days
  and is the booking's pack; B expires in 10 days with room). Cancel → A incremented, B untouched.
  Expire A (update `expires_at`) → cancel another → B incremented, `fromOriginating: false`. Fill B →
  cancel → `restored: false`.
- **New (DB-gated):** concurrent `Promise.all([cancelByToken(t), cancelByToken(t)])` → one consumed.
- **New (service):** fake `cancelByToken` returning `restored: false` for a pack booking →
  `creditsRestored: false` and the email client received `creditsRestored: false`.

## Notes / gotchas

- **Decision (Gustavo): expired originating pack.** The default falls back to the old
  earliest-expiring rule, then to "not restored". Alternatives:
  - extend the originating pack's `expires_at` by the class's remaining validity
  - always restore into the originating pack even if expired, which is pointless because it can't be redeemed

  Record it in STATUS.md.
- **The HMAC check stays in the app.** `cancel_booking` trusts the token it's given. Keep calling
  `findByCancelToken` first (HMAC + window check), then the RPC. Don't skip the lookup "because the
  RPC matches on the token anyway": the lookup is what verifies authenticity.
- **Audit.** The old `CreditService.restoreCredit` appended `{ action: "restore" }`. The RPC can't.
  `recordRestore` keeps the audit trail identical.
- **In-memory fakes cross repositories now.** `InMemoryBookingRepository.cancelByToken` must
  increment the fake credits. Construct it with a reference to `InMemoryCreditsRepository`, or pass
  a restore callback. Keep that coupling inside `src/__tests__/fixtures/`.
- `restore_credit(UUID)` stays in the schema. After this task its only caller is the `packId`-less
  compensation fallback. Dropping it is a later cleanup.
- After P1-03, reschedules no longer restore credits at all (pack link transfer), so this task only
  concerns cancellation and the saga compensation.
- Regenerating `types.ts` needs the project ref. Point it at the **test** project first. `supabase
  db push` targets production (see PLAN.md working notes).

## Out of scope

- Account deletion's eligibility rules (unchanged: redeemable credits still block deletion).
- Admin manual credit adjustments (P3-02).
- Dropping `restore_credit(UUID)`.
- Refunds for paid single sessions (manual, via the tutor, unchanged).
