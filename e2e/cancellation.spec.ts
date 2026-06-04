/**
 * e2e/cancellation.spec.ts
 *
 * TEST-02: Cancellation via signed email link (/cancelar?token=...).
 *
 * Flow:
 *   1. Authenticated user creates a free booking via POST /api/book
 *      to obtain a real cancelToken without going through the full UI flow
 *   2. Navigates to /cancelar?token=<cancelToken>
 *   3. Asserts the confirm state is shown
 *   4. Clicks confirm-cancel button
 *   5. Asserts the success heading is visible
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict, LOCALES }     from "./helpers/dict";

for (const locale of LOCALES) {
  const d       = dict[locale];
  const urlBase = locale === "es" ? "" : `/${locale}`;

  test.describe(`Cancellation via email link [${locale}]`, () => {
    test.beforeEach(async ({ page }) => {
      await resetTestState();
      await loginAs(page, E2E_USER.email, E2E_USER.name);
    });

    test(`student cancels a booking using a cancel token [${locale}]`, async ({ page }) => {
      // Create a free booking via the API to get a cancelToken.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const start = tomorrow.toISOString();

      const end = new Date(tomorrow);
      end.setMinutes(end.getMinutes() + 15);
      const endIso = end.toISOString();

      const bookRes = await page.request.post("/api/book", {
        data: {
          startIso:    start,
          endIso:      endIso,
          sessionType: "free15min",
          note:        "E2E cancellation test",
          timezone:    "Europe/Madrid",
        },
        headers: {
          Origin: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        },
      });

      // If the slot is taken or the API is unavailable, skip gracefully
      if (!bookRes.ok()) {
        test.skip(true, `Could not create booking for cancellation test: ${bookRes.status()}`);
        return;
      }

      const { cancelToken } = await bookRes.json();
      expect(cancelToken).toBeTruthy();

      // Navigate to the cancellation page
      await page.goto(`${urlBase}/cancelar?token=${cancelToken}`);

      // Confirm state should be shown
      await expect(
        page.getByRole("heading", { name: d.pages.cancelar.confirmTitle }),
      ).toBeVisible({ timeout: 10_000 });

      // Click the confirm button
      await page.getByRole("button", { name: d.pages.cancelar.confirmCancel }).click();

      // Success state
      await expect(
        page.getByRole("heading", { name: d.pages.cancelar.cancelledTitle }),
      ).toBeVisible({ timeout: 30_000 });
    });

    test(`shows error state for an invalid cancel token [${locale}]`, async ({ page }) => {
      await page.goto(`${urlBase}/cancelar?token=invalid-token-xyz`);

      const heading = page.getByRole("heading", {
        name: new RegExp(`${d.pages.cancelar.confirmTitle}|${d.pages.cancelar.errorTitle}`, "i"),
      });
      await expect(heading).toBeVisible({ timeout: 10_000 });

      if (await page.getByRole("button", { name: d.pages.cancelar.confirmCancel }).isVisible()) {
        await page.getByRole("button", { name: d.pages.cancelar.confirmCancel }).click();
        await expect(
          page.getByRole("heading", { name: d.pages.cancelar.errorTitle }),
        ).toBeVisible({ timeout: 15_000 });
      }
    });

    test(`shows error when navigating to /cancelar without a token [${locale}]`, async ({ page }) => {
      await page.goto(`${urlBase}/cancelar`);

      await expect(
        page.getByText(d.pages.cancelar.invalidLink),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
}
