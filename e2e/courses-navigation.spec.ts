/**
 * e2e/courses-navigation.spec.ts
 *
 * COURSE-P6-03: the launch path — Cursos in the chrome actually goes somewhere.
 *
 * Two flows, and the second is the one worth having:
 *   1. es: navbar Cursos → catalog → landing → first lesson.
 *   2. en: navbar Courses → English catalog → English landing → the first lesson, now in
 *      English (Block 1 is translated).
 *
 * COURSE-BUILD-01 sharpened flow 2. Both surfaces used to be keyed off the FIRST lesson's
 * language, so the moment Block 1 landed in English the card dropped its badge and the landing
 * dropped its notice — while 25 of dl-nlp's 43 lessons were still Spanish. They now report the
 * PARTIAL state, and that is what this pins: not the "in Spanish" copy (which would be a lie in
 * the other direction) but the "partly in Spanish" copy, with the full-Spanish copy asserted
 * absent. The per-lesson promise in catalog-view.ts still holds — "when en/ lessons land, all of
 * this stops firing on its own" — it just now stops firing lesson by lesson rather than at the
 * first one.
 *
 * The third test covers the other axis: a course still being WRITTEN (`llm-agents`, one published
 * lesson of a planned 40) has to advertise the four blocks nobody has written yet, because before
 * COURSE-BUILD-01 the card said "1 módulo" and the landing showed a one-block syllabus.
 *
 * The cross-locale fallback — an `/en` URL that still serves Spanish prose — has NOT gone away;
 * it just moved down the syllabus to whatever lesson is still untranslated (`UNTRANSLATED_LESSON`,
 * derived from the content tree below). The two SEO-critical invariants ride on it: the language
 * switcher must reach that page instead of 404ing, and the page must never advertise itself as
 * English. Both are pinned against that lesson, so they keep testing a genuine fallback — the step
 * most likely to break silently, and the least likely to be noticed by a Spanish-speaking maintainer.
 *
 * BLOG-01: the Blog test that used to live here pinned the ComingSoonModal. The blog has a
 * real page now, so it pins what the Cursos flow pins — the chrome goes somewhere — from the
 * navbar AND the footer. The modal is gone; nothing in the app renders one any more.
 *
 * REDESIGN-P0-01: «Mentoría» is a page too (`/mentoria`), and «Inicio» joined the menu. The
 * two tests that pinned the `#sessions` scroll — navigate home, land on the section, keep the
 * URL clean, survive navbar → Back → footer — are gone with the mechanism they guarded; what
 * is left to pin is what Blog pins: the label goes to the same page from the navbar and the
 * footer. The current-page test marks Inicio on `/` and Mentoría on `/mentoria`.
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

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { test, expect } from "@playwright/test";
import { dict } from "./helpers/dict";

const COURSE_SLUG = "dl-nlp";
const COURSE_DIR = join(process.cwd(), "content/courses", COURSE_SLUG);
const FIRST_LESSON_PATH = `/cursos/${COURSE_SLUG}/texto-como-numeros`;

/** Published lesson slugs for one locale, in spine (filename) order. A regex over the two
 *  scalars we need is enough — no reason to pull a YAML parser into the e2e helpers. Drafts
 *  (e.g. `00-pipeline-fixture`) are excluded to match the published-only registry selectors. */
function publishedSlugs(locale: "es" | "en"): string[] {
  return readdirSync(join(COURSE_DIR, locale))
    .filter((f) => f.endsWith(".mdx"))
    .sort()
    .map((file) => {
      const src = readFileSync(join(COURSE_DIR, locale, file), "utf-8");
      const slug = src.match(/^slug:\s*(.+)$/m)?.[1].trim()
        ?? file.replace(/^\d+-/, "").replace(/\.mdx$/, "");
      const draft = /^draft:\s*true\s*$/m.test(src);
      return { slug, draft };
    })
    .filter((m) => !m.draft)
    .map((m) => m.slug);
}

/**
 * The first published Spanish lesson with no English translation — the slug whose `/en` page is
 * still a Spanish-prose fallback. Derived from the content tree so the fallback invariants below
 * keep testing a genuinely untranslated lesson as translation advances block by block, instead of
 * silently going green against a lesson that has since been translated (which is exactly how this
 * spec broke when Block 1 landed in English). Currently the first lesson of Block 2, `la-neurona`.
 */
const translatedEn = new Set(publishedSlugs("en"));
const UNTRANSLATED_LESSON = publishedSlugs("es").find((slug) => !translatedEn.has(slug));
if (!UNTRANSLATED_LESSON) {
  throw new Error(
    `courses-navigation.spec: every ${COURSE_SLUG} lesson is translated — the fallback tests need `
      + "a still-untranslated lesson. Retire them, or point them at another course.",
  );
}

