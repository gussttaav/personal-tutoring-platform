/**
 * e2e/helpers/stripe.ts
 *
 * Shared Stripe PaymentElement interaction for the booking specs.
 *
 * The checkout → Elements mount chain is the flakiest part of the suite against
 * a Vercel preview deployment. Two distinct failure modes both surface as a
 * missing card iframe:
 *   1. The checkout request failed (cold serverless function, 4xx/5xx) → the
 *      page renders an error Alert and the iframe never appears.
 *   2. Stripe never initializes the PaymentElement → the form sits on
 *      "Loading payment form…" forever (no error, no iframe).
 *
 * A bare `expect(cardNumber).toBeVisible()` collapses both into a generic
 * "element(s) not found". `fillStripeCard` waits for the iframe and, only when
 * it never appears, consults a role="alert" to name the cause — failed checkout
 * (alert with text) vs. Stripe.js / mount latency (no alert).
 *
 * The alert is consulted only AFTER the iframe wait times out, never raced
 * against it: the homepage carries a permanently-mounted empty role="alert"
 * region, so racing would let that empty alert beat a healthy-but-slow iframe
 * and make the helper itself flaky. Empty alert text is ignored.
 *
 * NB: only one locale per spec performs a live Stripe payment (Stripe's form is
 * not localized by us, and repeated live Elements sessions in one run trip a
 * Stripe-side throttle). So this helper does not retry — a single mount per run
 * is reliable; a failure here is a real signal, not the rapid-session flake.
 */

import { expect, type Page } from "@playwright/test";

const CARD_IFRAME = 'iframe[name^="__privateStripeFrame"]';
const IFRAME_TIMEOUT = 60_000;

/**
 * Waits for the Stripe card iframe to mount, then fills in the standard test
 * card (4242…). Throws an actionable error (naming checkout failure vs. mount
 * latency) rather than a generic locator timeout.
 */
export async function fillStripeCard(page: Page): Promise<void> {
  const stripeFrame = page.frameLocator(CARD_IFRAME).first();
  const cardNumber  = stripeFrame.locator('input[name="number"], input[autocomplete="cc-number"]');

  try {
    await expect(cardNumber).toBeVisible({ timeout: IFRAME_TIMEOUT });
  } catch {
    // The iframe never mounted. If the page is showing an error Alert (with
    // text), the checkout request failed — surface it. Otherwise checkout
    // succeeded but Stripe.js / the PaymentElement was too slow to mount.
    const errorAlert = page.getByRole("alert").first();
    const alertText  = (await errorAlert.isVisible().catch(() => false))
      ? (await errorAlert.textContent().catch(() => null))?.trim()
      : null;

    throw new Error(
      alertText
        ? `Stripe payment form failed to load — the page showed an error: "${alertText}". ` +
          `POST /api/stripe/checkout most likely failed (cold serverless function or 4xx/5xx).`
        : `Stripe card iframe never became visible within ${IFRAME_TIMEOUT}ms. Checkout may have ` +
          `succeeded but Stripe.js / the PaymentElement did not mount (js.stripe.com or Vercel latency).`,
    );
  }

  await cardNumber.fill("4242424242424242");
  await stripeFrame.locator('input[name="expiry"], input[autocomplete="cc-exp"]').fill("12/30");
  await stripeFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill("123");
  const zipInput = stripeFrame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
  if (await zipInput.isVisible().catch(() => false)) {
    await zipInput.fill("10001");
  }
}
