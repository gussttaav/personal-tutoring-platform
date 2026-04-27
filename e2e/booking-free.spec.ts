/**
 * e2e/booking-free.spec.ts
 *
 * TEST-02: Free 15-min session ("Encuentro inicial") booking flow.
 *
 * Flow:
 *   1. Authenticated user lands on the homepage
 *   2. Clicks the "Encuentro inicial" session card
 *   3. Navigates to the next calendar week (current week may be mostly past)
 *   4. Clicks the first available slot (1st click = focus), then "Continuar" (select)
 *   5. Confirms in the review step → asserts inline success ("Volver al inicio" button)
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";

test.describe("Free 15-min session booking", () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState();
    await loginAs(page, E2E_USER.email, E2E_USER.name);
  });

  test("student books a free encuentro inicial", async ({ page }) => {
    // Cold-start dev server + availability fetch + booking orchestration
    // (Calendar/Zoom/email/QStash) regularly exceeds the global 60 s.
    test.setTimeout(120_000);
    await page.goto("/");

    // Wait for the auth state to settle (skeleton cards replaced by real cards)
    await expect(page.getByRole("button", { name: /encuentro inicial/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open the free session calendar
    await page.getByRole("button", { name: /encuentro inicial/i }).click();

    // Navigate to next week — the current week may be mostly past or within the
    // minimum-notice window (5 h), leaving no available slots visible.
    await page.getByRole("button", { name: /semana siguiente/i }).click();

    // Wait for slot buttons to load for the new week.
    // Availability fetch + Next.js cold compile can take > 25 s on the first
    // spec to hit the calendar — allow 45 s (matches booking-pack/single).
    const firstSlot = page.getByRole("button", { name: /Disponible a las \d{2}:\d{2}/ }).first();
    await expect(firstSlot).toBeVisible({ timeout: 45_000 });

    // 1st click → focuses the block in the calendar
    await firstSlot.click();

    // "Continuar" appears once a slot is focused; click it to confirm selection
    await page.getByRole("button", { name: /continuar/i }).click();

    // Review step — confirm the booking
    const confirmBtn = page.getByRole("button", { name: /confirmar/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    await confirmBtn.click();

    // Free sessions show success inline — SingleSessionBooking renders the success
    // state in-place, the URL stays at "/". Assert the "Volver al inicio" button.
    await expect(
      page.getByRole("button", { name: /volver al inicio/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
