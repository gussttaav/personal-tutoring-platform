# Task P1-05 — Stripe PaymentIntent idempotency key

**Severity:** 🟠 High
**Effort:** 1–2 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`StripeClient.createPaymentIntent` does not pass an `idempotencyKey`. A double-click on "Pay" or a network retry will create duplicate PaymentIntents. The client only completes one, but you've created (and may be billed by Stripe for API usage on) the others, and they linger in a half-formed state.

## Context

### The bug

```typescript
// src/infrastructure/stripe/StripeClient.ts:4041
async createPaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(params);  // ← no second arg
}
```

The Stripe SDK accepts a second arg `RequestOptions` where you can pass `idempotencyKey`. Without it, every call to `paymentIntents.create` produces a new PI.

### Real-world trigger

User clicks "Pay" → fetch starts → network blip / page reload → user clicks "Pay" again → two `createPaymentIntent` calls land at your server with the same body. You return two different `clientSecret`s. Front-end uses the last one. The first PI is orphaned in Stripe (status: `requires_payment_method`) and counts toward your account's PI quota.

Worse: if the user actually completes payment on the **first** secret (because the second failed for some reason), you get a successful PI whose webhook your code didn't expect.

### Why this is "high" not "critical"

- Stripe's `idempotencyKey` is sent by *you*; if you don't send one, Stripe treats each request as new. There's no Stripe-side dedup without it.
- Net financial risk per accidental duplicate: zero (only one PI is ever completed by the client). Operational risk: orphaned PIs in your Stripe dashboard.
- Becomes critical if combined with auto-confirm flows or if a user has multiple tabs open and completes payment on different ones.

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/stripe/StripeClient.ts` | Accept and pass `idempotencyKey` |
| `src/services/PaymentService.ts` | Generate deterministic idempotency keys for both checkout flows |
| `src/services/__tests__/PaymentService.test.ts` | Test that two identical createPack calls use the same key |
| `src/__tests__/fixtures/FakeStripeClient.ts` | Track idempotency keys to verify in tests |

## The change

### 1. `src/infrastructure/stripe/StripeClient.ts`

Update the interface and impl:

```typescript
// ARCH-14: Thin typed wrapper over the Stripe SDK for dependency injection.
//
// REFACTOR-P1-05: createPaymentIntent accepts an optional idempotencyKey so
// client retries / double-clicks produce the same PaymentIntent instead of
// minting duplicates.

import type Stripe from "stripe";
import { stripe } from "@/infrastructure/stripe/client-singleton";

export interface CreatePaymentIntentOptions {
  idempotencyKey?: string;
}

export interface IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event;
  getPriceAmount(priceId: string): Promise<{ amount: number; currency: string }>;
  createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent>;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session>;
  createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void>;
}

export class StripeClient implements IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event {
    return stripe.webhooks.constructEvent(body, sig, secret);
  }

  async getPriceAmount(priceId: string): Promise<{ amount: number; currency: string }> {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.unit_amount) throw new Error(`Price ${priceId} has no unit_amount`);
    return { amount: price.unit_amount, currency: price.currency };
  }

  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.create(
      params,
      options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    );
  }

  // ... rest unchanged
}
```

### 2. `src/services/PaymentService.ts` — generate deterministic keys

For `createPackCheckout`:

```typescript
async createPackCheckout(params: {
  email: string; name: string; packSize: PackSize;
}): Promise<CheckoutResult> {
  const { email, name, packSize } = params;
  const priceId = getPackPriceId(packSize);
  const { amount, currency } = await this.stripeClient.getPriceAmount(priceId);

  // REFACTOR-P1-05: Idempotency key with a 5-minute window. A double-click
  // within 5 min produces the same PI; a deliberate re-attempt after 5 min
  // produces a fresh one (intended — user may want to retry after editing).
  const idempotencyKey = `pack:${email}:${packSize}:${Math.floor(Date.now() / 300_000)}`;

  const intent = await this.stripeClient.createPaymentIntent(
    {
      amount,
      currency,
      metadata: {
        student_name:  name,
        student_email: email,
        pack_size:     String(packSize),
        checkout_type: "pack",
      },
    },
    { idempotencyKey },
  );
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}
```

For `createSingleSessionCheckout`:

```typescript
async createSingleSessionCheckout(params: {
  email: string; name: string;
  duration: "1h" | "2h";
  startIso: string;
  endIso: string;
  rescheduleToken?: string;
}): Promise<CheckoutResult> {
  const { email, name, duration, startIso, endIso, rescheduleToken } = params;
  const priceId = getSingleSessionPriceId(duration);
  const { amount, currency } = await this.stripeClient.getPriceAmount(priceId);

  // REFACTOR-P1-05: Idempotency key includes startIso so two genuinely
  // different bookings (same user, same duration, different slot) don't collide.
  const idempotencyKey =
    `single:${email}:${duration}:${startIso}:${Math.floor(Date.now() / 300_000)}`;

  const intent = await this.stripeClient.createPaymentIntent(
    {
      amount,
      currency,
      metadata: {
        student_name:     name,
        student_email:    email,
        checkout_type:    "single",
        session_duration: duration,
        start_iso:        startIso,
        end_iso:          endIso,
        reschedule_token: rescheduleToken ?? "",
      },
    },
    { idempotencyKey },
  );
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}
```

### 3. `src/__tests__/fixtures/FakeStripeClient.ts`

Track idempotency keys to enable assertions:

```typescript
export class FakeStripeClient implements IStripeClient {
  private intents = new Map<string, Stripe.PaymentIntent>();
  private idempotencyToIntentId = new Map<string, string>();

