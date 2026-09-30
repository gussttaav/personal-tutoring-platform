// ARCH-14: Thin typed wrapper over the Stripe SDK for dependency injection.
// Allows PaymentService to be unit-tested with a fake implementation.
//
// REFACTOR-P1-05: createPaymentIntent accepts an optional idempotencyKey so
// client retries / double-clicks produce the same PaymentIntent instead of
// minting duplicates.
//
// REFACTOR-R4-P3-01: listPaymentIntents pages the recent PaymentIntents for the
// reconciliation cron, which used to call the stripe singleton from its route.
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

export interface IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event;
  createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
    options?: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent>;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  listPaymentIntents(params: ListPaymentIntentsParams): Promise<{ data: Stripe.PaymentIntent[]; hasMore: boolean }>;
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session>;
  createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void>;
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

  async createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void> {
    await stripe.refunds.create(params as Parameters<typeof stripe.refunds.create>[0]);
  }
}
