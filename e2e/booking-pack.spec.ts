/**
 * e2e/booking-pack.spec.ts
 *
 * TEST-02: Pack purchase → book a session → cancel it flow.
 *
 * Flow:
 *   1. Authenticated user lands on the homepage
 *   2. Acquires pack credits (live Stripe payment in one locale; seeded in the
 *      other — see the locale note below)
 *   3. Books a pack session using the credits
 *   4. Navigates to /area-personal and asserts the booking is listed (NextSessionCard)
 *   5. Cancels inline via NextSessionCard and asserts card disappears
 *
 * Locale note: only ONE locale performs the live Stripe payment. Stripe's
 * PaymentElement is not localized by our app (we pass no locale to Elements),
 * so a 2nd live mount in the same run adds no coverage AND trips a Stripe-side
 * throttle on repeated Elements sessions (the form gets stuck on "loading").
 * The other locale seeds credits and still exercises the localized book +
 * cancel UI.
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { seedPackCredits }   from "./fixtures/seed";
import { dict, LOCALES }     from "./helpers/dict";
import { fillStripeCard }    from "./helpers/stripe";

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

      // Acquire pack credits. Only [es] pays live through Stripe (see the
      // locale note at the top of the file); [en] seeds credits directly.
      if (locale === "es") {
        await page.goto(`${urlBase}/`);

        // Wait for pack cards, then open the Pack Esencial (first / cheapest) modal.
        const buyPackPattern = new RegExp(d.booking.packCard.buyPack.replace("{price}", "").trim().replace(/[·]/g, "").trim(), "i");
        await expect(page.getByRole("button", { name: buyPackPattern }).first()).toBeVisible({
          timeout: 15_000,
        });
        await page.getByRole("button", { name: buyPackPattern }).first().click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });

        // Fill the Stripe PaymentElement and pay.
        await fillStripeCard(page);
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
      } else {
        await seedPackCredits(E2E_USER.email, E2E_USER.name);
      }

      // ── Book a pack session using the credits (live or seeded) ──
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
      await page.getByRole("button", { name: new RegExp(d.common.cancel, "i") }).first().click();

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