/*
 * COURSE-BUILD-01 — the course being written in public. Derived from the content tree for the
 * same reason `UNTRANSLATED_LESSON` is: the numbers move as blocks get published, and a test
 * that hard-codes them goes quietly green against a stale expectation.
 */
const IN_PROGRESS_SLUG = "llm-agents";

/** A manifest's block titles, in order. The block list is the tail of the file and its titles
 *  are the only four-space-indented `title:` scalars in it — a regex is enough here too. */
function blockTitles(slug: string, locale: "es" | "en"): string[] {
  const src = readFileSync(
    join(process.cwd(), "content/courses", slug, `course.${locale}.yml`),
    "utf-8",
  );
  const blocks = src.slice(src.indexOf("\nblocks:"));
  return [...blocks.matchAll(/^ {4}title: "(.+)"$/gm)].map((m) => m[1]);
}

/** How many blocks have at least one PUBLISHED lesson — i.e. how many syllabus rows are
 *  expandable `<details>`. The rest render as plain «próximamente» rows. */
function startedBlocks(slug: string, locale: "es" | "en"): number {
  const dir = join(process.cwd(), "content/courses", slug, locale);
  const blocks = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))) {
    const src = readFileSync(join(dir, file), "utf-8");
    if (/^draft:\s*true\s*$/m.test(src)) continue;
    const block = src.match(/^block:\s*(\d+)$/m)?.[1];
    if (block) blocks.add(block);
  }
  return blocks.size;
}

