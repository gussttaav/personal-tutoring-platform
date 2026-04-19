// ARCH-14: Thin typed wrapper over the Stripe SDK for dependency injection.
// Allows PaymentService to be unit-tested with a fake implementation.
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export interface IStripeClient {
  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event;
  getPriceAmount(priceId: string): Promise<{ amount: number; currency: string }>;
  createPaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent>;
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

  async createPaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.create(params);
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.retrieve(id);
  }

  async retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    return stripe.checkout.sessions.retrieve(id);
  }

  async createRefund(params: { payment_intent?: string; charge?: string; reason: "duplicate" }): Promise<void> {
    await stripe.refunds.create(params as Parameters<typeof stripe.refunds.create>[0]);
  }
}
