# P1-01 — A reschedule token only works for its owner

**Tag:** `REFACTOR-R5-P1-01` · **Severity:** 🟠 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`BookingService.createBooking` looks the original booking up by its reschedule (cancel) token and
consumes it. It never checks that the booking belongs to the person asking. The token is
HMAC-signed over the owner's email (`SEC-05`), so the server knows the owner: it just doesn't
compare. Example: a student opens the reschedule link from their confirmation email while their
browser is signed in with a different Google account. The original class is torn down, and the new
one is created under the other account, which also receives the confirmation email. For a pack
class, the original's `credit_pack_id` moves to a booking whose user doesn't own that pack. That is
exactly the state the daily audit's `pack_not_owned` finding exists for. Fix: compare the emails
before the claim, and refuse with a new 403 domain error.

## Context

- `src/services/BookingService.ts:240-286`: the reschedule branch. In order: `findByCancelToken` →
  window check (`:251`) → session-type check (`:258`) → `consumeCancelToken` (`:265`) → push the
  reinstate compensation. No identity check anywhere.
- `src/services/BookingService.ts:291-295`: a pack reschedule copies `oldRecord.creditPackId` onto
  the new booking (`REFACTOR-R4-P1-03`).
- `src/services/BookingService.ts:346`: a paid reschedule carries `oldRecord.stripePaymentId`.
- `src/services/BookingService.ts:436-437`: on success, `teardownRescheduledOriginal(oldRecord)`
  deletes the original's calendar event, Zoom session and pending termination.
- `src/infrastructure/supabase/SupabaseBookingRepository.ts:79-125`: `findByCancelToken` already
  resolves the owner (`users.email` by `bookings.user_id`) and verifies the HMAC against it. The
  returned `BookingRecord.email` **is** the owner's email.
- `src/app/api/book/route.ts:41-46`: `email` comes from the session (cookie or mobile bearer). The
  token comes from the body.
- `src/services/BookingPaymentAuditService.ts:117-119`: `pack_not_owned`, the downstream symptom.
- The webhook path (`PaymentService.ts:334`) can also carry a token from metadata. P1-04 closes that
  entry point. The check below covers it anyway, because it lives in `createBooking`.

Reachable today with no attacker: the email link opens `/mentoria?reschedule=<type>&token=…`, and
`useBookingRouter` starts the reschedule for whoever is signed in.

## Files affected

| File | Change |
|------|--------|
| `src/domain/errors.ts` | New `RescheduleNotOwnerError` (`RESCHEDULE_NOT_OWNER`) |
| `src/lib/http-errors.ts` | `RESCHEDULE_NOT_OWNER: 403` |
| `src/constants/errors.ts` | `RESCHEDULE_NOT_OWNER: "errors.domain.rescheduleNotOwner"` |
| `messages/es.json`, `messages/en.json` | `errors.domain.rescheduleNotOwner` (both files, same key) |
| `src/services/BookingService.ts` | Owner check right after `findByCancelToken`, before any write |
| `src/services/__tests__/BookingService.test.ts` | Refusal + "token still usable by owner" tests |
| `src/__tests__/integration/reschedule.test.ts` | End-to-end refusal through the in-memory repos |
| `src/app/api/book/__tests__/route.test.ts` | 403 mapping |

## The change

```ts
// src/domain/errors.ts
// REFACTOR-R5-P1-01: a signed-in user asked to reschedule a booking that belongs to
// another account. The token is valid, the caller just isn't its owner. Mapped to 403.
export class RescheduleNotOwnerError extends DomainError {
  constructor() { super("This booking belongs to another account", "RESCHEDULE_NOT_OWNER"); }
}
```

```ts
// src/services/BookingService.ts — inside `if (input.rescheduleToken)`, right after the !oldRecord check
// REFACTOR-R5-P1-01: the token is HMAC-bound to its owner's email (findByCancelToken
// verified it against users.email). Refuse anyone else BEFORE the claim, so nothing is
// consumed, torn down or moved, and the owner's link keeps working.
if (normalizeEmail(oldRecord.email) !== normalizeEmail(input.email)) {
  log("warn", "Reschedule refused: caller is not the booking's owner", {
    service: "BookingService", eventId: oldRecord.eventId,
  });
  throw new RescheduleNotOwnerError();
}
```

`normalizeEmail` = `toLowerCase().trim()`. Use the existing helper if there is one (grep
`normalizeEmail` / `toLowerCase().trim()` in `src/lib`). Don't log either email: the log line
carries the event id only.

Copy (proposed; Gustavo may reword):
- es: «Esta clase se reservó con otra cuenta. Inicia sesión con la cuenta con la que la reservaste para reprogramarla.»
- en: «This class was booked with a different account. Sign in with the account you booked it with to reschedule it.»

The message must not reveal the owner's email.

## Acceptance criteria

- [ ] `createBooking` with a valid token whose owner ≠ `input.email` rejects with `RescheduleNotOwnerError`
- [ ] In that case `consumeCancelToken`, `useCredit`, `calendar.createEvent` and `bookings.createBooking` are never called; the lock is still released (`finally`)
- [ ] The same token then succeeds for its owner
- [ ] The comparison is case- and whitespace-insensitive (`Ana@x.com ` == `ana@x.com`)
- [ ] `POST /api/book` maps it to 403 with code `RESCHEDULE_NOT_OWNER`; `errors.domain.rescheduleNotOwner` exists in both message files and `pnpm check:messages` passes
- [ ] File-top comment blocks of every touched source file carry `REFACTOR-R5-P1-01`

## Test plan

- **Existing:** `BookingService.test.ts` (reschedule cases), `src/__tests__/integration/reschedule.test.ts`,
  `src/app/api/book/__tests__/route.test.ts` keep passing. The happy-path reschedule uses the same
  email for both, so check that the fixtures do (`InMemoryBookingRepository.findByCancelToken`
  must return the stored owner's email).
- **New (service, mock repos):** owner mismatch → rejects; `consumeCancelToken` not called;
  `releaseSlotLock` called. Then the case-insensitive match → proceeds.
- **New (integration, in-memory):** book as A → reschedule with A's token while signed in as B →
  403-equivalent error; A's booking still `confirmed`; A's reschedule with the same token succeeds.
- **New (route):** `bookingService.createBooking` rejecting with `RescheduleNotOwnerError` → 403 JSON `{ error: "RESCHEDULE_NOT_OWNER" }`.
- **Manual (optional):** e2e `reschedule` spec, signed in as a second whitelisted E2E email → error toast, original intact.

## Notes / gotchas

- **Check before the claim, not after.** Refusing after `consumeCancelToken` would need the reinstate
  compensation to run and would briefly free the slot. The refusal must be side-effect-free.
- **The cancel link stays token-only.** `/cancelar?token=` is unauthenticated by design (students cancel
  from the email without signing in). This task doesn't change cancel.
- **Mobile app:** the bearer resolves to the same `session.user.email`, so the app gets the same
  403. It surfaces unknown codes generically, which is acceptable.
- **The admin/tutor** doesn't reschedule on a student's behalf through this path today. If that
  ever becomes a feature, it needs its own admin route, not an exemption here.
- `findByCancelToken`'s user-lookup error still returns `null` (→ `INVALID_RESCHEDULE_TOKEN`), so
  it fails closed. Out of scope here.

## Out of scope

- Telling the student *which* account they used. That leaks the email.
- Auto-switching accounts or signing out from the error state.
- Binding chat sessions or cancel links to users.
