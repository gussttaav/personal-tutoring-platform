// TEST-01: Fake IStripeClient for integration tests.
// REFACTOR-R4-P3-01: listPaymentIntents pages over a seeded array (seedListedPaymentIntent),
// kept apart from the retrieve map so a reconcile test lists exactly what it seeded.
import type Stripe from "stripe";
import type {
  IStripeClient, CreatePaymentIntentOptions, ListPaymentIntentsParams,
} from "@/infrastructure/stripe/StripeClient";

type FakePaymentIntent = {
  id:            string;
  client_secret: string;
  status:        string;
  amount:        number;
  currency:      string;
  metadata:      Record<string, string>;
};

type FakeListedPaymentIntent = FakePaymentIntent & { created: number };

type FakeCheckoutSession = {
  id:              string;
  payment_intent:  string;
  customer_email:  string | null;
  metadata:        Record<string, string>;
};

export class FakeStripeClient implements IStripeClient {
  private intents  = new Map<string, FakePaymentIntent>();
  private sessions = new Map<string, FakeCheckoutSession>();
  refunds:          Array<{ payment_intent?: string; charge?: string; reason: string }> = [];
  private idCounter = 0;
  private idempotencyToIntentId = new Map<string, string>();
  private listed:   FakeListedPaymentIntent[] = [];
  /** Test helper: every listPaymentIntents call, in order. */
  readonly listCalls: ListPaymentIntentsParams[] = [];

  verifyWebhookSignature(_body: string, _sig: string, _secret: string): Stripe.Event {
    throw new Error("FakeStripeClient: call constructFakeEvent() to build test events");
  }

  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent> {
    if (options?.idempotencyKey) {
      const existing = this.idempotencyToIntentId.get(options.idempotencyKey);
      if (existing) return this.intents.get(existing)! as unknown as Stripe.PaymentIntent;
    }
    const id     = `pi_test_${this.idCounter++}`;
    const intent: FakePaymentIntent = {
      id,
      client_secret: `${id}_secret`,
      status:        "succeeded",
      amount:        params.amount,
      currency:      params.currency,
      metadata:      (params.metadata ?? {}) as Record<string, string>,
    };
    this.intents.set(id, intent);
    if (options?.idempotencyKey) {
      this.idempotencyToIntentId.set(options.idempotencyKey, id);
    }
    return intent as unknown as Stripe.PaymentIntent;
  }

  getIdempotencyKeys(): string[] {
    return Array.from(this.idempotencyToIntentId.keys());
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`FakeStripeClient: no intent for id ${id}`);
    return intent as unknown as Stripe.PaymentIntent;
  }

  // Pages in seed order (seed newest-first to mirror Stripe). `startingAfter` must be
  // an id this fake returned — Stripe rejects an unknown cursor, and so does this.
  async listPaymentIntents(
    params: ListPaymentIntentsParams,
  ): Promise<{ data: Stripe.PaymentIntent[]; hasMore: boolean }> {
    this.listCalls.push(params);
    const matching = this.listed.filter(pi => pi.created >= params.createdGte);
    let start = 0;
    if (params.startingAfter) {
      const cursor = matching.findIndex(pi => pi.id === params.startingAfter);
      if (cursor < 0) throw new Error(`FakeStripeClient: unknown cursor ${params.startingAfter}`);
      start = cursor + 1;
    }
    const data = matching.slice(start, start + params.limit);
    return {
      data:    data as unknown as Stripe.PaymentIntent[],
      hasMore: start + params.limit < matching.length,
    };
  }

  /** Test helper: add a PaymentIntent to the array listPaymentIntents pages over. */
  seedListedPaymentIntent(params: {
    id:            string;
    checkoutType?: string;
    status?:       string;
    amount?:       number;
    email?:        string;
    created?:      number; // unix seconds; defaults to now
  }): void {
    const metadata: Record<string, string> = { student_email: params.email ?? "student@test.com" };
    if (params.checkoutType !== undefined) metadata.checkout_type = params.checkoutType;
    this.listed.push({
      id:            params.id,
      client_secret: `${params.id}_secret`,
      status:        params.status ?? "succeeded",
      amount:        params.amount ?? 4900,
      currency:      "eur",
      metadata,
      created:       params.created ?? Math.floor(Date.now() / 1000),
    });
  }

  async retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`FakeStripeClient: no session for id ${id}`);
    return session as unknown as Stripe.Checkout.Session;
  }

  async createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void> {
    this.refunds.push(params);
  }

  /** Test helper: build a payment_intent.succeeded event. */
  buildPackPaymentEvent(params: {
    email:        string;
    name:         string;
    packSize:     number;
    intentId:     string;
    amountCents?: number;
  }): Stripe.Event {
    const intent: FakePaymentIntent = {
      id:            params.intentId,
      client_secret: `${params.intentId}_secret`,
      status:        "succeeded",
      amount:        params.amountCents ?? 14900,
      currency:      "eur",
      metadata: {
        student_email: params.email,
        student_name:  params.name,
        pack_size:     String(params.packSize),
        checkout_type: "pack",
      },
    };
    this.intents.set(params.intentId, intent);
    return {
      id:   `evt_${params.intentId}`,
      type: "payment_intent.succeeded",
      data: { object: intent },
    } as unknown as Stripe.Event;
  }

  /** Test helper: build a payment_intent.succeeded event for a single session. */
  buildSingleSessionPaymentEvent(params: {
    email:        string;
    name:         string;
    startIso:     string;
    endIso:       string;
    duration:     "1h" | "2h";
    intentId:     string;
    amountCents?: number;
  }): Stripe.Event {
    const intent: FakePaymentIntent = {
      id:            params.intentId,
      client_secret: `${params.intentId}_secret`,
      status:        "succeeded",
      amount:        params.amountCents ?? 4900,
      currency:      "eur",
      metadata: {
        student_email:    params.email,
        student_name:     params.name,
        checkout_type:    "single",
        session_duration: params.duration,
        start_iso:        params.startIso,
        end_iso:          params.endIso,
        reschedule_token: "",
      },
    };
    this.intents.set(params.intentId, intent);
    return {
      id:   `evt_${params.intentId}`,
      type: "payment_intent.succeeded",
      data: { object: intent },
    } as unknown as Stripe.Event;
  }
}
