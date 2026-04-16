# Task 3.5 — Extract `PaymentService`

**Fix ID:** `ARCH-14`
**Priority:** P2
**Est. effort:** 5 hours

## Problem

`/api/stripe/webhook/route.ts` holds all Stripe-facing logic: signature verification (acceptable), event dispatch, pack-credit handling, single-session processing, reschedule handling, slot re-check, auto-refund, dead-letter, idempotency. After Task 2.2 consolidates the duplicated branches, it's one large file with multiple responsibilities.

`/api/stripe/checkout/route.ts` also contains business logic: price lookup, PaymentIntent creation with metadata. All of this should be encapsulated in a `PaymentService` so:

- The webhook route becomes a thin adapter (signature check + dispatch + map errors)
- The checkout route becomes a thin adapter (parse + service call)
- The admin retry endpoint from Task 2.3 can call `paymentService.reprocess(stripeId)` without awkwardly importing from a route handler

## Scope

**Create:**
- `src/services/PaymentService.ts`
- `src/services/__tests__/PaymentService.test.ts`
- `src/infrastructure/stripe/StripeClient.ts` — interface + implementation
- `src/lib/http-errors.ts` — domain error → HTTP response helper (shared with Task 3.4)

**Modify:**
- `src/app/api/stripe/webhook/route.ts` — thin handler
- `src/app/api/stripe/checkout/route.ts` — thin handler
- `src/app/api/stripe/session/route.ts` — thin handler (already small)
- `src/app/api/admin/failed-bookings/route.ts` (from Task 2.3) — call `paymentService.reprocessFailedBooking(id)`
- `src/services/index.ts` — add singleton

**Do not touch:**
- Stripe package or API version
- Email content

## Approach

### Step 1 — StripeClient abstraction

```ts
// src/infrastructure/stripe/StripeClient.ts
/**
 * ARCH-14 — Thin typed wrapper over the Stripe SDK for dependency injection.
 * Allows PaymentService to be unit-tested with a fake implementation.
 */
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export interface IStripeClient {
  createPackPaymentIntent(params: {
    email: string; name: string; packSize: number;
  }): Promise<{ clientSecret: string; paymentIntentId: string }>;

  createSingleSessionPaymentIntent(params: {
    email: string; name: string;
    duration: "1h" | "2h";
    startIso: string; endIso: string;
    rescheduleToken?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }>;

  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;

  refund(params: { paymentIntentId?: string; chargeId?: string }): Promise<void>;

  verifyWebhookSignature(body: string, signature: string, secret: string): Stripe.Event;
}

export class StripeClient implements IStripeClient {
  /* delegates to the singleton `stripe` from lib/stripe.ts */
}
```

### Step 2 — PaymentService

```ts
// src/services/PaymentService.ts
export class PaymentService {
  constructor(
    private readonly stripeClient:  IStripeClient,
    private readonly credits:       CreditService,
    private readonly bookings:      BookingService,
    private readonly paymentRepo:   IPaymentRepository,
    private readonly calendar:      CalendarClient, // for slot re-check
  ) {}

  /**
   * Create a PaymentIntent for a pack purchase.
   */
  async createPackCheckout(params: {
    email: string; name: string; packSize: PackSize;
  }): Promise<{ clientSecret: string; paymentIntentId: string }>;

  /**
   * Create a PaymentIntent for a single-session purchase.
   */
  async createSingleSessionCheckout(params: {
    email: string; name: string;
    duration: "1h" | "2h";
    startIso: string; endIso: string;
    rescheduleToken?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }>;

  /**
   * Retrieve a succeeded PaymentIntent's metadata for the confirmation page.
   * Enforces ownership — caller must provide the authenticated email.
   */
  async getConfirmedPayment(params: {
    paymentIntentId: string;
    authenticatedEmail: string;
  }): Promise<PaymentSummary>;

  /**
   * Process a Stripe webhook event. Idempotent.
   * Dispatches to credit addition (packs) or booking creation (singles).
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void>;

  /**
   * Retry a dead-letter entry. Used by the admin API.
   */
  async reprocessFailedBooking(stripeSessionId: string): Promise<{
    ok: boolean; eventId?: string; error?: string;
  }>;
}
```

### Step 3 — Key internal methods

```ts
/** Process a single-session payment. Consolidates the webhook dedup logic. */
private async processSingleSession(input: SingleSessionInput): Promise<void> {
  if (await this.paymentRepo.isProcessed(input.idempotencyKey)) {
    log("info", "Duplicate webhook skipped", { key: input.idempotencyKey });
    return;
  }

  // Slot re-check — refund if slot was taken in the meantime
  const slotFree = await this.isSlotStillFree(input.startIso, input.duration);
  if (!slotFree) {
    await this.stripeClient.refund(input.refundTarget);
    log("warn", "Slot unavailable — refund issued", { ... });
    return;
  }

  try {
    // Delegate to BookingService — this is the key simplification.
    // BookingService handles: reschedule, calendar, Zoom, tokens, emails.
    await this.bookings.createBooking({
      email:           input.email,
      name:            input.name,
      startIso:        input.startIso,
      endIso:          input.endIso,
      sessionType:     input.duration === "1h" ? "session1h" : "session2h",
      rescheduleToken: input.rescheduleToken ?? undefined,
    });
    await this.paymentRepo.markProcessed(input.idempotencyKey);
  } catch (err) {
    // Dead-letter for admin retry
    await this.paymentRepo.recordFailedBooking({
      stripeSessionId: input.idempotencyKey,
      email:           input.email,
      startIso:        input.startIso,
      failedAt:        new Date().toISOString(),
      error:           String(err),
    });
    // Admin email notification (fire-and-forget)
    log("error", "Booking failed — dead-letter written", { idempotencyKey: input.idempotencyKey });
  }
}

async reprocessFailedBooking(id: string) {
  const entries = await this.paymentRepo.listFailedBookings();
  const entry = entries.find(e => e.stripeSessionId === id);
  if (!entry) return { ok: false, error: "Not found" };

  const intent = await this.stripeClient.retrievePaymentIntent(id);
  // ... rebuild SingleSessionInput from metadata and call processSingleSession
  // ... on success, clear the failed entry
}
```

