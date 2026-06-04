/**
 * e2e/booking-single.spec.ts
 *
 * TEST-02: Single paid session (1h) purchase flow.
 *
 * Flow:
 *   1. Authenticated user lands on the homepage
 *   2. Clicks the 1-hour session button
 *   3. Navigates to next week and picks a slot
 *   4. Review step: clicks confirm-pay → Stripe PaymentElement mounts
 *   5. Fills Stripe test card details
 *   6. Clicks pay → asserts redirect to /sesion-confirmada
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict, LOCALES }     from "./helpers/dict";

for (const locale of LOCALES) {
  const d       = dict[locale];
  const urlBase = locale === "es" ? "" : `/${locale}`;

  test.describe(`Single 1-hour session purchase [${locale}]`, () => {
    test.beforeEach(async ({ page }) => {
      await resetTestState();
      await loginAs(page, E2E_USER.email, E2E_USER.name);
    });

    test(`student purchases a 1-hour session and reaches confirmation [${locale}]`, async ({ page }) => {
      // Stripe Elements mount + payment confirm + redirect can exceed 60 s on a
      // cold dev server (Next.js compile + Stripe round-trips).
      test.setTimeout(180_000);
      await page.goto(`${urlBase}/`);

      const session1hLabel = d.booking.modeView.sessions.session1h.label;

      // Wait for session cards to appear (auth skeleton replaces with real data)
      await expect(page.getByRole("button", { name: new RegExp(session1hLabel, "i") })).toBeVisible({
        timeout: 15_000,
      });

      // Open the 1h session booking overlay
      await page.getByRole("button", { name: new RegExp(session1hLabel, "i") }).click();

      // Navigate to next week for guaranteed future slots
      await page.getByRole("button", { name: d.booking.weeklyCalendar.nextWeek }).click();

      // Pick the first slot that forms a valid 60-min block.
      const availableAtPattern = new RegExp(d.booking.weeklyCalendar.availableAt.replace("{timeLabel}", "\\d{2}:\\d{2}"));
      const slots = page.getByRole("button", { name: availableAtPattern });
      await expect(slots.first()).toBeVisible({ timeout: 15_000 });
      const continuar = page.getByRole("button", { name: new RegExp(`^${d.booking.singleSession.continueButton}$`, "i") });

      const slotCount = await slots.count();
      let pickedSlot = false;
      for (let i = 0; i < slotCount; i++) {
        await slots.nth(i).click();
        try {
          await continuar.waitFor({ state: "visible", timeout: 500 });
          pickedSlot = true;
          break;
        } catch {
          // Isolated slot — try the next one
        }
      }
      expect(pickedSlot, "no contiguous 60-min slot was available").toBe(true);
      await continuar.click();

      // Review step: confirm-pay transitions to the Stripe payment form
      const confirmPayBtn = page.getByRole("button", { name: new RegExp(d.booking.singleSession.confirmPay, "i") });
      await expect(confirmPayBtn).toBeVisible({ timeout: 10_000 });
      await confirmPayBtn.click();

      // Wait for the Stripe PaymentElement iframe to fully mount.
      const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      const cardNumber = stripeFrame.locator('input[name="number"], input[autocomplete="cc-number"]');
      await expect(cardNumber).toBeVisible({ timeout: 45_000 });

      await cardNumber.fill("4242424242424242");
      await stripeFrame.locator('input[name="expiry"], input[autocomplete="cc-exp"]').fill("12/30");
      await stripeFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill("123");
      const zipInput = stripeFrame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
      if (await zipInput.isVisible().catch(() => false)) {
        await zipInput.fill("10001");
      }

      // Submit Stripe payment
      await page.getByRole("button", { name: /^pagar(\s|$)|^pay(\s|$)/i }).click();

      // Should reach the payment confirmation page.
      try {
        await expect(page).toHaveURL(/\/sesion-confirmada/, { timeout: 30_000 });
      } catch {
        const alertText = await page.getByRole("alert").first().textContent().catch(() => null);
        throw new Error(
          `Payment did not redirect to /sesion-confirmada.${alertText ? ` Stripe error: "${alertText}"` : ""}`,
        );
      }
      await expect(
        page.getByRole("heading", { name: d.pages.sesionConfirmada.successTitle }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
}
