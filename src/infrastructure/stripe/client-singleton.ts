/**
 * lib/stripe.ts — singleton Stripe client
 *
 * ARCH-01: Previously every route that needed Stripe defined its own local
 * getStripe() function and called new Stripe(key) on every request.
 * Instantiation is not free — it parses the API version, sets up the HTTP
 * agent, and allocates internal state. On a busy serverless function this
 * adds measurable cold-path overhead and wastes memory.
 *
 * This module creates the instance once per process lifetime (warm Lambda /
 * Vercel function) and re-uses it on subsequent requests.
 *
 * Usage — replace every local getStripe() call with:
 *   import { stripe } from "@/lib/stripe";
 */

import Stripe from "stripe";

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Module-level singleton — created once when the module is first imported.
// On Vercel, each serverless function instance keeps this alive across warm
// invocations, so subsequent requests within the same instance skip the
// constructor entirely.
export const stripe = createStripeClient();