test.describe("COURSE-P6-03: courses are reachable from the site chrome", () => {
  test("es: navbar Cursos → catalog → landing → first lesson", async ({ page }) => {
    const d = dict.es;

    await page.goto("/");
    await page.getByRole("link", { name: d.nav.courses, exact: true }).first().click();

    // REDESIGN-P3-02: the catalog is the first course route of the run, so this hop pays its
    // compile too (6-7 s cold on a fresh `pnpm dev`) — the 30 s rule from the header applies.
    await expect(page).toHaveURL(/\/cursos$/, { timeout: 30_000 });
    // catalog.heading carries rich-text <accent> markup (rendered as a green italic span); the
    // heading's accessible name has no tags, so match the plain text.
    const catalogHeading = d.courses.catalog.heading.replace(/<[^>]+>/g, "");
    await expect(page.getByRole("heading", { name: catalogHeading })).toBeVisible();

    // The empty state must NOT be what a Spanish visitor sees.
    await expect(page.getByText(d.courses.catalog.empty.title)).toHaveCount(0);

    await page.getByRole("link", { name: /Deep Learning para NLP/ }).click();
    await expect(page).toHaveURL(/\/cursos\/dl-nlp$/, { timeout: 30_000 });

    await page.getByRole("link", { name: d.courses.landing.hero.start }).first().click();
    await expect(page).toHaveURL(new RegExp(`${FIRST_LESSON_PATH}$`), { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("en: English card and landing lead into the English reader", async ({ page }) => {
    const d = dict.en;

    await page.goto("/en");
    await page.getByRole("link", { name: d.nav.courses, exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/cursos$/, { timeout: 30_000 });

    // Block 1 is translated and later blocks are not, so the card says PARTLY in Spanish — not
    // "lessons in Spanish" (which was true before any translation) and not nothing (which is what
    // it used to say, because the badge was keyed off the FIRST lesson's language alone).
    // REDESIGN-P3-02: scoped to THIS course's card — the catalog has a second, Spanish-only
    // course (`llm-agents`, COURSE-C2) whose card wears the full badge by design, so a page-wide
    // count stopped being the invariant.
    const dlNlpCard = page.locator(".course-card").filter({ hasText: /Deep Learning for NLP/ });
    await expect(dlNlpCard.getByRole("link", { name: /Deep Learning for NLP/ })).toBeVisible();
    await expect(dlNlpCard.getByText(d.courses.catalog.card.contentLanguage)).toHaveCount(0);
    await expect(dlNlpCard.getByText(d.courses.catalog.card.contentLanguagePartial)).toBeVisible();
    await expect(page.getByText(d.courses.catalog.empty.title)).toHaveCount(0);

    await page.getByRole("link", { name: /Deep Learning for NLP/ }).click();
    await expect(page).toHaveURL(/\/en\/cursos\/dl-nlp$/, { timeout: 30_000 });
    // Some lessons in English, some not ⇒ the landing says the translation is in progress, and
    // never the blanket "the lessons are in Spanish".
    await expect(
      page.getByRole("heading", { name: d.courses.landing.languageNotice.title }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: d.courses.landing.languageNotice.titlePartial }),
    ).toBeVisible();

    // Start → the English reader for the first lesson: an `/en`-prefixed URL serving real
    // English prose, so no translation-pending notice.
    await page.getByRole("link", { name: d.courses.landing.hero.start }).first().click();
    await expect(page).toHaveURL(/\/en\/cursos\/dl-nlp\/texto-como-numeros$/, { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText(d.courses.reader.translationPending.title)).toHaveCount(0);
  });

  test("COURSE-BUILD-01: a course still being written shows every block and says so", async ({ page }) => {
    const d = dict.es;
    const titles  = blockTitles(IN_PROGRESS_SLUG, "es");
    const started = startedBlocks(IN_PROGRESS_SLUG, "es");

    // When `llm-agents` is finished this stops being an in-progress course and the assertions
    // below stop describing it: point them at whatever course is being written then, or retire
    // them. A silent pass is the one outcome worth ruling out.
    expect(started).toBeLessThan(titles.length);

    await page.goto("/cursos");
    await expect(page).toHaveURL(/\/cursos$/, { timeout: 30_000 });
    const card = page.locator(".course-card").filter({ hasText: /Modelos de Lenguaje/ });
    await expect(card.getByText(d.courses.catalog.card.inProgress)).toBeVisible();

    await page.goto(`/cursos/${IN_PROGRESS_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/cursos/${IN_PROGRESS_SLUG}$`), { timeout: 30_000 });

    // Says out loud that it is unfinished…
    await expect(
      page.getByRole("heading", { name: d.courses.landing.buildNotice.title }),
    ).toBeVisible();

    // …and the syllabus names EVERY block, written or not. This is the regression: the blocks
    // with no published lesson used to be dropped, so the manifest's titles never reached the
    // page and the reader saw a one-block course.
    const syllabus = page.locator("#temario");
    for (const title of titles) {
      await expect(syllabus.getByText(title, { exact: true })).toBeVisible();
    }
    // The written ones expand into lesson links; the rest are plain rows with nothing to open.
    await expect(syllabus.locator("details")).toHaveCount(started);
  });

  test("the notify opt-in is offered on the catalog", async ({ page }) => {
    const d = dict.es;

    await page.goto("/cursos");
    // The redesigned notify card has no heading — it's an invitation line + a CTA. Signed out,
    // the copy asks you to sign in and the CTA is sign-in (subscribing requires an account).
    // Scope to the card (#notificaciones): signed out, the navbar also carries a "Iniciar
    // sesión" button, so an unscoped button locator is a strict-mode violation.
    const notify = page.locator("#notificaciones");
    await expect(notify.getByText(d.courses.notify.signInHint)).toBeVisible();
    await expect(notify.getByRole("button", { name: d.courses.notify.signIn })).toBeVisible();
  });

  test("the nav marks the CURRENT page — Inicio on /, Mentoría on /mentoria, Cursos on /cursos", async ({ page }) => {
    const d = dict.es;
    const nav = page.locator("nav").first();

    // ONE rule, so every item renders alike. On the home Inicio is the current item; on
    // /mentoria it is Mentoría, marked exactly the way Cursos is marked on /cursos. Never two
    // at once — the exact-match rule for "/" is what keeps Inicio dark everywhere else.
    await page.goto("/");
    await expect(nav.getByRole("link", { name: d.nav.home, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);

    await page.goto("/mentoria");
    await expect(nav.getByRole("link", { name: d.nav.mentoring, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: d.nav.home, exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);

    // On a courses route, Cursos is current — and neither Inicio nor Mentoría is, which is the
    // whole point: an accent left lit here points the reader at the wrong item.
    await page.goto("/cursos");
    await expect(nav.getByRole("link", { name: d.nav.courses, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: d.nav.home, exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: d.nav.mentoring, exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);

    // The items are marked IDENTICALLY — the complaint that started this was that they
    // were not. Same colour, same underline, whichever one you are on.
    const markedHere = await nav.locator("[aria-current='page']").evaluate(
      (el) => getComputedStyle(el).color + "|" + getComputedStyle(el).borderBottomColor,
    );
    await page.goto("/mentoria");
    const markedMentoria = await nav.locator("[aria-current='page']").evaluate(
      (el) => getComputedStyle(el).color + "|" + getComputedStyle(el).borderBottomColor,
    );
    expect(markedHere).toBe(markedMentoria);

    // A lesson is still "inside" Cursos.
    await page.goto(FIRST_LESSON_PATH);
    await expect(nav.getByRole("link", { name: d.nav.courses, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Mentoría is a real destination, from the navbar and the footer", async ({ page }) => {
    const d = dict.es;

    // `/mentoria` renders the tutoring landing. Both chrome surfaces used to carry `/#sessions`
    // plus a scroll-intent handler so the click worked from /cursos; now they are plain links
    // and land on the page — with a clean URL, since there is no fragment to strip any more.
    await page.goto("/cursos");
    await page.locator("nav").first()
      .getByRole("link", { name: d.nav.mentoring, exact: true }).click();
    await expect(page).toHaveURL(/\/mentoria$/, { timeout: 30_000 });
    await expect(page.locator("#sessions")).toBeAttached({ timeout: 15_000 });

    await page.goto("/cursos");
    await page.locator("footer")
      .getByRole("link", { name: d.footer.mentoring, exact: true }).click();
    await expect(page).toHaveURL(/\/mentoria$/, { timeout: 30_000 });
    await expect(page.locator("#sessions")).toBeAttached({ timeout: 15_000 });
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
    // `mobileOpen` gates both the panel's rendering and the hamburger's aria-expanded, so a
    // collapsed hamburger IS the panel being gone. A page-wide "Blog" link count no longer
    // isolates the panel: the footer carries its own Blog link now (BLOG-05), visible here.
    await expect(
      page.getByRole("button", { name: /men[uú]/i }).first(),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("the language switcher on an untranslated lesson does not 404", async ({ page }) => {
    // Locale detection is pathname → NEXT_LOCALE cookie → default (src/middleware.ts), so
    // while /en had no lesson pages this was a guaranteed 404 — and so was every Spanish
    // lesson URL in the sitemap for anyone holding an `en` cookie from a previous visit.
    // Pinned against a still-untranslated lesson: on a translated one the switch simply lands
    // on real English prose, and the fallback's 404 risk goes untested.
    await page.goto(`/cursos/${COURSE_SLUG}/${UNTRANSLATED_LESSON}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.getByRole("button", { name: "EN", exact: true }).click();

    await expect(page).toHaveURL(
      new RegExp(`/en/cursos/${COURSE_SLUG}/${UNTRANSLATED_LESSON}$`),
      { timeout: 30_000 },
    );
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
    const res = await page.goto(`/en/cursos/${COURSE_SLUG}/${UNTRANSLATED_LESSON}`);
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

    // The Spanish original stays indexable and — while it is untranslated — advertises no `en`
    // alternate (an alternate to the noindex fallback would be a contradictory signal). Clear
    // cookies first: the goto above set NEXT_LOCALE=en, and an unprefixed URL under that cookie
    // is redirected to /en by the middleware — correct behaviour, but not what is under test.
    await page.context().clearCookies();
    await page.goto(`/cursos/${COURSE_SLUG}/${UNTRANSLATED_LESSON}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
  });

  test("Blog is a real destination, from the navbar and the footer", async ({ page }) => {
    // Both chrome surfaces used to open a modal; the footer's was not even a link. The
    // pair is tested together because the failure this replaces was exactly the two
    // disagreeing about what the same label does.
    const d = dict.es;

    await page.goto("/cursos");

    await page.getByRole("link", { name: d.nav.blog, exact: true }).first().click();
    await expect(page).toHaveURL(/\/blog$/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", {
        name: d.blog.index.heading.replace(/<[^>]+>/g, ""),
        level: 1,
      }),
    ).toBeVisible();

    // No dialog anywhere: the ComingSoonModal was deleted with this route.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The index lists the post, and the card reaches the article itself.
    const card = page.getByRole("link", { name: new RegExp(d.blog.card.cta) }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/, { timeout: 30_000 });
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);

    // The footer's Blog is a LINK now, not a button, and lands in the same place.
    await page.locator("footer").getByRole("link", { name: d.footer.blog, exact: true }).click();
    await expect(page).toHaveURL(/\/blog$/, { timeout: 30_000 });
  });

  test("the nav marks Blog as the current page, like every other item", async ({ page }) => {
    // Blog used to be the one nav item with no `match` route — it opened a modal and was
    // never anywhere, so the "current item is green and underlined" rule could not apply
    // to it. With a real page it is marked by the same rule as Cursos and Mentoría.
    await page.goto("/blog", { timeout: 30_000 });

    const nav = page.locator("nav").first();
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(
      nav.getByRole("link", { name: dict.es.nav.blog, exact: true }).first(),
    ).toHaveAttribute("aria-current", "page");
  });
});
