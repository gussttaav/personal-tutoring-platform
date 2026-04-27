/**
 * e2e/booking-single.spec.ts
 *
 * TEST-02: Single paid session (1h) purchase flow.
 *
 * Flow:
 *   1. Authenticated user lands on the homepage
 *   2. Clicks "Sesión de 1 hora"
 *   3. Navigates to next week and picks a slot (1st click = focus → "Continuar" = select)
 *   4. Review step: clicks "Confirmar pago" → Stripe PaymentElement mounts
 *   5. Fills Stripe test card details
 *   6. Clicks "Pagar" → asserts redirect to /sesion-confirmada
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";

test.describe("Single 1-hour session purchase", () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState();
    await loginAs(page, E2E_USER.email, E2E_USER.name);
  });

  test("student purchases a 1-hour session and reaches confirmation", async ({ page }) => {
    // Stripe Elements mount + payment confirm + redirect can exceed 60 s on a
    // cold dev server (Next.js compile + Stripe round-trips).
    test.setTimeout(180_000);
    await page.goto("/");

    // Wait for session cards to appear (auth skeleton replaces with real data)
    await expect(page.getByRole("button", { name: /sesión de 1 hora/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open the 1h session booking overlay
    await page.getByRole("button", { name: /sesión de 1 hora/i }).click();

    // Navigate to next week for guaranteed future slots
    await page.getByRole("button", { name: /semana siguiente/i }).click();

    // Pick the first slot that forms a valid 60-min block. Some "available"
    // 30-min cells are isolated (e.g., 10:00 with 10:30 already booked) —
    // clicking them just flashes invalid and never focuses, so "Continuar"
    // never appears. Iterate until a valid block focuses.
    const slots = page.getByRole("button", { name: /Disponible a las \d{2}:\d{2}/ });
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    const continuar = page.getByRole("button", { name: /^continuar$/i });

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

    // Review step: "Confirmar pago" transitions to the Stripe payment form
    await expect(
      page.getByRole("button", { name: /confirmar pago/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /confirmar pago/i }).click();

    // Wait for the Stripe PaymentElement iframe to fully mount.
    // Stripe Elements has variable cold-start latency — allow 45 s.
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    const cardNumber = stripeFrame.locator('input[name="number"], input[autocomplete="cc-number"]');
    await expect(cardNumber).toBeVisible({ timeout: 45_000 });

    await cardNumber.fill("4242424242424242");
    await stripeFrame.locator('input[name="expiry"], input[autocomplete="cc-exp"]').fill("12/30");
    await stripeFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill("123");
    // Stripe Elements shows a ZIP field when geolocated to the US (e.g. GitHub Actions runners).
    // Fill it only if present — it may not appear in all locales.
    const zipInput = stripeFrame.locator('input[name="postalCode"], input[autocomplete="postal-code"]');
    if (await zipInput.isVisible().catch(() => false)) {
      await zipInput.fill("10001");
    }

    // Submit Stripe payment
    await page.getByRole("button", { name: /^pagar$/i }).click();

    // Should reach the payment confirmation page.
    // Wrap with diagnostic capture so CI failures show the exact Stripe error
    // instead of just a URL timeout.
    try {
      await expect(page).toHaveURL(/\/sesion-confirmada/, { timeout: 30_000 });
    } catch {
      const alertText = await page.getByRole("alert").first().textContent().catch(() => null);
      throw new Error(
        `Payment did not redirect to /sesion-confirmada.${alertText ? ` Stripe error: "${alertText}"` : ""}`,
      );
    }
    await expect(
      page.getByRole("heading", { name: /pago confirmado/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
