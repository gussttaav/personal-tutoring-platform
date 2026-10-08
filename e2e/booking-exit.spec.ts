/**
 * e2e/booking-exit.spec.ts
 *
 * BOOKING-EXIT-01: the booking wizard can always be left, and its session type changed
 * without leaving it.
 *
 *   1. «Salir de la reserva» (top of every step) closes the wizard IN PLACE — the URL stays
 *   2. Browser back closes the wizard and stays on the page (one history entry per booking)
 *   3. The navbar item for the current page closes the wizard (it used to do nothing)
 *   4. The sidebar switches 1h → 2h inside the wizard; the «Pago» step stays, the wizard stays
 *   5. Switching to the free call drops the «Pago» step
 *   6. BOOKING-STEPS-01: the steps are clickable in order — «Revisión» once a slot is focused,
 *      «Horario» back from review, «Pago» never straight from the calendar
 *
 * No booking is made, so the spec needs no resetTestState (the global setup still truncates
 * the test DB once per run, like every local run).
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { dict }              from "./helpers/dict";

const d = dict.es;

async function openOneHourWizard(page: Page) {
  const session1h = page.getByRole("button", { name: new RegExp(d.booking.modeView.sessions.session1h.label, "i") });
  await expect(session1h).toBeVisible({ timeout: 15_000 });
  await session1h.click();
  await expect(exitButton(page)).toBeVisible({ timeout: 45_000 });
}

function exitButton(page: Page) {
  return page.getByRole("button", { name: d.booking.layout.exit });
}

test.describe("Leaving and adjusting the booking wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, E2E_USER.email, E2E_USER.name);
  });

  test("«Salir de la reserva» closes the wizard in place", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mentoria");
    await openOneHourWizard(page);

    await exitButton(page).click();
    await expect(exitButton(page)).toBeHidden();
    await expect(page).toHaveURL(/\/mentoria$/);
  });

  test("browser back closes the wizard and stays on the page", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mentoria");
    await openOneHourWizard(page);

    await page.goBack();
    await expect(exitButton(page)).toBeHidden();
    await expect(page).toHaveURL(/\/mentoria$/);
  });

  test("the navbar item for the current page closes the wizard", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mentoria");
    await openOneHourWizard(page);

    await page.getByRole("navigation").getByRole("link", { name: d.nav.mentoring, exact: true }).first().click();
    await expect(exitButton(page)).toBeHidden();
    await expect(page).toHaveURL(/\/mentoria$/);
  });

  test("the session type changes without leaving the wizard", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mentoria");
    await openOneHourWizard(page);

    const paymentStep = page.getByText(d.booking.wizardProgress.payment, { exact: true });
    await expect(paymentStep).toBeVisible();

    // 1h → 2h: still a paid session, still in the wizard
    const twoHours = page.getByRole("radio", { name: new RegExp(d.booking.modeView.sessions.session2h.label) });
    await twoHours.check({ force: true }); // the native radio is visually hidden inside its label
    await expect(twoHours).toBeChecked();
    await expect(exitButton(page)).toBeVisible();
    await expect(paymentStep).toBeVisible();

    // → free call: no payment step
    const free = page.getByRole("radio", { name: new RegExp(d.booking.modeView.sessions.free15min.label) });
    await free.check({ force: true });
    await expect(free).toBeChecked();
    await expect(paymentStep).toBeHidden();
    await expect(page).toHaveURL(/\/mentoria$/);
  });

  test("the steps are clickable in order", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mentoria");
    await openOneHourWizard(page);

    const steps      = page.getByRole("navigation", { name: d.booking.wizardProgress.ariaLabel });
    const reviewStep = steps.getByRole("button", { name: d.booking.wizardProgress.review });
    const payStep    = steps.getByRole("button", { name: d.booking.wizardProgress.payment });

    // Nothing to jump to before a slot is chosen
    await expect(reviewStep).toHaveCount(0);
    await expect(payStep).toHaveCount(0);

    // Focus the first slot that forms a valid 60-min block (as booking-single.spec.ts does)
    await page.getByRole("button", { name: d.booking.weeklyCalendar.nextWeek }).click();
    const availableAt = new RegExp(d.booking.weeklyCalendar.availableAt.replace("{timeLabel}", "\\d{2}:\\d{2}"));
    const slots = page.getByRole("button", { name: availableAt });
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    const continuar = page.getByRole("button", { name: new RegExp(`^${d.booking.singleSession.continueButton}$`, "i") });
    let focused = false;
    for (let i = 0, n = await slots.count(); i < n && !focused; i++) {
      await slots.nth(i).click();
      focused = await continuar.waitFor({ state: "visible", timeout: 500 }).then(() => true, () => false);
    }
    expect(focused, "no contiguous 60-min slot was available").toBe(true);

    // A focused slot opens «Revisión», still not «Pago»
    await expect(payStep).toHaveCount(0);
    await reviewStep.click();
    const confirmPay = page.getByRole("button", { name: new RegExp(d.booking.singleSession.confirmPay, "i") });
    await expect(confirmPay).toBeVisible({ timeout: 10_000 });
    await expect(payStep).toBeVisible();

    // «Horario» goes back to the calendar with the slot still focused
    await steps.getByRole("button", { name: d.booking.wizardProgress.schedule }).click();
    await expect(confirmPay).toBeHidden();
    await expect(continuar).toBeVisible();
    await expect(page).toHaveURL(/\/mentoria$/);
  });
});
