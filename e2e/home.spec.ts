/**
 * e2e/home.spec.ts
 *
 * REDESIGN-P3-02: the home (`/`) after the redesign — the one page with no spec of its own,
 * and whose two CTAs are the new bridge into the booking.
 *
 * What is pinned, and why each is here rather than in the booking specs:
 *   - The menu order (Inicio · Cursos · Mentoría · Blog) — a locked decision of the cycle.
 *   - «Ver disponibilidad» opens the calendar ON `/` and a slot pick continues without leaving
 *     `/`: to the sign-in gate («reservar la hora elegida»). Signed out only — see LANDING-01.
 *   - «Reservar sesión ahora» opens the smart-book surface on `/`: the gate («reservar una
 *     sesión») signed out.
 *   - LANDING-01: `/` is the marketing home for anonymous visitors, and for signed-in ones who
 *     navigate to it from inside the app («Inicio»). A visitor who LANDS on it with a session
 *     (typed URL, bookmark, external link) is sent to their real landing — the personal area, or
 *     the course they are reading when they have booked nothing and hold no credits (`/en` →
 *     `/en/…`). The signed-in CTA paths that used to be pinned here live on their landing now:
 *     booking-personal-area pins the free-15 wizard opening in place on `/area-personal`,
 *     booking-free the confirm → success half on `/mentoria`.
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
 * Signed-out tests need no DB. The signed-in tests reset the test state, seed what the ladder
 * reads (a pack, an enrolment) and log in through the e2e auth endpoint, like the booking specs.
 *
 * TIMEOUTS: the calendar and the wizard are `next/dynamic` chunks on this page, fetched on the
 * first click, on top of the availability fetch — under `pnpm dev` the first spec to open them
 * pays for their compile too. 45 s for the first slot matches booking-free / booking-pack.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { seedEnrollment, seedPackCredits } from "./fixtures/seed";
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

  test.describe("LANDING-01: the home routes signed-in visitors", () => {
    test.beforeEach(async ({ page }) => {
      await resetTestState();
      await loginAs(page, E2E_USER.email, E2E_USER.name);
    });

    test("first-timer (nothing booked, no credits, no course): / → /area-personal", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/area-personal$/, { timeout: 30_000 });
    });

    test("pack holder who has never booked: / → /area-personal", async ({ page }) => {
      await seedPackCredits(E2E_USER.email, E2E_USER.name);
      await page.goto("/");
      await expect(page).toHaveURL(/\/area-personal$/, { timeout: 30_000 });
    });

    test("course reader with nothing booked: / → the course landing", async ({ page }) => {
      await seedEnrollment(E2E_USER.email, "dl-nlp", "texto-como-numeros", E2E_USER.name);
      await page.goto("/");
      await expect(page).toHaveURL(/\/cursos\/dl-nlp$/, { timeout: 30_000 });
    });

    test("en: /en → /en/area-personal", async ({ page }) => {
      await page.goto("/en");
      await expect(page).toHaveURL(/\/en\/area-personal$/, { timeout: 30_000 });
    });

    test("only landings redirect: «Inicio» from inside the app still shows the home", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/area-personal$/, { timeout: 30_000 });

      // An in-app navigation (Sec-Fetch-Site: same-origin) reaches the static home…
      await page.locator("nav").first().getByRole("link", { name: d.nav.home, exact: true }).click();
      await expect(page).toHaveURL(HOME_URL, { timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: d.landing.hero.cta.book, exact: true }).first(),
      ).toBeVisible();

      // …and so does a reload once there; a fresh arrival redirects again.
      await page.reload();
      await expect(page).toHaveURL(HOME_URL);
      await page.goto("/");
      await expect(page).toHaveURL(/\/area-personal$/, { timeout: 30_000 });
    });
  });

  test("LANDING-01: anonymous visitors keep the static home", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(HOME_URL);
    await expect(
      page.getByRole("button", { name: d.landing.hero.cta.book, exact: true }).first(),
    ).toBeVisible();
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
