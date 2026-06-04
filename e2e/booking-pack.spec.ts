/**
 * e2e/booking-pack.spec.ts
 *
 * TEST-02: Pack purchase → book a session → cancel it flow.
 *
 * Flow:
 *   1. Authenticated user lands on the homepage
 *   2. Clicks "Buy pack" (Pack Esencial — 5 sessions)
 *   3. Enters Stripe test card details in the embedded Elements iframe
 *   4. Completes payment and waits for SSE credit confirmation on /pago-exitoso
 *   5. Books a pack session using the new credits
 *   6. Navigates to /area-personal and asserts the booking is listed (NextSessionCard)
 *   7. Cancels inline via NextSessionCard and asserts card disappears
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict, LOCALES }     from "./helpers/dict";

for (const locale of LOCALES) {
  const d       = dict[locale];
  const urlBase = locale === "es" ? "" : `/${locale}`;

  test.describe(`Pack purchase + book + cancel [${locale}]`, () => {
    test.beforeEach(async ({ page }) => {
      await resetTestState();
      await loginAs(page, E2E_USER.email, E2E_USER.name);
    });

    test(`student purchases Pack Esencial, books a session, then cancels it [${locale}]`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`${urlBase}/`);

      // Wait for pack cards to load.
      const buyPackPattern = new RegExp(d.booking.packCard.buyPack.replace("{price}", "").trim().replace(/[·]/g, "").trim(), "i");
      await expect(page.getByRole("button", { name: buyPackPattern }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Click Pack Esencial (first / cheapest pack)
      await page.getByRole("button", { name: buyPackPattern }).first().click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });

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

      // Submit the payment
      await page.getByRole("button", { name: /^pagar(\s|$)|^pay(\s|$)/i }).click();

      try {
        await expect(page).toHaveURL(/\/pago-exitoso/, { timeout: 30_000 });
      } catch {
        const alertText = await page.getByRole("alert").first().textContent().catch(() => null);
        throw new Error(
          `Payment did not redirect to /pago-exitoso.${alertText ? ` Stripe error: "${alertText}"` : ""}`,
        );
      }
      await expect(
        page.getByRole("button", { name: new RegExp(d.pages.pagoExitoso.bookMyClasses, "i") }),
      ).toBeEnabled({ timeout: 60_000 });

      // Navigate back to book a session using the new credits
      await page.goto(`${urlBase}/`);
      const initialMeetingPattern = new RegExp(d.booking.packCard.bookClass, "i");
      await expect(page.getByRole("button", { name: initialMeetingPattern }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Book a pack session (available because we now have credits).
      await page.getByRole("button", { name: new RegExp(d.booking.packCard.bookClass, "i") }).first().click();

      // Navigate to next week for guaranteed future slots
      await page.getByRole("button", { name: d.booking.weeklyCalendar.nextWeek }).click();

      const availableAtPattern = new RegExp(d.booking.weeklyCalendar.availableAt.replace("{timeLabel}", "\\d{2}:\\d{2}"));
      const slots = page.getByRole("button", { name: availableAtPattern });
      await expect(slots.first()).toBeVisible({ timeout: 45_000 });
      const confirmBtn = page.getByRole("button", { name: new RegExp(d.booking.modeView.confirmBook, "i") });

      const slotCount = await slots.count();
      let pickedSlot = false;
      for (let i = 0; i < slotCount; i++) {
        const slot = slots.nth(i);
        await slot.click();
        await slot.click();
        try {
          await confirmBtn.waitFor({ state: "visible", timeout: 1500 });
          pickedSlot = true;
          break;
        } catch {
          // Isolated slot — try the next one
        }
      }
      expect(pickedSlot, "no contiguous 60-min slot was available").toBe(true);
      await confirmBtn.click();

      // Success banner
      await expect(page.getByText(d.booking.modeView.successBook)).toBeVisible({ timeout: 60_000 });

      // Navigate to personal area
      await page.goto(`${urlBase}/area-personal`);
      await expect(page.getByText(d.areaPersonal.nextSession.title, { exact: true })).toBeVisible({
        timeout: 15_000,
      });

      // Cancel the booking
      await page.getByRole("button", { name: new RegExp(d.areaPersonal.nextSession.reschedule, "i") }).first().click();

      // Inline confirm panel
      await expect(page.getByRole("button", { name: d.areaPersonal.nextSession.confirmCancel })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole("button", { name: d.areaPersonal.nextSession.confirmCancel }).click();

      // NextSessionCard disappears once bookings refresh.
      await expect(page.getByText(d.areaPersonal.nextSession.title, { exact: true })).not.toBeVisible({
        timeout: 30_000,
      });
    });
  });
}
