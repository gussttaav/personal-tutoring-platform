/**
 * e2e/booking-personal-area.spec.ts
 *
 * Booking from /area-personal opens IN PLACE — no detour through /mentoria.
 *
 * The personal area mounts `BookingOverlays` itself, so its CTAs open the wizard over the
 * dashboard instead of `router.push("/mentoria?book=…")`. This spec pins the three things
 * that make that true:
 *   1. Clicking «Encuentro Inicial» in the booking sidebar opens the calendar while the URL
 *      stays at /area-personal (the old path navigated to /mentoria first)
 *   2. The booking itself works from there (same steps as booking-free.spec.ts)
 *   3. The success screen's «Ir a mi área personal» closes the wizard in place and the new
 *      class shows up in «Próxima clase» — the page revalidates its list on that close
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict }              from "./helpers/dict";

const d = dict.es;

test.describe("Booking from the personal area", () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState();
    await loginAs(page, E2E_USER.email, E2E_USER.name);
  });

  test("student books a free encuentro inicial without leaving /area-personal", async ({ page }) => {
    // Cold-start dev server + availability fetch + booking orchestration
    // (Calendar/Zoom/email/QStash) regularly exceeds the global 60 s.
    test.setTimeout(120_000);
    await page.goto("/area-personal");

    // The booking sidebar renders once the page mounts; its rows are the CTAs.
    const freeRow = page.getByRole("button", { name: new RegExp(d.areaPersonal.bookPanel.sessions.free15min.label, "i") });
    await expect(freeRow).toBeVisible({ timeout: 15_000 });
    await freeRow.click();

    // The calendar opened over the dashboard — the URL did not change.
    await expect(page.getByRole("button", { name: /semana siguiente/i })).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(/\/area-personal$/);

    // Navigate to next week — the current week may be mostly past or within the
    // minimum-notice window, leaving no available slots visible.
    await page.getByRole("button", { name: /semana siguiente/i }).click();

    const firstSlot = page.getByRole("button", { name: /Disponible a las \d{2}:\d{2}/ }).first();
    await expect(firstSlot).toBeVisible({ timeout: 45_000 });

    // 1st click → focuses the block in the calendar; "Continuar" confirms the selection
    await firstSlot.click();
    await page.getByRole("button", { name: /continuar/i }).click();

    // Review step — confirm the booking
    const confirmBtn = page.getByRole("button", { name: /confirmar/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    await confirmBtn.click();

    // Success screen. On the personal area «Ir a mi área personal» is an in-place close and
    // the ghost «Volver al inicio» is not rendered (both would do the same thing).
    const goToPersonalArea = page.getByRole("button", { name: new RegExp(d.booking.singleSession.goToPersonalArea, "i") });
    await expect(goToPersonalArea).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /volver al inicio/i })).toHaveCount(0);
    await goToPersonalArea.click();

    // Still on the personal area, wizard gone, and the just-booked class is the next one.
    await expect(page).toHaveURL(/\/area-personal$/);
    await expect(goToPersonalArea).toHaveCount(0);
    await expect(page.getByText(d.areaPersonal.nextSession.title, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
