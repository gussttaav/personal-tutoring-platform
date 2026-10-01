// ARCH-14: Thin typed wrapper over the Stripe SDK for dependency injection.
// Allows PaymentService to be unit-tested with a fake implementation.
//
// REFACTOR-P1-05: createPaymentIntent accepts an optional idempotencyKey so
// client retries / double-clicks produce the same PaymentIntent instead of
// minting duplicates.
//
// REFACTOR-R4-P3-01: listPaymentIntents pages the recent PaymentIntents for the
// reconciliation cron, which used to call the stripe singleton from its route.
//
// REFACTOR-R4-P3-03: retrievePaymentForAudit flattens a PaymentIntent and its latest charge
// (where the refund and dispute state live) into PaymentAuditFacts for the booking-payment
// audit, so no Stripe type reaches BookingPaymentAuditService.
//
// REFACTOR-R4-P4-01: createRefund accepts an idempotencyKey too, so a webhook retry after a
// failed refund-record write gets the SAME refund back instead of charge_already_refunded.
import type Stripe from "stripe";
import { stripe } from "@/infrastructure/stripe/client-singleton";

export interface CreatePaymentIntentOptions {
  idempotencyKey?: string;
}

export interface ListPaymentIntentsParams {
  createdGte:     number; // unix seconds
  startingAfter?: string;
  limit:          number;
}

// REFACTOR-R4-P3-03: what the booking-payment audit needs to know about a payment.
export interface PaymentAuditFacts {
  status:          string;          // PaymentIntent.status
  amount:          number;
  amountRefunded:  number;          // latest_charge.amount_refunded, 0 if no charge
  disputed:        boolean;         // latest_charge.disputed
  checkoutType:    string | null;   // metadata.checkout_type
  sessionDuration: string | null;   // metadata.session_duration
  studentEmail:    string | null;   // metadata.student_email
}

export interface IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event;
  createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent>;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  listPaymentIntents(params: ListPaymentIntentsParams): Promise<{ data: Stripe.PaymentIntent[]; hasMore: boolean }>;
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session>;
  createRefund(
    params: { payment_intent?: string; charge?: string; reason: "duplicate" },
    options?: { idempotencyKey?: string },
  ): Promise<void>;
  /** REFACTOR-R4-P3-03: null when Stripe has no such PaymentIntent (resource_missing).
   *  Any other error propagates. */
  retrievePaymentForAudit(id: string): Promise<PaymentAuditFacts | null>;
}

// A Stripe "No such payment_intent" — the only error the audit reads as an answer.
function isResourceMissing(err: unknown): boolean {
  const e = err as { type?: unknown; code?: unknown } | null;
  return e?.type === "StripeInvalidRequestError" && e.code === "resource_missing";
}

export class StripeClient implements IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event {
    return stripe.webhooks.constructEvent(body, sig, secret);
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

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.retrieve(id);
  }

  async listPaymentIntents(
    params: ListPaymentIntentsParams,
  ): Promise<{ data: Stripe.PaymentIntent[]; hasMore: boolean }> {
    const page = await stripe.paymentIntents.list({
      created: { gte: params.createdGte },
      limit:   params.limit,
      ...(params.startingAfter ? { starting_after: params.startingAfter } : {}),
    });
    return { data: page.data, hasMore: page.has_more };
  }

  async retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    return stripe.checkout.sessions.retrieve(id);
  }

  // REFACTOR-R4-P4-01: refunds are keyed like PaymentIntents (REFACTOR-P1-05), so a webhook
  // retry after a failed refund-record write gets the SAME refund back instead of an error.
  async createRefund(
    params: { payment_intent?: string; charge?: string; reason: "duplicate" },
    options?: { idempotencyKey?: string },
  ): Promise<void> {
    // No cast: Parameters<> of the SDK's create is its options-only overload.
    await stripe.refunds.create(
      params,
      options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    );
  }

  async retrievePaymentForAudit(id: string): Promise<PaymentAuditFacts | null> {
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] });
    } catch (err) {
      if (isResourceMissing(err)) return null;
      throw err;
    }

    // An unexpanded charge would read as "never refunded": fail instead.
    if (typeof intent.latest_charge === "string") {
      throw new Error(`Stripe returned latest_charge unexpanded for ${id}`);
    }
    const charge = intent.latest_charge;

    return {
      status:          intent.status,
      amount:          intent.amount,
      amountRefunded:  charge?.amount_refunded ?? 0,
      disputed:        charge?.disputed ?? false,
      checkoutType:    intent.metadata?.checkout_type    ?? null,
      sessionDuration: intent.metadata?.session_duration ?? null,
      studentEmail:    intent.metadata?.student_email    ?? null,
    };
  }
}
