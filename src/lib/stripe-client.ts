/**
 * lib/stripe-client.ts — browser-side Stripe singleton
 *
 * Separate from the server-side singleton in lib/stripe.ts.
 *
 * Uses a lazy initialiser so the module is safe to import in
 * server-side code (e.g. during Next.js static prerendering) without
 * requiring NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY at build time. The
 * actual loadStripe() call — and the env-var check — only executes
 * when getStripePromise() is first invoked from a client component.
 */

import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";

type StripePromise = Promise<Stripe | null>;

let cache: StripePromise | null = null;

/** Returns the cached Stripe.js promise, initialising it on first call. */
export function getStripePromise(): StripePromise {
  if (!cache) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
    cache = loadStripe(key);
  }
  return cache;
}
