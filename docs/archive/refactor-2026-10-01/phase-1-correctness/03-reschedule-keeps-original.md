# P1-03 — Reschedule keeps the original booking until the new one commits

**Tag:** `REFACTOR-R4-P1-03` · **Severity:** 🟠 · **Effort:** M · **Owner:** Claude · **Status:** ✅

## TL;DR

`createBooking`'s reschedule branch consumes the old cancel token, deletes the old calendar event,
Zoom session and pending termination, and (for packs) restores the credit, **before** the new
booking exists. Its compensation is an empty function. If anything later throws (a Calendar
error, the exclusion constraint, the Zoom session insert), the student is left with **neither**
booking. The retry cycle 2 counted on fails with `RESCHEDULE_TOKEN_CONSUMED`. For a paid 1h/2h
class, that's a paid class gone with no refund path except an email to the tutor.

Reorder it:
1. Claim the old booking.
2. Create the new booking.
3. Tear the old booking down only after the new one has committed.

Give the claim a real compensation (reinstate the old row). While here, stop shuffling pack
credits (move the old booking's pack link to the new one) and carry a paid class's
`stripe_payment_id` over.

## Context

- `src/services/BookingService.ts:142-196`, the reschedule branch:
  - `:168` `consumeCancelToken(rescheduleToken)`, which sets status `cancelled` and nulls both tokens (`SupabaseBookingRepository.ts:144-159`)
  - `:177-180` compensation `"restore old cancel token"` with body `/* partial: reschedule rollback is best-effort only */`
  - `:182-190` deletes the old calendar event, Zoom session and `pending_terminations` row, **before** step 5
  - `:193-195` pack: `restoreCredit(email)`, then step 4 (`:201-213`) `useCredit(email)`
- `src/services/BookingService.ts:217-253`: calendar insert and booking insert, both after the old booking is already gone. The insert is where the `bookings_no_overlap` exclusion constraint fires on a race.
- `docs/archive/refactor-2026-05-31/phase-1-correctness/03-booking-saga-compensation.md:279`: the
  accepted limitation: "*the user will get a clear error to retry*". They get `RESCHEDULE_TOKEN_CONSUMED`
  (`BookingService.ts:168-174`) on every retry.
- Tokens are deterministic: `SupabaseBookingRepository.ts:41-44` signs
  `${eventId}:${email}:${startsAt}` (cancel) and `join:` + that (join) with `CANCEL_SECRET`. So a
  reinstated row can get back **exactly** its original tokens, and the links in the student's
  original confirmation email keep working.
- `findByCancelToken` (`SupabaseBookingRepository.ts:64-107`) selects `credit_pack_id` but doesn't
  return it, and doesn't select `stripe_payment_id` at all.
- `/api/book` reschedules paid sessions without a `stripePaymentId` (`route.ts:32-36`), so the new
  booking loses its link to the payment. History shows no price, and the mobile poll by PaymentIntent
  finds nothing confirmed.

## Files affected

| File | Change |
|------|--------|
| `src/services/BookingService.ts` | Reorder the reschedule: claim → new booking → old teardown; real compensation; pack link transfer; carry `stripePaymentId` |
| `src/domain/repositories/IBookingRepository.ts` | `reinstateBooking(record)`; `findByCancelToken` doc: returns `creditPackId` + `stripePaymentId` |
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | Implement `reinstateBooking`; `findByCancelToken` selects/returns `stripe_payment_id` and `credit_pack_id` |
| `src/__tests__/fixtures/InMemoryBookingRepository.ts` | `reinstateBooking`; carry the two new fields |
| `src/services/__tests__/BookingService.test.ts`, `src/__tests__/integration/reschedule.test.ts` | Failure-after-claim cases |

## The change

### Repository

```ts
// IBookingRepository
/**
 * REFACTOR-R4-P1-03: undo a reschedule's claim. Flips the row identified by `eventId`
 * from 'cancelled' back to 'confirmed' and restores its ORIGINAL cancel/join tokens
 * (they are HMACs of eventId:email:startsAt, so they can be recomputed). Returns false
 * if the row is not in 'cancelled' — or if the exclusion constraint now rejects it
 * because another booking took the slot in the meantime.
 */
reinstateBooking(record: BookingRecord): Promise<boolean>;
```

```ts
// SupabaseBookingRepository
async reinstateBooking(record: BookingRecord): Promise<boolean> {
  const startsAt      = new Date(record.startsAt).toISOString();   // TIMESTAMPTZ gotcha
  const cancelPayload = `${record.eventId}:${record.email}:${startsAt}`;
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", cancel_token: signToken(cancelPayload), join_token: signToken(`join:${cancelPayload}`) })
    .eq("calendar_event_id", record.eventId)
    .eq("status", "cancelled")
    .select("id")
    .maybeSingle();
  if (error?.code === "23P01") return false;   // exclusion_violation: slot re-taken
  if (error) throw error;
  return data !== null;
}
```

`findByCancelToken` adds `stripe_payment_id` to its select and returns
`creditPackId: booking.credit_pack_id ?? undefined` and
`stripePaymentId: booking.stripe_payment_id ?? undefined` (both already on `BookingRecord`).

### Service: new order (sketch)

```ts
// REFACTOR-R4-P1-03: the original booking is CLAIMED first (so the exclusion constraint
// lets an overlapping new slot in) but torn down only AFTER the new booking commits.
// Until then the claim has a real compensation: reinstate the row with its original tokens.
let oldRecord: BookingRecord | null = null;
if (input.rescheduleToken) {
  oldRecord = await this.bookings.findByCancelToken(input.rescheduleToken);
  // window + session-type checks (unchanged, :152-166)
  if (!(await this.bookings.consumeCancelToken(input.rescheduleToken))) throw /* RESCHEDULE_TOKEN_CONSUMED */;
  const claimed = oldRecord;
  compensations.push({
    description: `reinstate original booking ${claimed.eventId}`,
    run: async () => {
      if (!(await this.bookings.reinstateBooking(claimed))) {
        throw new Error("original booking could not be reinstated (slot re-taken?)");
      }
    },
  });
}

// Step 4: credits. A pack RESCHEDULE moves the original's credit to the new booking:
// no decrement, no restore, balance unchanged.
if (input.sessionType === "pack") {
  if (oldRecord) {
    creditPackId     = oldRecord.creditPackId;
    packSizeForToken = oldRecord.packSize;
  } else {
    /* existing useCredit + compensation */
  }
}

// Steps 5-8 unchanged (calendar event, booking row, pending termination, zoom session),
// except the booking row also carries the original payment link:
//   ...(input.stripePaymentId ?? oldRecord?.stripePaymentId
//        ? { stripePaymentId: input.stripePaymentId ?? oldRecord!.stripePaymentId } : {})

// NEW step 8b — only now that the new booking and its Zoom session exist:
if (oldRecord) {
  await this.teardownRescheduledOriginal(oldRecord);   // best-effort, logs, never throws
}
// Step 9 emails unchanged.
```

```ts
// Best-effort by design: once the new booking exists we never roll it back because the
// old event could not be deleted — a stray calendar event is the lesser failure.
private async teardownRescheduledOriginal(old: BookingRecord): Promise<void> {
  for (const [what, fn] of [
    ["calendar event",       () => this.calendar.deleteEvent(old.eventId)],
    ["zoom session",         () => this.sessions.deleteByEventId(old.eventId)],
    ["pending termination",  () => this.bookings.deletePendingTermination(old.eventId)],
  ] as const) {
    try { await fn(); } catch (err) {
      log("warn", `Reschedule: could not delete original ${what}`, {
        service: "BookingService", eventId: old.eventId, error: String(err),
      });
    }
  }
  await invalidateAvailability(old.startsAt.slice(0, 10)).catch(() => {});
}
```

The `restoreCredit` call at `:193-195` is removed. Pack reschedules no longer touch credits.

## Acceptance criteria

- [ ] A failure **after** the claim (calendar insert throws; booking insert throws, including an exclusion violation; zoom session insert throws) → the original booking is `confirmed` again with its **original** cancel and join tokens; its calendar event, Zoom session and pending termination were never deleted
- [ ] The student can retry the same reschedule link after such a failure and succeed
- [ ] Successful reschedule → original row `cancelled` with null tokens, its calendar event / Zoom session / pending termination deleted, new booking `confirmed`
- [ ] Pack reschedule: `credit_packs.credits_remaining` unchanged; new booking's `credit_pack_id` = the original's; no `decrement`/`restore` audit rows
- [ ] Paid (`session1h`/`session2h`) reschedule: new booking carries the original `stripe_payment_id`; `findByStripePaymentId` returns the **new** booking
- [ ] Compensation failure (reinstate returns false) is logged at `error` with the event id ("manual intervention") and the original error is still thrown
- [ ] File-top comment block carries `REFACTOR-R4-P1-03`

## Test plan

- **Existing:** `BookingService.test.ts` reschedule cases and `src/__tests__/integration/reschedule.test.ts`
  stay green after updating them for the new order. Any assertion that `restoreCredit`/`useCredit`
  ran on a pack reschedule must flip.
- **New (service):** with `FakeCalendarClient.createEventShouldFail = true`, reschedule rejects,
  `InMemoryBookingRepository` shows the original `confirmed` with its original tokens, and
  `FakeCalendarClient.deletedEventIds` does **not** contain the original event.
- **New (service):** the booking insert throws (in-memory repo flag) → same assertions; the new calendar event was deleted by compensation.
- **New (service):** pack reschedule leaves the in-memory credit balance unchanged; paid reschedule copies `stripePaymentId`.
- **New (DB-gated):** `SupabaseBookingRepository.test.ts`: consume → `reinstateBooking` → `findByCancelToken(originalToken)` finds it again; reinstating onto an overlapping confirmed booking returns `false`.
- **e2e:** `reschedule.spec.ts` green (after P1-01's seeding fix).

## Notes / gotchas

- **Ordering vs. the exclusion constraint.** The claim must happen *before* the new insert. With the
  old row still `confirmed`, a reschedule to an overlapping slot (e.g. 30 minutes later) would violate
  `bookings_no_overlap`. That's why this claims first and deletes later, rather than creating first
  and cancelling the old one at the end.
- **The reinstate can legitimately fail.** In the seconds between claim and failure another student
  may book the original slot. `reinstateBooking` returns `false` on `23P01`. Log it as a compensation
  failure: the existing `compensate()` loop already logs "manual intervention may be needed". The
  window is small, and the only remedy is the tutor.
- **`startsAt` normalization.** `findByCancelToken` already returns
  `new Date(booking.starts_at).toISOString()`. Reuse it, or the recomputed token won't match (the
  TIMESTAMPTZ gotcha in CLAUDE.md).
- **History shows the price twice.** Once the new booking carries the original `stripe_payment_id`,
  the cancelled original and the new row both resolve the same payment in `deriveAmount`
  (`booking-history.ts:58-80`, status-agnostic). Pack reschedules already behave like this. Accept it
  for now, or skip `cancelled` rows superseded by a reschedule in a follow-up.
- Depends on P1-02: `hasBookingForPayment` must be count-based before two rows can share a PI.
- ~~Depends on P1-01: the new slot is validated with `ignoreEventId: oldRecord.eventId`~~ — no
  longer applies: P1-01 was trimmed (2026-09-28) to in-process checks only, with no Calendar read,
  so the original's still-live event can't collide with the new slot's validation. See STATUS.md.

## Out of scope

- Credit restore on *cancel* (P1-04).
- Deduplicating the price in booking history.
- An audit entry for reschedules (`BookingService` has no audit repository; adding one widens the constructor).
- Reschedule via paid checkout (`createSingleSessionCheckout`'s `rescheduleToken`). The UI never sends
  one (`SingleSessionBooking.tsx:354`), so leave it as is.
