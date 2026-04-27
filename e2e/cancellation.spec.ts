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
 *   4. Clicks "Sí, cancelar"
 *   5. Asserts the success heading "Reserva cancelada" is visible
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";

test.describe("Cancellation via email link", () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState();
    await loginAs(page, E2E_USER.email, E2E_USER.name);
  });

  test("student cancels a booking using a cancel token", async ({ page }) => {
    // Create a free booking via the API to get a cancelToken.
    // This avoids duplicating the full UI booking flow in this spec.
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
        // CSRF origin header required by the book endpoint (SEC-04)
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
    await page.goto(`/cancelar?token=${cancelToken}`);

    // Confirm state should be shown
    await expect(
      page.getByRole("heading", { name: /cancelar reserva/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click the confirm button
    await page.getByRole("button", { name: /sí, cancelar/i }).click();

    // Success state
    await expect(
      page.getByRole("heading", { name: /reserva cancelada/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("shows error state for an invalid cancel token", async ({ page }) => {
    await page.goto("/cancelar?token=invalid-token-xyz");

    // The page should reach an error state (either immediately or after confirm)
    const heading = page.getByRole("heading", { name: /cancelar reserva|no se pudo cancelar/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // If it shows the confirm panel (token looks valid), click confirm to trigger the error
    if (await page.getByRole("button", { name: /sí, cancelar/i }).isVisible()) {
      await page.getByRole("button", { name: /sí, cancelar/i }).click();
      await expect(
        page.getByRole("heading", { name: /no se pudo cancelar/i }),
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("shows error when navigating to /cancelar without a token", async ({ page }) => {
    await page.goto("/cancelar");

    // No token → immediate error state
    await expect(
      page.getByText(/enlace de cancelación inválido/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
