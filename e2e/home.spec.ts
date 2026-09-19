/**
 * e2e/home.spec.ts
 *
 * REDESIGN-P3-02: the home (`/`) after the redesign — the one page with no spec of its own,
 * and whose two CTAs are the new bridge into the booking.
 *
 * What is pinned, and why each is here rather than in the booking specs:
 *   - The menu order (Inicio · Cursos · Mentoría · Blog) — a locked decision of the cycle.
 *   - «Ver disponibilidad» opens the calendar ON `/` and a slot pick continues without leaving
 *     `/`: to the sign-in gate («reservar la hora elegida») signed out, to the free-15 review step
 *     with the slot pre-selected for a signed-in first-timer. The signed-in case stops at the
 *     review step (the confirm button, «Gratis», the appointment details): booking-free already
 *     pins the confirm → success half on `/mentoria`, and what is new here is the entry path.
 *   - «Reservar sesión ahora» opens the smart-book surface on `/`: the gate («reservar una
 *     sesión») signed out, the free-15 wizard signed in.
 *   - The OAuth callbackUrl behind a gate opened on `/` points at `/mentoria?intent=…` — the
 *     popup-blocked full-redirect fallback (P0-02's deep links). The popup sign-in never reads
 *     it (P1-06 resumes in place), so it is read off the popup's URL: `window.open` is caught as
 *     Playwright's `popup` event and its `/auth/signin-popup` navigation is fulfilled with an
 *     empty page so no real OAuth starts.
 *   - The footer's «Pregunta al asistente IA» opens the chat panel on `/` (the FAB is mounted
 *     through `HomeChat`, not the sections, on this page).
 *   - The courses band shows the catalog's cards (same count as `/cursos`) and the posts band
 *     the two newest posts in `/blog`'s order.
 *
 * Signed-out tests need no DB. The signed-in tests reset the test state and log in through the
 * e2e auth endpoint, like the booking specs; the free-15 booking is never confirmed here.
 *
 * TIMEOUTS: the calendar and the wizard are `next/dynamic` chunks on this page, fetched on the
 * first click, on top of the availability fetch — under `pnpm dev` the first spec to open them
 * pays for their compile too. 45 s for the first slot matches booking-free / booking-pack.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict }              from "./helpers/dict";

const d = dict.es;

/** Home path only — the CTAs must open in place, so every assertion below ends on this. */
const HOME_URL = /^https?:\/\/[^/]+\/$/;

/**
 * Opens «Ver disponibilidad», moves to next week (the current one may be past or inside the
 * minimum-notice window), picks the first free slot and confirms it in the modal's footer.
 */
async function pickSlotFromAvailability(page: Page): Promise<void> {
  await page.getByRole("button", { name: d.landing.hero.cta.availability, exact: true }).click();

  const calendar = page.getByRole("dialog", { name: d.booking.availabilityModal.viewAvailability });
  await expect(calendar).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(HOME_URL);

  await calendar.getByRole("button", { name: d.booking.availabilityModal.nextWeek }).click();

  // The modal's slot cells carry a literal, non-localised label (pre-existing, noted in P1-01).
  const firstSlot = calendar.getByRole("button", { name: "Hora disponible" }).first();
  await expect(firstSlot).toBeVisible({ timeout: 45_000 });
  await firstSlot.click();

  // 1st click focuses the slot and reveals the confirmation footer; «Confirmar» selects it.
  await calendar.getByRole("button", { name: d.booking.availabilityModal.confirm, exact: true }).click();
}

/**
 * Clicks «Continuar con Google» on the open sign-in gate and returns the OAuth callbackUrl the
 * gate would redirect to if the popup were blocked — decoded out of the popup's URL
 * (`/auth/signin-popup?callbackUrl=/auth/popup-callback?next=<callbackUrl>`). The popup's
 * page is fulfilled with an empty document so `signIn()` never runs.
 */
async function readGateCallbackUrl(page: Page): Promise<string> {
  await page.context().route("**/auth/signin-popup**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>e2e</title>" }),
  );

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: d.booking.signInGate.continueGoogle, exact: true }).click(),
  ]);
  await popup.waitForLoadState();
  const popupUrl = new URL(popup.url());
  await popup.close();

  const popupCallback = popupUrl.searchParams.get("callbackUrl");
  expect(popupCallback, "signin-popup carries a callbackUrl").toBeTruthy();
  const next = new URL(popupCallback!, popupUrl.origin).searchParams.get("next");
  expect(next, "popup-callback carries the gate's callbackUrl as ?next").toBeTruthy();
  return next!;
}

