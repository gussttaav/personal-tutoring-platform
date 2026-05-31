# Task P1-02 — Stripe webhook: return 500 on retryable processing failures

**Severity:** 🔴 Critical
**Effort:** 3–4 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`src/app/api/stripe/webhook/route.ts` always returns 200 because processing happens inside `waitUntil()`. If `paymentService.processWebhookEvent()` throws (DB down, unique-constraint violation other than 23505, OOM, etc.), Stripe marks the event as delivered and never retries. The user paid; the booking/credits never landed; nothing alerts.

The dead-letter pattern in `processSingleSession` catches **one specific** failure path (booking creation after slot-check). `handlePackPayment` and everything else fails silently.

## Context

### The current code

```typescript
// src/app/api/stripe/webhook/route.ts:841
export async function POST(req: NextRequest) {
  // ... verify signature ...
  waitUntil(
    paymentService.processWebhookEvent(event).catch((err) =>
      log("error", "Webhook processing failed", { service: "webhook", eventId: event.id, error: String(err) })
    )
  );
  return NextResponse.json({ received: true }); // ← always 200
}
```

### Why `waitUntil` was used

The original intent was correct: Stripe webhooks have a 30-second timeout and you wanted to return fast. But the choice between "fast return + lose retries" and "synchronous processing + use retries" is **the latter** for payment-critical events. The processing typically takes <1 second; the 30s budget is plenty.

### Stripe's retry behavior

Stripe automatically retries non-2xx responses with exponential backoff over **3 days**, up to 16 attempts. This is your primary defense against transient failures. Returning 200 throws that defense away.

## Files affected

| File | Change |
|------|--------|
| `src/app/api/stripe/webhook/route.ts` | Remove `waitUntil`, process synchronously, return 500 on retryable errors |
| `src/domain/errors.ts` | Add `PermanentWebhookError` |
| `src/services/PaymentService.ts` | Throw `PermanentWebhookError` for unrecoverable cases (malformed metadata, missing email after dead-letter write) |
| `src/services/__tests__/PaymentService.test.ts` | Test that retryable failures throw, non-retryable produce 200 |

## The change

### 1. `src/domain/errors.ts`

Add at the end of the file (after existing error classes):

```typescript
// REFACTOR-P1-02: Distinguish webhook failures that should be retried by Stripe
// from those that are permanent (malformed data we can never process). Permanent
// errors return 200 so Stripe stops retrying; retryable ones return 500 so Stripe
// keeps trying for up to 3 days.
export class PermanentWebhookError extends DomainError {
  constructor(reason: string) {
    super(`Permanent webhook failure: ${reason}`, "PERMANENT_WEBHOOK_ERROR");
  }
}
```

### 2. `src/app/api/stripe/webhook/route.ts`

Replace the whole file body:

```typescript
/**
 * POST /api/stripe/webhook
 *
 * ARCH-14: Thin adapter — signature verification + dispatch.
 *
 * REFACTOR-P1-02: Processes synchronously instead of via waitUntil(). Returns
 * 500 for retryable failures so Stripe retries automatically (up to 3 days with
 * exponential backoff). Returns 200 only on success OR PermanentWebhookError
 * (malformed metadata that retrying cannot fix).
 *
 * Previous handlers: payment_intent.succeeded (embedded flow) and
 * checkout.session.completed (legacy redirect flow) are both handled
 * by paymentService.processWebhookEvent().
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { paymentService } from "@/services";
import { log } from "@/lib/logger";
import { PermanentWebhookError } from "@/domain/errors";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = paymentService.verifyWebhookSignature(body, sig, webhookSecret);
  } catch (err) {
    log("error", "Stripe webhook signature verification failed", {
      service: "webhook",
      error: String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await paymentService.processWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    if (err instanceof PermanentWebhookError) {
      log("error", "Permanent webhook failure — not retrying", {
        service: "webhook",
        eventId: event.id,
        error: String(err),
      });
      // Return 200 so Stripe stops retrying. The error is in Sentry via log().
      return NextResponse.json({ received: true, permanentFailure: true });
    }

    log("error", "Webhook processing failed — Stripe will retry", {
      service: "webhook",
      eventId: event.id,
      error: String(err),
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
```

**Note:** delete the `import { waitUntil } from "@vercel/functions";` line — no longer used.

### 3. `src/services/PaymentService.ts`

In `processWebhookEvent`, replace the silent `if (!email) return;` cases with `throw new PermanentWebhookError(...)`:

```typescript
// Before (PaymentService.ts:30865):
if (!email) {
  log("error", "Missing email in webhook metadata", { service: "payment", stripeSessionId });
  return;
}

// After:
if (!email) {
  log("error", "Missing email in webhook metadata", { service: "payment", stripeSessionId });
  throw new PermanentWebhookError(`Missing student_email in metadata for ${stripeSessionId}`);
}
```

Same treatment for the other `return;` guards inside `processWebhookEvent`:
- `handlePackPayment`: missing `email` or `packSize` → `PermanentWebhookError`
- `processSingleSession`: missing `email`, `startIso`, or `endIso` → `PermanentWebhookError`

