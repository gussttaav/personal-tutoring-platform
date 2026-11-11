# P2-02 — Cancel and reschedule tell the truth about credits and payments

**Tag:** `REFACTOR-R5-P2-02` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

A booking becomes `cancelled` for three different reasons, and the database doesn't record which:
1. The student cancelled, and the credit came back (or there was nothing to return).
2. The student cancelled a pack class, but **no credit could be restored**: the originating pack
   expired and no other active pack had room (`REFACTOR-R4-P1-04`'s `ELSE` branch).
3. It was the original of a **reschedule**: its credit or payment moved to the new booking.

Everything downstream guesses:
- The cancellation email shows «Si pagaste por esta sesión individualmente, Gustavo tramitará el
  reembolso…» for case 2, which is a pack class. It also shows it for a free call.
- History reads «crédito devuelto» for every cancelled pack class (cases 2 and 3 are wrong).
- A rescheduled paid class shows its price on both rows (the known R4-P1-03 regression).

Persist the outcome on the row (migration `0030`), and let the email and history read it.
*(Deferred from R4: both "pack class whose credit could not be restored" and "deduplicate the
price of a rescheduled paid class".)*

## Context

- `supabase/migrations/0023_cancel_booking.sql:42-93`: `cancel_booking` computes `v_target`
  (`restored = v_target IS NOT NULL`) and returns it, but writes nothing about it to `bookings`.
- `src/services/BookingService.ts:502-513`: `creditsRestored = isPack && result.restored`; the "nothing restored" branch logs `error`.
- `src/services/BookingService.ts:557-565`: `sendCancellationConfirmation({ creditsRestored, … })`, without the session type.
- `src/infrastructure/resend/email-functions.ts:271-305`: `creditsRestored ? creditsRestoredMsg : refundMsg`.
- `messages/es.json:2141-2142` (and `en.json`, same keys): `emails.cancellation.creditsRestoredMsg` / `refundMsg`.
- `src/services/BookingService.ts:265`: the reschedule claim calls `consumeCancelToken`, the same method the new booking's compensation uses (`:360`).
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:159-174`: `consumeCancelToken` (status → `cancelled`, tokens nulled).
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:199`: `reinstateBooking`, the reschedule compensation (back to `confirmed`).
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:287`: `listHistoryByUser` select (no outcome columns).
- `src/infrastructure/supabase/booking-history.ts:58-80`: `deriveAmount`, which gives the full price to every row sharing a `stripe_payment_id`.
- `src/features/personal-area/history-stats.ts:121-153`: `paymentLabel`, where every cancelled pack class reads `payCreditRefunded`.
- `src/domain/types.ts:117-129`: `BookingHistoryEntry` (also served to the mobile app by the history endpoint).

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0030_booking_cancel_outcome.sql` (new) | `bookings.credit_restored BOOLEAN` (NULL = n/a or legacy), `bookings.rescheduled BOOLEAN NOT NULL DEFAULT false`; `cancel_booking` re-declared to write `credit_restored` for pack rows; REVOKE/GRANT repeated |
| `src/infrastructure/supabase/types.ts` | Regenerated |
| `src/domain/repositories/IBookingRepository.ts` | New `claimForReschedule(token): Promise<boolean>` (or a `{ rescheduled: true }` option on `consumeCancelToken`) |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | `claimForReschedule` sets `rescheduled = true`; `reinstateBooking` resets it to `false`; `listHistoryByUser` selects both columns |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts` | Same three behaviours |
| `src/services/BookingService.ts` | The claim uses `claimForReschedule`; the cancel email gets `sessionType` |
| `src/infrastructure/resend/email-functions.ts` (+ `IEmailClient` param type) | Three-way message: credit returned / pack but no credit / paid-single refund line; no money line for a free call |
| `src/infrastructure/supabase/booking-history.ts` | `deriveAmount`: a `rescheduled` original of a paid class → no amount |
| `src/domain/types.ts` | `BookingHistoryEntry.creditRestored?: boolean \| null`, `rescheduled?: boolean` (additive) |
| `src/features/personal-area/history-stats.ts` | `paymentLabel` reads them (new label keys) |
| `messages/es.json`, `messages/en.json` | `areaPersonal.history.payCreditMoved`, `payCreditNotRestored`, `payRescheduled`; `emails.cancellation.noCreditRestoredMsg` |
| Tests | see Test plan |

## The change

```sql
-- 0030_booking_cancel_outcome.sql
-- REFACTOR-R5-P2-02: record WHY a booking is cancelled, so the email and the history
-- stop guessing. credit_restored: pack rows only (true/false), NULL otherwise and for rows
-- cancelled before this migration. rescheduled: the original of a reschedule.
ALTER TABLE bookings ADD COLUMN credit_restored BOOLEAN;
ALTER TABLE bookings ADD COLUMN rescheduled     BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION cancel_booking(p_cancel_token TEXT) RETURNS JSONB AS $$
  -- body = 0023 verbatim, plus, after the credit branch:
  --   IF v_type = 'pack' THEN
  --     UPDATE bookings SET credit_restored = (v_target IS NOT NULL) WHERE id = v_id;
  --   END IF;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_booking(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking(TEXT) TO service_role;
```

(Copy 0023's body verbatim and add the one `UPDATE`. Don't restructure the function.)

History label (`paymentLabel`), in order:

```ts
// REFACTOR-R5-P2-02: the row now says what happened; NULL / missing = a legacy row → old reading.
if (paidWithCredit) {
  if (entry.status !== "cancelled")        return { key: "payCredit" };
  if (entry.rescheduled)                   return { key: "payCreditMoved" };
  if (entry.creditRestored === false)      return { key: "payCreditNotRestored" };
  return { key: "payCreditRefunded" };
}
if (entry.rescheduled && entry.status === "cancelled") return { key: "payRescheduled" };
// … card amount / free as today
```

`deriveAmount` gets the row's `rescheduled` flag. A rescheduled original returns `none`, so the
price appears once, on the booking that's going ahead. The money totals in `history-stats`
then stop double-counting as well. Check whatever sums `amountCents` there.

Email (`sendCancellationConfirmationEmail`): add `sessionType`.
- pack + restored → `creditsRestoredMsg` (today)
- pack + not restored → `noCreditRestoredMsg`
- session1h / session2h → `refundMsg` (today)
- free15min → no money line

Copy (proposed; Gustavo may reword):
| Key | es | en |
|-----|----|----|
| `history.payCreditMoved` | crédito pasado a la nueva clase | credit moved to the new class |
| `history.payCreditNotRestored` | crédito no devuelto | credit not returned |
| `history.payRescheduled` | pagada en la clase reprogramada | paid on the rescheduled class |
| `emails.cancellation.noCreditRestoredMsg` | No hemos podido devolver el crédito a un pack activo (el pack de esta clase ha caducado). Escríbeme a contacto@gustavoai.dev y lo resolvemos. | We couldn't return the credit to an active pack (this class's pack has expired). Write to me at contacto@gustavoai.dev and we'll sort it out. |

## Acceptance criteria

- [ ] `0030` on the test DB; `types.ts` regenerated; `delete_user_account` unaffected (columns only)
- [ ] Cancelling a pack class with room in its pack → `credit_restored = true`; with no active pack with room → `false`; a non-pack cancel leaves it `NULL`
- [ ] A successful reschedule leaves the original `cancelled` + `rescheduled = true`; a failed reschedule's reinstate leaves it `confirmed` + `rescheduled = false`
- [ ] The new booking's own compensation (`consumeCancelToken` at `BookingService.ts:360`) does **not** set `rescheduled`
- [ ] History: the four pack readings and the paid reschedule reading render as specified; rows cancelled before `0030` read exactly as today
- [ ] A rescheduled paid class: amount on the new row only
- [ ] Email: four cases as specified (verify the HTML once with the scratch `tsx` renderer, see PLAN → Working notes)
- [ ] `pnpm check:messages` green; file-top blocks + migration header carry `REFACTOR-R5-P2-02`

## Test plan

- **Existing:** `BookingService.test.ts` (cancel, reschedule, compensation), `src/__tests__/integration/cancellation.test.ts` and `reschedule.test.ts`, `history-stats` tests, `booking-history` tests, the DB-gated `cancel_booking` RPC tests from R4-P1-04.
- **New (DB-gated, RPC):** pack cancel with an expired originating pack and no other → `credit_restored = false`; with room → `true`; `session1h` cancel → `NULL`.
- **New (DB-gated, repo):** `claimForReschedule` → `rescheduled = true`; `reinstateBooking` → `false`.
- **New (service):** reschedule calls `claimForReschedule`, not `consumeCancelToken`; the cancel email is called with `sessionType`.
- **New (unit):** `paymentLabel` table test covering all branches including legacy (`creditRestored` undefined, `rescheduled` undefined); `deriveAmount` with a rescheduled paid original → `none`.
- **New (email, mocked `send`):** four cases → the right message key in the HTML (or mock `getTranslations` and assert the keys asked for).

## Notes / gotchas

- **`supabase db push` hits production.** Apply `0030` to the test DB with `--project-ref`, regenerate types from the test DB, and add it to STATUS → Production steps.
- **`cancel_booking` is re-declared.** `CREATE OR REPLACE` keeps grants in Postgres, but repeat the
  REVOKE/GRANT anyway (the `0021`/`0022` precedent for `delete_user_account`).
- **No backfill.** Legacy cancelled rows keep `credit_restored NULL` and `rescheduled false`, and read
  as today. A rescheduled original from before `0030` still reads «crédito devuelto» or shows its
  price. Inferring it (another booking sharing `stripe_payment_id` / `credit_pack_id`) is possible,
  but it's a guess. Leave it.
- **Mobile app:** the history fields are additive and optional. It keeps showing its own labels until it reads them.
- `BookingService` still logs `error` for "pack cancelled, nothing restored". Keep it: it's the manual follow-up signal.
- The admin-side views (`/admin/students/<email>` history) read the same entries, so check they render the new keys or fall back sensibly.

## Out of scope

- Automatically issuing a credit or refund when nothing could be restored (policy, confirmed 2026-10-01).
- A `rescheduled` status value (would ripple through the CHECK, the exclusion constraint, `hasActiveFreeSession` and every status filter).
- Backfilling legacy rows.
