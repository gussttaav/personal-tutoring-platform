# P1-04 — Checkout refuses a reschedule token

**Tag:** `REFACTOR-R5-P1-04` · **Severity:** 🟢 · **Effort:** S · **Owner:** Claude · **Status:** ✅

## TL;DR

Rescheduling a paid class never charges again: the wizard skips the payment step whenever a
reschedule token is present, and `/api/book` books the reschedule for free. Yet the single-session
checkout still accepts `rescheduleToken`, writes it into the PaymentIntent metadata, and the webhook
hands it to `createBooking`. Nothing sends it, but a crafted request can. The webhook's freebusy
re-check then sees the original class's own calendar event as busy whenever the slots overlap,
and refunds. Otherwise the student has paid twice for one class. Make the schema reject the field,
and stop writing it into the metadata. The webhook keeps *reading* it, so a PaymentIntent created
before deploy still behaves as it did.

## Context

- `src/lib/schemas.ts:60-67`: `SingleCheckoutSchema` has `rescheduleToken: z.string().optional()`.
- `src/app/api/stripe/checkout/route.ts:62-69`: forwards `body.rescheduleToken`.
- `src/services/PaymentService.ts:228-272`: `createSingleSessionCheckout` takes it and writes `reschedule_token` into the metadata (`:265`).
- `src/services/PaymentService.ts:334, 380, 413, 429`: the webhook, legacy session and admin-retry paths read `reschedule_token` back.
- `src/components/SingleSessionBooking.tsx:425`: `needsPaymentStep = … && !rescheduleToken`, so the payment step never runs on a reschedule. `:382` still passes `rescheduleToken ?? undefined` into `api.stripe.checkout` (always `undefined` in practice).
- `src/lib/api-client.ts:136-142`: `checkout(body: CheckoutInput)`, typed off the schema.
- `src/app/api/book/route.ts:36-38`: `REQUIRES_PAYMENT` unless a reschedule token is present. That's the free reschedule path, unchanged.

## Files affected

| File | Change |
|------|--------|
| `src/lib/schemas.ts` | `rescheduleToken: z.never().optional()` with a comment (rejects any value, accepts absence) |
| `src/app/api/stripe/checkout/route.ts` | Stop forwarding `rescheduleToken` |
| `src/services/PaymentService.ts` | `createSingleSessionCheckout` loses the param; metadata `reschedule_token: ""`, kept for webhook-shape stability |
| `src/components/SingleSessionBooking.tsx` | Drop `rescheduleToken` from the checkout call (`:382`) |
| `src/app/api/stripe/checkout/__tests__/*` or the schema tests | Body with `rescheduleToken` → 400 |
| `src/services/__tests__/PaymentService.test.ts` | Checkout metadata never carries a token |

## The change

```ts
// src/lib/schemas.ts
export const SingleCheckoutSchema = z.object({
  type:            z.literal("single"),
  duration:        z.enum(["1h", "2h"]),
  startIso:        z.string().datetime(),
  endIso:          z.string().datetime(),
  // REFACTOR-R5-P1-04: a reschedule is never paid for — it goes through POST /api/book.
  // Rejected (not stripped): a silently dropped token would book a SECOND class and leave
  // the original in place.
  rescheduleToken: z.never().optional(),
  attribution:     OptionalAttribution, // BOOKING-ATTRIBUTION-01
});
```

```ts
// src/services/PaymentService.ts — createSingleSessionCheckout metadata
// REFACTOR-R5-P1-04: always empty. The key stays so every PaymentIntent has the same
// metadata shape; the webhook still reads it for intents created before this change.
reschedule_token: "",
```

`z.never().optional()` makes the inferred type `undefined`, so a TypeScript caller can't pass a
token, and the stale prop at `SingleSessionBooking.tsx:382` becomes a compile error until it's removed.

## Acceptance criteria

- [ ] `POST /api/stripe/checkout` `{ type: "single", …, rescheduleToken: "abc" }` → 400 `INVALID_REQUEST`; `createPaymentIntent` not called
- [ ] The same body without the field → 200, as before
- [ ] PaymentIntent metadata from checkout has `reschedule_token: ""`
- [ ] Webhook with a legacy `reschedule_token` in metadata still passes it to `createBooking` (and P1-01's owner check applies)
- [ ] `pnpm lint` + `tsc` clean (`SingleSessionBooking.tsx` updated)
- [ ] File-top blocks carry `REFACTOR-R5-P1-04`

## Test plan

- **Existing:** `PaymentService.test.ts` checkout and webhook cases; e2e `booking-single` (paid flow) and `reschedule` specs (ask first).
- **New (schema/route):** `CheckoutSchema.safeParse` with a token → failure; without → success.
- **New (service):** `createSingleSessionCheckout` → captured `createPaymentIntent` params have `metadata.reschedule_token === ""`.

## Notes / gotchas

- **Mobile app:** if it ever sent `rescheduleToken` on checkout, it now gets a 400 instead of a
  double charge. Gustavo confirms it doesn't (PLAN → Decisions; STATUS → Production steps).
- The idempotency key doesn't include the token today, so nothing changes there.
- Don't remove the webhook's read of `reschedule_token`. A PaymentIntent created minutes before the
  deploy could still be confirmed after it. Removing the read is a follow-up once those are older
  than Stripe's retry window (3 days).

## Out of scope

- Paid *upgrades* on reschedule (1h → 2h with a price difference). That's a product feature, not a fix.
- Removing the webhook's `reschedule_token` read (follow-up, see above).
