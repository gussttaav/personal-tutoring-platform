# P3-03 — Move `payment-confirmation/channel` logic into PaymentService

**Tag:** `REFACTOR-R3-P3-03` · **Severity:** 🟡 · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`GET /api/payment-confirmation/channel` constructs `new Stripe(process.env.STRIPE_SECRET_KEY!)`
inline and performs PI-ownership resolution + pack/single branching in the route handler —
against both project rules (no business logic in routes; external systems behind
`src/infrastructure/` adapters). It's also a client-polled endpoint with no rate limiter.
Move the logic into `PaymentService.getConfirmationChannelState()` behind `IStripeClient`,
and add a limiter.

## Context

- `src/app/api/payment-confirmation/channel/route.ts:29-67` — inline Stripe client (line 31), metadata-based ownership gate, single/pack branching, balance lookup.
- `src/infrastructure/stripe/StripeClient.ts` — `IStripeClient` already exposes `retrievePaymentIntent` (used by `PaymentService.getConfirmedPayment`, `PaymentService.ts:143`). No new adapter method needed.
- `PaymentService.getConfirmedPayment` (`PaymentService.ts:138-170`) — near-identical ownership check (metadata email vs authenticated email, case-insensitive) to reuse/extract.
- `paymentChannelName` (`src/lib/realtime-channel.ts`) — pure HMAC helper; fine to keep calling from the service or route (it has no infra dependency).
- `src/lib/ratelimit.ts` — new limiter home (per project rule).

## Files affected

| File | Change |
|------|--------|
| `src/services/PaymentService.ts` | New `getConfirmationChannelState(paymentIntentId, authenticatedEmail)` |
| `src/app/api/payment-confirmation/channel/route.ts` | Thin dispatcher: rate-limit → auth → parse → service → map errors |
| `src/lib/ratelimit.ts` | `paymentChannelRatelimit` (e.g. 30/min per email — it's a reconnect/poll surface) |
| `src/services/__tests__/PaymentService.test.ts` | Tests for the new method |

## The change

```ts
// PaymentService — REFACTOR-R3-P3-03
export type ConfirmationChannelState =
  | { checkoutType: "single"; channelName: string; status: SingleSessionStatusResult["status"];
      booking?: SingleSessionBookingDetail }
  | { checkoutType: "pack"; channelName: string; confirmed: boolean;
      credits: number | null; name: string; packSize: number };

async getConfirmationChannelState(params: {
  paymentIntentId: string; authenticatedEmail: string;
}): Promise<ConfirmationChannelState> {
  const { paymentIntentId, authenticatedEmail } = params;
  const intent = await this.stripeClient.retrievePaymentIntent(paymentIntentId);

  const email = intent.metadata?.student_email ?? "";
  if (!email) throw Object.assign(new Error("PaymentIntent metadata incomplete"), { statusCode: 400 });
  if (email.toLowerCase().trim() !== authenticatedEmail.toLowerCase().trim()) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  const channelName = paymentChannelName(paymentIntentId);

  if ((intent.metadata?.checkout_type ?? "pack") === "single") {
    const { status, booking } = await this.getSingleSessionStatus(paymentIntentId);
    return { checkoutType: "single", channelName, status, ...(booking ? { booking } : {}) };
  }

  const metaPackSize = parseInt(intent.metadata?.pack_size ?? "0", 10);
  const confirmed = await this.credits.hasProcessedPayment(paymentIntentId);
  const balance   = confirmed ? await this.credits.getBalance(email) : null;
  return {
    checkoutType: "pack", channelName, confirmed,
    credits:  balance?.credits  ?? (confirmed ? metaPackSize : null),
    name:     balance?.name     ?? (intent.metadata?.student_name ?? ""),
    packSize: balance?.packSize ?? metaPackSize,
  };
}
```

Route shrinks to: limiter → `pi_` prefix validation → `getSession()` → call → map
`statusCode`-carrying errors (same pattern as `getConfirmedPayment`'s consumer,
`/api/stripe/session`).

## Acceptance criteria

- [ ] `grep -rn "new Stripe(" src` → only `src/infrastructure/stripe/` and `src/lib/stripe-client.ts`
- [ ] Response shapes byte-identical for both branches (mobile app consumes the single branch — contract must not move)
- [ ] Ownership 403, incomplete-metadata 400, Stripe-retrieve failure 500 behaviors preserved
- [ ] Route ≤ ~40 lines, no branching on `checkout_type`
- [ ] Polling under reconnect stays under the new limiter (mobile S08 screen poll cadence — check its interval before picking the limit)
- [ ] File-top comment blocks updated with `REFACTOR-R3-P3-03`

## Test plan

- **Existing:** `PaymentService.test.ts` (`getSingleSessionStatus` tests), integration tests touching the channel endpoint if any.
- **New (service, stripe fake):** pack confirmed / pack pending / single confirmed-with-booking / single slot_taken / ownership mismatch → 403-shaped error / missing email metadata → 400-shaped error.
- **Manual:** buy a pack in Stripe test mode → `pago-exitoso` page confirms live; simulate webhook delay → page falls back to channel state correctly. Verify the mobile single-session poll against a dev deploy if possible.

## Notes / gotchas

- **The mobile app consumes this endpoint** (`SINGLE-SESSION-CONFIRM-01` comments) — treat the JSON as a public contract; add a response-shape assertion test rather than trusting the refactor.
- Rate limit keyed by authenticated email (not IP): it's an authenticated poll endpoint and mobile clients share carrier NATs.
- Keep `export const dynamic = "force-dynamic"` on the route.
- `Object.assign(new Error(...), { statusCode })` matches `getConfirmedPayment`'s existing error style — reuse it rather than inventing new domain errors for HTTP-ish concerns.

## Out of scope

- Changing the Realtime channel scheme or polling cadence.
- Migrating `getConfirmedPayment`'s duplicate ownership check into a shared private helper is allowed if trivial, but do not refactor `/api/stripe/session` itself.