### Step 4 — HTTP error mapping helper

```ts
// src/lib/http-errors.ts
/**
 * Maps domain errors to HTTP responses. Used by route handlers.
 */
import { NextResponse } from "next/server";
import {
  DomainError, InsufficientCreditsError, SlotUnavailableError,
  BookingNotFoundError, TokenExpiredError, UnauthorizedError,
} from "@/domain/errors";
import { log } from "@/lib/logger";

export function mapDomainErrorToResponse(err: unknown, context: Record<string, unknown> = {}) {
  if (err instanceof InsufficientCreditsError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof SlotUnavailableError)
    return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof BookingNotFoundError)
    return NextResponse.json({ error: err.message }, { status: 404 });
  if (err instanceof TokenExpiredError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof UnauthorizedError)
    return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof DomainError)
    return NextResponse.json({ error: err.message }, { status: 400 });

  // Unknown — log and return generic
  log("error", "Unhandled error in route", { ...context, error: String(err) });
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
```

### Step 5 — Slim route handlers

**Webhook:**
```ts
// src/app/api/stripe/webhook/route.ts
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = paymentService.verifyWebhookSignature(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    log("error", "Webhook signature verification failed", { error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  waitUntil(
    paymentService.processWebhookEvent(event).catch((err) =>
      log("error", "Webhook processing failed", { eventId: event.id, error: String(err) })
    )
  );

  return NextResponse.json({ received: true });
}
```

**Checkout:**
```ts
// src/app/api/stripe/checkout/route.ts — after parsing body
if (body.type === "pack") {
  const result = await paymentService.createPackCheckout({
    email: session.user.email, name, packSize: body.packSize,
  });
  return NextResponse.json(result);
}
const result = await paymentService.createSingleSessionCheckout({
  email: session.user.email, name,
  duration: body.duration, startIso: body.startIso, endIso: body.endIso,
  rescheduleToken: body.rescheduleToken,
});
return NextResponse.json(result);
```

## Acceptance Criteria

- [ ] `PaymentService` exists with methods listed above
- [ ] `StripeClient` abstraction exists and is injected
- [ ] `src/lib/http-errors.ts` exists and is used by all route handlers in Phase 3
- [ ] Webhook route is under 40 lines
- [ ] Checkout route is under 60 lines
- [ ] Admin retry endpoint from Task 2.3 uses `paymentService.reprocessFailedBooking`
- [ ] `PaymentService.processWebhookEvent` is idempotent — calling twice with same event is a no-op
- [ ] Unit tests: webhook event dispatch correctly routes pack vs single, duplicate idempotency key is a no-op, slot-taken triggers refund, booking failure writes dead-letter
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual test: full Stripe test flow (pack + single + reschedule + failure path) works
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **2. Refactor Plan → Phase 2: Deduplicate webhook** and **11.3 Webhook Reliability**.

## Testing

Unit-testing with mocks is now straightforward:

```ts
describe("PaymentService.processWebhookEvent", () => {
  it("skips duplicate events by idempotency key", async () => {
    const paymentRepo = mockPaymentRepo();
    paymentRepo.isProcessed.mockResolvedValue(true);

    const service = new PaymentService(/* ... */, paymentRepo, /* ... */);
    await service.processWebhookEvent(fakeSingleSessionEvent());

    expect(paymentRepo.markProcessed).not.toHaveBeenCalled();
  });

  it("issues refund when slot is no longer available", async () => {
    const calendar = mockCalendar();
    const stripeClient = mockStripe();
    calendar.getAvailableSlots.mockResolvedValue([]); // slot taken

    const service = new PaymentService(stripeClient, /* ... */, calendar);
    await service.processWebhookEvent(fakeSingleSessionEvent());

    expect(stripeClient.refund).toHaveBeenCalled();
  });
});
```

## Out of Scope

- Changing Stripe prices or checkout mode
- Adding new payment methods
- Removing the legacy `checkout.session.completed` branch (keep for backward compat — remove in follow-up after confirming no old links in flight)

## Rollback

Moderate risk because the webhook is a critical path. Mitigations:
1. Before merging, test with Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook` against local dev
2. Deploy to preview first; trigger real test-mode payments
3. Once production is live, watch Stripe's webhook dashboard for any delivery failures

If issues arise, revert is clean — the old inline logic is in git history and no data shapes change.