The dead-letter logic inside `processSingleSession` (when `bookings.createBooking` throws after credit/Stripe was already updated) **stays as-is**: it writes to `failed_bookings` and returns normally. Don't change that — Stripe should NOT retry once we've successfully written the dead-letter row (otherwise we'd retry forever on a slot that's permanently taken).

Actually, re-examining: in `processSingleSession` the catch block writes the dead-letter and **does not rethrow**. That's correct — slot-taken is permanent for that specific PaymentIntent (the refund was issued). Leave alone.

But: if `writeDeadLetter` itself fails (Supabase down), we need Stripe to retry. Check that `writeDeadLetter` rethrows on failure. Currently (line 31047) it catches and logs. **Change that to rethrow:**

```typescript
// PaymentService.writeDeadLetter, line 31047
try {
  await this.paymentRepo.recordFailedBooking({ /* ... */ });
  log("error", "Dead-letter written for failed booking", { ... });
} catch (kvErr) {
  log("error", "Failed to write dead-letter record", { ... });
  throw kvErr;  // ← add this, so the webhook returns 500 and Stripe retries
}
```

## Acceptance criteria

- [ ] Webhook route processes synchronously (no `waitUntil`)
- [ ] On success → 200
- [ ] On `PermanentWebhookError` → 200 (so Stripe stops) + Sentry error logged
- [ ] On any other error → 500 (so Stripe retries)
- [ ] `PermanentWebhookError` exported from `domain/errors.ts`
- [ ] All `if (!email) return;` style silent failures in `processWebhookEvent` and `handlePackPayment` replaced with throws
- [ ] `writeDeadLetter` rethrows on persistence failure
- [ ] All existing tests pass
- [ ] New tests cover both retryable and non-retryable failure paths

## Test plan

### Existing tests to verify still pass

```bash
pnpm test src/services/__tests__/PaymentService.test.ts
pnpm test src/__tests__/integration/payment.test.ts
```

### New tests

In `src/services/__tests__/PaymentService.test.ts`:

```typescript
describe("REFACTOR-P1-02: webhook error semantics", () => {
  it("throws PermanentWebhookError when student_email is missing", async () => {
    const services = buildTestServices();
    const event = {
      id: "evt_test",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test", metadata: { checkout_type: "pack" } } },
    } as unknown as Stripe.Event;

    await expect(services.paymentService.processWebhookEvent(event))
      .rejects.toBeInstanceOf(PermanentWebhookError);
  });

  it("rethrows when failed_bookings insert fails", async () => {
    const services = buildTestServices();
    // Mock paymentRepo.recordFailedBooking to throw
    jest.spyOn(services.paymentRepo, "recordFailedBooking").mockRejectedValueOnce(new Error("DB down"));
    // ... trigger a path that hits writeDeadLetter ...
    await expect(/* ... */).rejects.toThrow("DB down");
  });
});
```

Add a route-level test in a new file `src/app/api/stripe/webhook/__tests__/route.test.ts`:

```typescript
import { POST } from "../route";

describe("Stripe webhook route", () => {
  it("returns 500 on retryable failure", async () => {
    // Mock paymentService.processWebhookEvent to throw a generic Error
    // POST a valid (signed) event
    // Expect res.status === 500
  });

  it("returns 200 on PermanentWebhookError", async () => {
    // Mock paymentService.processWebhookEvent to throw PermanentWebhookError
    // Expect res.status === 200
  });
});
```

### Manual verification

```bash
# Terminal 1: forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook --print-secret

# Set SUPABASE_URL to a deliberately broken value
SUPABASE_URL=https://broken.example.com pnpm dev

# Terminal 2: trigger
stripe trigger payment_intent.succeeded
# Expect: 500 in Stripe CLI output, and Stripe queues a retry
```

Stripe CLI shows the response code per delivery. Confirm `[500]` for the first attempt, then `[200]` after you restore `SUPABASE_URL`.

## Notes / gotchas

- **Vercel timeout:** synchronous processing must finish within the function's max-duration. Hobby tier is 10s, Pro is 60s. The current logic typically completes in <1s. Verify your Vercel project tier — if Hobby, watch for slow Supabase calls.
- **Idempotency still required:** even with proper retries, `paymentRepo.isProcessed(idempotencyKey)` must remain in place — Stripe will retry the same event multiple times.
- **Don't add new `waitUntil` calls anywhere in this route.** If you need genuinely fire-and-forget work (e.g. analytics ping), do it after the `await paymentService.processWebhookEvent(event)` returns.
- The legacy `checkout.session.completed` branch in `processWebhookEvent` shares the same error semantics. Make sure your tests hit both branches.

## Out of scope

- Switching webhooks to use Stripe's new "thin events" model — separate decision.
- Adding webhook event handlers for `charge.refunded`, `dispute.*`, etc. — separate task.
- Persisting all received webhook events for audit (we currently only persist idempotency keys for successful processing) — Phase 4 consideration.
