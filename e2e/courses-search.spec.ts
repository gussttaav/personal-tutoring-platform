/**
 * e2e/courses-search.spec.ts
 *
 * COURSE-P9-01 / COURSE-P9-02: cross-lesson search.
 *
 * Things here that unit tests structurally cannot reach — `pnpm test:unit` runs in the `node`
 * environment with no jsdom, so the engine is covered by pure-module tests and everything below
 * the component boundary is only ever exercised here:
 *
 *   1. The desktop sidebar field matches, highlights, replaces the lesson list, and — the P9-02
 *      contract — keeps its results across a result click until the reader clears them.
 *   2. The mobile dialog still opens from the bar's icon button, navigates by keyboard, and
 *      releases the scroll lock. The dialog is unreachable at a desktop viewport since P9-02, so
 *      those cases run under a phone-sized viewport.
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
 * The desktop rail. The drawer holds a second copy of the lesson list (no field), and CSS hides
 * whichever the viewport does not use — scoping every locator to the aside keeps `.first()`
 * from picking a `display:none` twin and waiting forever.
 */
const SIDEBAR = "aside.lesson-sidebar-desktop";

test.describe("COURSE-P9-01: the search index", () => {
  test("is served as JSON", async ({ request }) => {
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
});

test.describe("COURSE-P9-02: inline search in the desktop sidebar", () => {
  test("es: typing replaces the lesson list, a click keeps the results, × brings the list back", async ({ page }) => {
    const d = dict.es;

    await page.goto(LESSON_PATH, { timeout: 30_000 });

    const sidebar = page.locator(SIDEBAR);
    const input = sidebar.getByRole("searchbox");
    // Scope to the OPEN block. LessonSidebar renders each block as <details open={containsCurrent}>,
    // so only the current lesson's block is expanded — the first row overall (Block 1's) sits in a
    // collapsed <details> and is hidden whatever search is doing. The open block's rows track the
    // list wrapper's `hidden={active}` toggle, which is the state these assertions are really about.
    const lessonRows = sidebar.locator("details[open] [data-lesson-slug]");
    const options = sidebar.locator(".cs-option");

    await expect(lessonRows.first()).toBeVisible();

    // Unaccented input must find accented prose — the folding contract.
    await input.fill("atencion");

    await expect(options.first()).toBeVisible({ timeout: 30_000 });
    // The query is highlighted, and the whole word is marked, not the matched prefix only.
    await expect(sidebar.locator(".cs-option mark").first()).toContainText(/atenci/i);
    // The list is hidden, not gone: progress selectors elsewhere rely on it staying attached.
    await expect(lessonRows.first()).toBeHidden();
    await expect(lessonRows.first()).toBeAttached();

    // Open a result from a DIFFERENT lesson so the navigation is observable.
    const other = sidebar.locator('.cs-option:not([href*="/self-attention"])').first();
    const href = (await other.getAttribute("href")) ?? "";
    expect(href).toMatch(/^\/cursos\/dl-nlp\//);
    await other.click();

    await expect(page).toHaveURL(new RegExp(href.split("#")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 30_000,
    });

    // The whole reader remounts on navigation; the field re-reads its query from the store.
    await expect(input).toHaveValue("atencion");
    await expect(options.first()).toBeVisible({ timeout: 30_000 });
    await expect(lessonRows.first()).toBeHidden();
    // The lesson now being read is marked inside the results.
    await expect(sidebar.locator('.cs-grouplink[aria-current="page"]')).toHaveCount(1);

    await sidebar.getByRole("button", { name: d.courses.search.clear }).click();
    await expect(input).toHaveValue("");
    await expect(options).toHaveCount(0);
    await expect(lessonRows.first()).toBeVisible();
  });

  test("es: a section result deep-links to a heading that exists on the page", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });
    await page.locator(SIDEBAR).getByRole("searchbox").fill("codificacion posicional");

    // Only the rows that carry a section anchor; the "Introducción" row has none.
    const anchored = page.locator(`${SIDEBAR} .cs-option[href*="#"]`);
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

  test("es: Enter opens the first result; Escape clears the field", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });

    const sidebar = page.locator(SIDEBAR);
    const input = sidebar.getByRole("searchbox");
    await input.fill("softmax");

    const first = sidebar.locator(".cs-option").first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    const href = (await first.getAttribute("href")) ?? "";

    await input.press("Enter");
    // The href carries a literal accent in its section id (e.g. "…#más-de-dos-clases-softmax"); the
    // browser stores the location percent-encoded ("…#m%C3%A1s-…"), so match the encoded form.
    // encodeURI keeps the path separators and the # and encodes only the non-ASCII bytes.
    await expect(page).toHaveURL(new RegExp(encodeURI(href).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 30_000,
    });

    // Results survived the navigation; Escape is the keyboard route back to the list.
    await expect(input).toHaveValue("softmax");
    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(sidebar.locator(".cs-option")).toHaveCount(0);
    // Open-block scoping again: the first row overall lives in a collapsed <details>.
    await expect(sidebar.locator("details[open] [data-lesson-slug]").first()).toBeVisible();
  });

  test("en: results keep the /en prefix and are honest about which lessons are still Spanish", async ({ page, request }) => {
    const d = dict.en;

    // The expectation is derived from the served index, not hardcoded: Phase 11 translates
    // lessons one at a time, and this must hold whether none, some or all have landed.
    const index = (await (await request.get("/api/courses/search-index/dl-nlp/en", { timeout: 30_000 })).json()) as {
      lessons: { slug: string; contentLocale: string }[];
    };
    const fallback = new Set(index.lessons.filter((l) => l.contentLocale !== "en").map((l) => l.slug));
    const state = fallback.size === 0 ? "native" : fallback.size === index.lessons.length ? "fallback" : "partial";

    await page.goto(`/en${LESSON_PATH}`, { timeout: 30_000 });
    const sidebar = page.locator(SIDEBAR);
    await sidebar.getByRole("searchbox").fill("atencion");

    const groups = sidebar.locator(".cs-group");
    await expect(groups.first()).toBeVisible({ timeout: 30_000 });

    // next-intl <Link> rows — the prefix is its job, and this is the assertion that it did it.
    const href = await sidebar.locator(".cs-option").first().getAttribute("href");
    expect(href).toMatch(/^\/en\/cursos\//);

    // COURSE-P6-03b / P9-02: one notice while nothing is translated, a per-result tag while
    // some lessons are, nothing once all are. Never the notice AND tags.
    const notice = sidebar.locator(".cs-notice");
    if (state === "fallback") {
      await expect(notice).toContainText(d.courses.landing.languageNotice.title);
    } else {
      await expect(notice).toHaveCount(0);
    }
    for (const group of await groups.all()) {
      const slug = ((await group.locator(".cs-grouplink").getAttribute("href")) ?? "").split("/").pop() ?? "";
      const tagged = ((await group.locator(".cs-kicker").textContent()) ?? "").includes(d.courses.reader.refFallback);
      expect(tagged, `tag on ${slug}`).toBe(state === "partial" && fallback.has(slug));
    }
  });
});

/*
 * The dialog is mobile-only since P9-02: its trigger is the icon button in the sticky bar,
 * `display:none` from 768px up. A phone-sized viewport is the only way to reach it.
 */
test.describe("COURSE-P9-01: the mobile search dialog", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens from the bar, matches, and opens a result by keyboard", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });
    await page.locator("button.cs-trigger--icon").click();

    const input = page.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("atencion");

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".cs-option mark").first()).toContainText(/atenci/i);

    await input.press("ArrowDown");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/cursos\/dl-nlp\/[^/]+/, { timeout: 30_000 });
    // The dialog closes and the page is scrollable again (the ref-counted lock released).
    await expect(page.locator(".cs-panel")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(LESSON_PATH, { timeout: 30_000 });
    await page.locator("button.cs-trigger--icon").click();
    await expect(page.locator(".cs-panel")).toBeVisible({ timeout: 30_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator(".cs-panel")).toHaveCount(0);
  });
});