  // ...

  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent> {
    if (options?.idempotencyKey) {
      const existing = this.idempotencyToIntentId.get(options.idempotencyKey);
      if (existing) return this.intents.get(existing)!;
    }

    const id = `pi_fake_${this.intents.size + 1}`;
    const intent = {
      id,
      client_secret: `${id}_secret`,
      status: "requires_payment_method",
      metadata: params.metadata ?? {},
      amount: params.amount,
      currency: params.currency,
    } as unknown as Stripe.PaymentIntent;

    this.intents.set(id, intent);
    if (options?.idempotencyKey) {
      this.idempotencyToIntentId.set(options.idempotencyKey, id);
    }
    return intent;
  }

  // Test helper:
  getIdempotencyKeys(): string[] {
    return Array.from(this.idempotencyToIntentId.keys());
  }
}
```

## Acceptance criteria

- [ ] `IStripeClient.createPaymentIntent` accepts optional `CreatePaymentIntentOptions`
- [ ] Real `StripeClient` passes `idempotencyKey` to the SDK when provided
- [ ] `PaymentService.createPackCheckout` generates a key of form `pack:{email}:{packSize}:{windowId}`
- [ ] `PaymentService.createSingleSessionCheckout` generates a key including `startIso`
- [ ] Two identical calls within the 5-min window return the same PI
- [ ] Two calls separated by >5 min return different PIs
- [ ] `FakeStripeClient` honors the idempotency key in tests
- [ ] All existing tests still pass

## Test plan

### New tests in `src/services/__tests__/PaymentService.test.ts`

```typescript
describe("REFACTOR-P1-05: idempotency keys", () => {
  it("returns the same PaymentIntent for two identical pack checkouts", async () => {
    const services = buildTestServices();
    const a = await services.paymentService.createPackCheckout({
      email: "u@example.com", name: "U", packSize: 5,
    });
    const b = await services.paymentService.createPackCheckout({
      email: "u@example.com", name: "U", packSize: 5,
    });
    expect(a.paymentIntentId).toBe(b.paymentIntentId);
  });

  it("returns different PaymentIntents for different pack sizes", async () => {
    const services = buildTestServices();
    const a = await services.paymentService.createPackCheckout({
      email: "u@example.com", name: "U", packSize: 5,
    });
    const b = await services.paymentService.createPackCheckout({
      email: "u@example.com", name: "U", packSize: 10,
    });
    expect(a.paymentIntentId).not.toBe(b.paymentIntentId);
  });

  it("returns different PaymentIntents for the same single-session checkout in different time windows", async () => {
    const services = buildTestServices();
    const params = {
      email: "u@example.com", name: "U",
      duration: "1h" as const,
      startIso: "2026-06-01T10:00:00.000Z",
      endIso:   "2026-06-01T11:00:00.000Z",
    };

    const a = await services.paymentService.createSingleSessionCheckout(params);

    // Advance time past the 5-min window
    jest.useFakeTimers();
    jest.advanceTimersByTime(6 * 60_000);

    const b = await services.paymentService.createSingleSessionCheckout(params);

    expect(a.paymentIntentId).not.toBe(b.paymentIntentId);
    jest.useRealTimers();
  });
});
```

### Manual verification

```bash
# In the live app:
# 1. Open browser DevTools → Network tab
# 2. Initiate checkout for a pack
# 3. Note the paymentIntentId in the /api/stripe/checkout response
# 4. Repeat within 5 minutes
# 5. Expect: same paymentIntentId

# Then in Stripe Dashboard → Payment Intents:
# Verify only ONE new PI was created instead of two.
```

## Notes / gotchas

- **Stripe idempotency window:** Stripe itself dedupes idempotency keys for 24 hours. Our 5-minute key rotation is more conservative — a deliberate "retry after 5 min" gets a fresh PI.
- **Key length limit:** Stripe accepts up to 255 chars. Our format `pack:long_email@example.com:5:NNNN` is well within.
- **No PII concerns in the key:** the key is server-internal; it's hashed in Stripe's logs and never exposed to the client.
- **What about the legacy `checkout.session.completed` flow?** Checkout Sessions also accept an `idempotency_key` via the same `RequestOptions` arg. If you re-enable that flow, add the same pattern. Currently the legacy flow is webhook-handled only — no creation path to fix.

## Out of scope

- Adding idempotency to `createRefund` — refunds are admin-triggered, not client-driven, so the duplicate risk is low. Address if/when an admin double-click in the UI becomes a real concern.
- Implementing client-side debounce on the "Pay" button — UI concern; consider as part of UX polish.