test.describe("REDESIGN-P3-02: the home", () => {
  test("the menu reads Inicio · Cursos · Mentoría · Blog, in that order", async ({ page }) => {
    await page.goto("/");

    // Desktop row only (`Desktop Chrome` is 1280 wide, past the `lg` breakpoint): the four
    // labels in order, and nothing between them.
    const nav = page.locator("nav").first();
    const labels = await nav.getByRole("link").allInnerTexts();
    const menu = labels.map((l) => l.trim()).filter((l) =>
      [d.nav.home, d.nav.courses, d.nav.mentoring, d.nav.blog].includes(l),
    );
    expect(menu).toEqual([d.nav.home, d.nav.courses, d.nav.mentoring, d.nav.blog]);
    await expect(nav.getByRole("link", { name: d.nav.home, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("signed out: «Ver disponibilidad» → slot → the sign-in gate, on /, with a /mentoria callbackUrl", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");

    await pickSlotFromAvailability(page);

    // The gate names the intent («reservar la hora elegida») and the page has not moved.
    const gate = page.getByRole("dialog", { name: d.booking.signInGate.title });
    await expect(gate).toBeVisible({ timeout: 15_000 });
    await expect(gate.getByText(d.booking.signInGate.actions.bookChosenTime)).toBeVisible();
    await expect(page).toHaveURL(HOME_URL);

    // The full-redirect fallback carries the intent AND the slot into /mentoria.
    expect(await readGateCallbackUrl(page)).toMatch(/^\/mentoria\?intent=smart-book&slotStart=/);
    await expect(page).toHaveURL(HOME_URL);
  });

  test("signed out: «Reservar sesión ahora» → the sign-in gate, on /, callbackUrl /mentoria?intent=smart-book", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: d.landing.hero.cta.book, exact: true }).first().click();

    const gate = page.getByRole("dialog", { name: d.booking.signInGate.title });
    await expect(gate).toBeVisible({ timeout: 15_000 });
    await expect(gate.getByText(d.booking.signInGate.actions.bookSession)).toBeVisible();
    await expect(page).toHaveURL(HOME_URL);

    expect(await readGateCallbackUrl(page)).toBe("/mentoria?intent=smart-book");
    await expect(page).toHaveURL(HOME_URL);
  });

  test.describe("signed in, first-timer", () => {
    test.beforeEach(async ({ page }) => {
      await resetTestState();
      await loginAs(page, E2E_USER.email, E2E_USER.name);
    });

    test("«Ver disponibilidad» → slot → the free-15 review step with the slot pre-selected, on /", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/");

      // The smart-book route waits for the booking history to settle before it opens the
      // wizard, so the CTA can be clicked before the credits/bookings fetch completes.
      await pickSlotFromAvailability(page);

      // Straight to the review step: appointment details, the free-session marker, and the
      // confirm button — not the calendar again. The booking is NOT confirmed here (see the
      // file header). The marker is responsive: the «Gratis» pill below `lg`, the free note
      // (main card + sidebar) from `lg` — assert whichever this viewport renders.
      const single = d.booking.singleSession;
      await expect(page.getByText(single.appointmentDetails)).toBeVisible({ timeout: 45_000 });
      await expect(
        page.getByText(single.freeNote)
          .or(page.getByText(single.free, { exact: true }))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: new RegExp(`${single.confirmShort}|${single.confirmBook}`) }),
      ).toBeEnabled();
      await expect(page).toHaveURL(HOME_URL);

      // The FAB leaves with the sections' rule: no assistant button while the wizard is up.
      await expect(page.locator(".chat-fab")).toHaveCount(0);
    });

    test("«Reservar sesión ahora» → the free-15 wizard, in place on /", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/");

      await page.getByRole("button", { name: d.landing.hero.cta.book, exact: true }).first().click();

      // Picking step of the wizard (the calendar with «Cambiar tipo de sesión»), URL unchanged.
      await expect(
        page.getByRole("button", { name: d.booking.singleSession.changeSessionType }),
      ).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("dialog", { name: d.booking.signInGate.title })).toHaveCount(0);
      await expect(page).toHaveURL(HOME_URL);
    });
  });

  test("the footer's assistant link opens the chat on /", async ({ page }) => {
    await page.goto("/");

    await page.locator("footer").getByRole("button", { name: d.footer.askAssistant, exact: true }).click();

    const panel = page.getByRole("dialog", { name: d.chat.assistantLabel });
    await expect(panel).toHaveClass(/chat-panel--open/, { timeout: 15_000 });
    await expect(panel.getByRole("textbox", { name: d.chat.placeholderShort })).toBeVisible();
    await expect(page).toHaveURL(HOME_URL);
  });

  test("the courses band shows the catalog's cards and the posts band the two newest posts", async ({ page }) => {
    await page.goto("/");

    // Course cards: however many `/cursos` shows (same selector on both pages — one truth).
    const homeCourses = await page.locator(".home-courses-grid .course-card").count();
    expect(homeCourses).toBeGreaterThanOrEqual(1);

    // Post cards: exactly the first two of `/blog`, in the same order.
    const homePosts = page.locator(".home-posts-grid .post-card");
    await expect(homePosts).toHaveCount(2);
    const homePostHrefs = await homePosts.evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
    );

    await page.goto("/cursos");
    await expect(page.locator(".course-card")).toHaveCount(homeCourses, { timeout: 30_000 });

    await page.goto("/blog");
    const blogHrefs = await page.locator(".post-card").evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
    );
    expect(blogHrefs.slice(0, 2)).toEqual(homePostHrefs);
  });
});
