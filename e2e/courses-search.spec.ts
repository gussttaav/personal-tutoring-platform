/**
 * e2e/courses-search.spec.ts
 *
 * COURSE-P9-01: cross-lesson search.
 *
 * Three things here that unit tests structurally cannot reach — `pnpm test:unit` runs in the
 * `node` environment with no jsdom, so the engine is covered by pure-module tests and everything
 * below the component boundary is only ever exercised here:
 *
 *   1. The palette actually opens, matches, and highlights.
 *   2. Keyboard navigation lands on the right lesson AND the right section anchor.
 *   3. The index is genuinely served — the "prerender silently became dynamic, 404 in production"
 *      failure that no unit test and no lint can see. CI does not run `pnpm build`, so this
 *      request assertion is the only automated check on it.
 *
 * Signed out throughout: reading and searching require no account.
 *
 * TIMEOUTS: 30s per hop, same as courses-navigation.spec.ts and for the same reason — under
 * `pnpm dev` the first request to a route pays for its compile, and the reader is the heaviest
 * page in the app. The index route compiles on first request too.
 */

import { test, expect } from "@playwright/test";
import { dict } from "./helpers/dict";

const LESSON_PATH = "/cursos/dl-nlp/self-attention";

/*
 * The bar variant. There are deliberately TWO triggers in the DOM — this one in the desktop
 * sidebar and an icon button in the mobile bar — with CSS hiding whichever the viewport does not
 * use. `.first()` picks the mobile one and then waits forever for a `display:none` element.
 */
const DESKTOP_TRIGGER = "button.cs-trigger:not(.cs-trigger--icon)";

test.describe("COURSE-P9-01: cross-lesson search", () => {
  test("the search index is served as JSON", async ({ request }) => {
    const res = await request.get("/api/courses/search-index/dl-nlp/es", { timeout: 30_000 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    const index = await res.json();
    expect(index.version).toBe(1);
    expect(index.course).toBe("dl-nlp");
    // 43 published lessons and ~254 section chunks at the time of writing. The floors are
    // deliberately loose — this asserts "the index is populated", not a content snapshot.
    expect(index.lessons.length).toBeGreaterThan(30);
    expect(index.chunks.length).toBeGreaterThan(200);
  });

  test("es: open from the sidebar, match with an unaccented query, open a result by keyboard", async ({ page }) => {
    const d = dict.es;

    await page.goto(LESSON_PATH, { timeout: 30_000 });

    // The desktop trigger; the mobile one carries the same label but is display:none here.
    await page.locator(DESKTOP_TRIGGER).click();

    const input = page.getByRole("combobox");
    await expect(input).toBeFocused();

    // Unaccented input must find accented prose — the folding contract.
    await input.fill("atencion");

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible({ timeout: 30_000 });
    // The query is highlighted, and the whole word is marked, not the matched prefix only.
    await expect(page.locator(".cs-option mark").first()).toContainText(/atenci/i);

    await input.press("ArrowDown");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/cursos\/dl-nlp\/[^/]+/, { timeout: 30_000 });
    // The dialog closes and the page is scrollable again (the ref-counted lock released).
    await expect(page.locator(".cs-panel")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("es: a section result deep-links to a heading that exists on the page", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });
    await page.locator(DESKTOP_TRIGGER).click();
    await page.getByRole("combobox").fill("codificacion posicional");

    // Only the rows that carry a section anchor; the "Introducción" row has none.
    const anchored = page.locator('.cs-option[href*="#"]');
    await expect(anchored.first()).toBeVisible({ timeout: 30_000 });

    const href = await anchored.first().getAttribute("href");
    const id = decodeURIComponent((href ?? "").split("#")[1] ?? "");
    expect(id).not.toBe("");

    await anchored.first().click();
    await expect(page).toHaveURL(new RegExp(`#${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), {
      timeout: 30_000,
    });
    // The anchor must resolve to a real rendered heading — this is what proves the index's
    // section ids agree with rehype-slug. Resolved in the page (ids contain accents, and
    // `CSS.escape` is a browser global that does not exist in the Node test context).
    await expect
      .poll(() => page.evaluate((anchor) => Boolean(document.getElementById(anchor)), id), {
        timeout: 30_000,
      })
      .toBe(true);
  });

  test("en: results keep the /en prefix and the page says the lessons are in Spanish", async ({ page }) => {
    const d = dict.en;

    await page.goto(`/en${LESSON_PATH}`, { timeout: 30_000 });
    await page.locator(DESKTOP_TRIGGER).click();
    await page.getByRole("combobox").fill("atencion");

    await expect(page.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
    // COURSE-P6-03b: honest about the fallback rather than quietly serving Spanish under /en.
    await expect(page.locator(".cs-notice")).toContainText(d.courses.landing.languageNotice.title);

    // Raw <a> options get no next-intl treatment, so the prefix is added explicitly. Dropping
    // it breaks copy-link and middle-click while keyboard navigation still looks fine.
    const href = await page.getByRole("option").first().getAttribute("href");
    expect(href).toMatch(/^\/en\/cursos\//);
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });
    await page.locator(DESKTOP_TRIGGER).click();
    await expect(page.locator(".cs-panel")).toBeVisible({ timeout: 30_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator(".cs-panel")).toHaveCount(0);
  });
});
