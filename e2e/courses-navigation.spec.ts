/**
 * e2e/courses-navigation.spec.ts
 *
 * COURSE-P6-03: the launch path — Cursos in the chrome actually goes somewhere.
 *
 * Two flows, and the second is the one worth having:
 *   1. es: navbar Cursos → catalog → landing → first lesson.
 *   2. en: navbar Courses → English catalog (card badged "lessons in Spanish") →
 *      English landing → the SPANISH lesson. That last hop crosses locales through a
 *      `/es`-prefixed URL the middleware rewrites; it is the step most likely to break
 *      silently into a 404, and the least likely to be noticed by a Spanish-speaking
 *      maintainer.
 *
 * Also pins the thing this task could most easily have broken by accident: Blog still
 * opens the ComingSoonModal, from the navbar AND the footer.
 *
 * Signed out throughout — reading requires no account (P4-02), and the notify card's
 * signed-out state is all that is asserted here (its signed-in toggle needs OAuth).
 *
 * TIMEOUTS: every hop between course routes gets 30s, same as courses-progress.spec.ts and for
 * the same reason — under `pnpm dev` the FIRST request to a route pays for its compile, and the
 * reader in particular is the heaviest page in the app (MDX + KaTeX + widgets + Pyodide). With
 * the 5s default, whichever test happened to hit `[courseSlug]` cold failed and the next one
 * passed on the warm route, which is a test order dependency, not a signal. Against a
 * production build these are all far quicker; don't trim them to what a prod run gets away with.
 */

import { test, expect } from "@playwright/test";
import { dict } from "./helpers/dict";

const FIRST_LESSON_PATH = "/cursos/dl-nlp/texto-como-numeros";

test.describe("COURSE-P6-03: courses are reachable from the site chrome", () => {
  test("es: navbar Cursos → catalog → landing → first lesson", async ({ page }) => {
    const d = dict.es;

    await page.goto("/");
    await page.getByRole("link", { name: d.nav.courses, exact: true }).first().click();

    await expect(page).toHaveURL(/\/cursos$/);
    await expect(page.getByRole("heading", { name: d.courses.catalog.heading })).toBeVisible();

    // The empty state must NOT be what a Spanish visitor sees.
    await expect(page.getByText(d.courses.catalog.empty.title)).toHaveCount(0);

    await page.getByRole("link", { name: /Deep Learning para NLP/ }).click();
    await expect(page).toHaveURL(/\/cursos\/dl-nlp$/, { timeout: 30_000 });

    await page.getByRole("link", { name: d.courses.landing.hero.start }).first().click();
    await expect(page).toHaveURL(new RegExp(`${FIRST_LESSON_PATH}$`), { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("en: English card and landing, linking into the Spanish reader", async ({ page }) => {
    const d = dict.en;

    await page.goto("/en");
    await page.getByRole("link", { name: d.nav.courses, exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/cursos$/);

    // The English course card exists and is honest about the lesson language.
    await expect(page.getByRole("link", { name: /Deep Learning for NLP/ })).toBeVisible();
    await expect(page.getByText(d.courses.catalog.card.contentLanguage)).toBeVisible();
    await expect(page.getByText(d.courses.catalog.empty.title)).toHaveCount(0);

    await page.getByRole("link", { name: /Deep Learning for NLP/ }).click();
    await expect(page).toHaveURL(/\/en\/cursos\/dl-nlp$/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: d.courses.landing.languageNotice.title }),
    ).toBeVisible();

    // The cross-locale hop: an English reader must land on the Spanish lesson, not a 404.
    await page.getByRole("link", { name: d.courses.landing.hero.start }).first().click();
    await expect(page).toHaveURL(new RegExp(`${FIRST_LESSON_PATH}$`), { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("the notify opt-in is offered on the catalog", async ({ page }) => {
    const d = dict.es;

    await page.goto("/cursos");
    await expect(page.getByRole("heading", { name: d.courses.notify.heading })).toBeVisible();
    // Signed out, the CTA is sign-in — subscribing requires an account.
    await expect(page.getByRole("button", { name: d.courses.notify.signIn })).toBeVisible();
  });

  test("the nav marks the CURRENT page, and Mentoría stops looking current", async ({ page }) => {
    const d = dict.es;
    const nav = page.locator("nav").first();

    // ONE rule, so both items render alike. On the landing page Mentoría is the current item —
    // `#sessions` is a section of that page, not a page of its own — and it is marked exactly
    // the way Cursos is marked on /cursos. Never both at once.
    await page.goto("/");
    await expect(nav.getByRole("link", { name: d.nav.mentoring, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);

    // On a courses route, Cursos is current — and Mentoría must NOT be, which is the whole
    // point: its accent is a call to action, and leaving it lit here pointed the reader at
    // the wrong item.
    await page.goto("/cursos");
    await expect(nav.getByRole("link", { name: d.nav.courses, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: d.nav.mentoring, exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);

    // The two items are marked IDENTICALLY — the complaint that started this was that they
    // were not. Same colour, same underline, whichever one you are on.
    const markedHere = await nav.locator("[aria-current='page']").evaluate(
      (el) => getComputedStyle(el).color + "|" + getComputedStyle(el).borderBottomColor,
    );
    await page.goto("/");
    const markedHome = await nav.locator("[aria-current='page']").evaluate(
      (el) => getComputedStyle(el).color + "|" + getComputedStyle(el).borderBottomColor,
    );
    expect(markedHere).toBe(markedHome);
    await page.goto("/cursos");

    // A lesson is still "inside" Cursos.
    await page.goto(FIRST_LESSON_PATH);
    await expect(nav.getByRole("link", { name: d.nav.courses, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Mentoría reaches the sessions section from a courses page, with a clean URL", async ({ page }) => {
    const d = dict.es;

    // `#sessions` lives in InteractiveShell, which is landing-page only. As a bare fragment
    // link this click used to preventDefault and fire an event nobody was listening for — it
    // did nothing at all, silently. It must now navigate home AND land on the section.
    //
    // The URL must come out clean: the scroll intent travels in sessionStorage, not as a
    // `#sessions` fragment, so the same act produces the same URL from anywhere. Asserting
    // the absence of the fragment is the point — an earlier attempt stripped it after the
    // fact with history.replaceState and reproducibly corrupted the URL to `/#sessions#sessions`.
    await page.goto("/cursos");
    await page.locator("nav").first()
      .getByRole("link", { name: d.nav.mentoring, exact: true }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/#sessions/);
    await expect(page.locator("#sessions")).toBeInViewport({ timeout: 15_000 });

    // Same from the footer, which carries the same link and renders on /cursos too.
    await page.goto("/cursos");
    await page.locator("footer")
      .getByRole("link", { name: d.footer.mentoring, exact: true }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/#sessions/);
    await expect(page.locator("#sessions")).toBeInViewport({ timeout: 15_000 });
  });

  test("navbar → Back → footer keeps the URL clean (the replaceState corruption)", async ({ page }) => {
    const d = dict.es;

    // This exact sequence produced `/#sessions#sessions` when the fragment was stripped with
    // history.replaceState behind the App Router. Pinned because the failure needed three
    // steps to appear and looked fine in every one-step check.
    await page.goto("/cursos");
    await page.locator("nav").first()
      .getByRole("link", { name: d.nav.mentoring, exact: true }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/cursos$/, { timeout: 30_000 });

    await page.locator("footer")
      .getByRole("link", { name: d.footer.mentoring, exact: true }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/#sessions/);
  });

  test("mobile: the panel marks the current page and closes on navigation", async ({ page }) => {
    const d = dict.es;
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/");
    await page.getByRole("button", { name: /men[uú]/i }).first().click();

    const panelCourses = page.getByRole("link", { name: d.nav.courses, exact: true }).last();
    await expect(panelCourses).toBeVisible();
    await panelCourses.click();

    await expect(page).toHaveURL(/\/cursos$/, { timeout: 30_000 });
    // The panel must close behind a plain navigation — it only ever closed on the modal and
    // anchor branches, so a real link left it open over the page it had just navigated to.
    await expect(page.getByRole("link", { name: d.nav.blog, exact: true })).toHaveCount(0);
  });

  test("the language switcher on a lesson does not 404", async ({ page }) => {
    // Locale detection is pathname → NEXT_LOCALE cookie → default (src/middleware.ts), so
    // while /en had no lesson pages this was a guaranteed 404 — and so was every Spanish
    // lesson URL in the sitemap for anyone holding an `en` cookie from a previous visit.
    await page.goto(FIRST_LESSON_PATH);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.getByRole("button", { name: "EN", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/cursos\/dl-nlp\/texto-como-numeros$/, { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toBeVisible();
    // English chrome, Spanish prose, and a notice that says so rather than leaving the
    // reader wondering why the switch half-worked.
    await expect(
      page.getByText(dict.en.courses.reader.translationPending.title),
    ).toBeVisible();
  });

  test("an untranslated lesson page is never indexable as that locale", async ({ page }) => {
    // The whole reason the fallback page is safe: it must not tell a crawler that Spanish
    // prose is English. If this ever regresses, the site starts advertising duplicate
    // content under a language it does not serve.
    const res = await page.goto("/en/cursos/dl-nlp/texto-como-numeros");
    expect(res?.status()).toBe(200);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    // NO canonical, deliberately: noindex + canonical are contradictory signals and Google
    // may carry the noindex over to the canonical target — which would be the Spanish
    // lesson, i.e. the pages the whole SEO case rests on. noindex alone is unambiguous.
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    // No hreflang alternate, and no JSON-LD claiming an English learning resource.
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

    // The Spanish original stays indexable and advertises no `en` alternate. Clear cookies
    // first: the goto above set NEXT_LOCALE=en, and an unprefixed URL under that cookie is
    // redirected to /en by the middleware — correct behaviour, but not what is under test.
    await page.context().clearCookies();
    await page.goto(FIRST_LESSON_PATH);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
  });

  test("Blog still opens the ComingSoonModal, from the navbar and the footer", async ({ page }) => {
    const d = dict.es;

    await page.goto("/cursos");

    await page.getByRole("link", { name: d.nav.blog, exact: true }).first().click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(d.comingSoon.blog.headline);

    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);

    await page.locator("footer").getByRole("button", { name: d.footer.blog, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
