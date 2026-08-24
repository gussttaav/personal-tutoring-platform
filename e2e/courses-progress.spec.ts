/**
 * e2e/courses-progress.spec.ts
 *
 * COURSE-P4-02: lesson progress survives a reload.
 *
 * Flow:
 *   1. Read a lesson SIGNED OUT — it must render fully, with no progress UI
 *   2. Sign in, reload, mark the lesson complete
 *   3. Reload again — the tick must still be there (it came from Postgres, not state)
 *
 * Spanish only, deliberately: `generateStaticParams` is published-only and there is
 * no `en` content tree, so `/en/cursos/...` legitimately 404s until P5 translates.
 * Adding the locale loop here would assert a page that is not supposed to exist.
 *
 * The lesson under test is Block 1 lesson 1, the first real published lesson. It was
 * the P1-01 rendering fixture until P5-00 restored that file to `draft: true` — which
 * made `generateStaticParams` stop emitting it, so the old URL here 404'd. Any future
 * change to which lessons are published has to be reflected in this constant.
 *
 * TIMEOUTS: generous on purpose, and not padding. The progress UI is client-fetched
 * after hydration, and this lesson is the heaviest page in the app — MDX + KaTeX +
 * eight widgets + the Pyodide cells. Under the local `pnpm dev` server the first paint
 * of the mark-complete button was measured well past 10s. Against a production build
 * it is far quicker; don't trim these to what a prod run gets away with.
 */

import { test, expect } from "@playwright/test";
import { loginAs, E2E_USER } from "./fixtures/auth";
import { resetTestState }    from "./fixtures/cleanup";
import { dict }              from "./helpers/dict";

const d = dict.es;
const LESSON_URL = "/cursos/dl-nlp/texto-como-numeros";
const LESSON_SLUG = "texto-como-numeros";
/** First `<Quiz>` in that lesson; option "b" is its correct answer. */
const QUIZ_PROMPT = /¿Cuál es la razón de fondo/;
const QUIZ_CORRECT = /Porque una red solo está definida sobre vectores de números reales/;
/** From content/courses/dl-nlp/course.es.yml — the title the P4-03 panel renders. */
const COURSE_TITLE = "Deep Learning para NLP: del Perceptrón al Transformer";

test.describe("Course lesson progress [es]", () => {
  test.beforeEach(async () => {
    await resetTestState();
  });

  test("signed-out reading works and shows no progress UI", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(LESSON_URL);

    // The lesson itself renders — reading never requires an account.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // ...and none of the progress affordances appear.
    await expect(page.getByRole("button", { name: d.courses.progress.markComplete })).toHaveCount(0);

    // The API answers 204 rather than 401 precisely so this stays empty.
    expect(consoleErrors.filter((e) => /401|Unauthorized/i.test(e))).toEqual([]);
  });

  test("marking a lesson complete survives a reload", async ({ page }) => {
    await loginAs(page, E2E_USER.email, E2E_USER.name);

    await page.goto(LESSON_URL);

    const markComplete = page.getByRole("button", { name: d.courses.progress.markComplete });
    await expect(markComplete).toBeVisible({ timeout: 30_000 });

    await markComplete.click();

    // Optimistic: the confirmation swaps in without waiting for the round trip.
    await expect(page.getByText(d.courses.progress.completed)).toBeVisible();

    // The real assertion — after a reload the tick can only come from Postgres.
    await page.reload();

    await expect(page.getByText(d.courses.progress.completed)).toBeVisible({ timeout: 30_000 });
    await expect(markComplete).toHaveCount(0);

    // The sidebar row for this lesson is marked done too.
    await expect(
      page.locator(`[data-lesson-slug="${LESSON_SLUG}"][data-lesson-done="true"]`).first(),
    ).toBeAttached({ timeout: 30_000 });
  });

  // COURSE-P4-04 — the attempt itself survives, not just the lesson tick.
  test("an answered quiz comes back answered after a reload", async ({ page }) => {
    await loginAs(page, E2E_USER.email, E2E_USER.name);

    await page.goto(LESSON_URL);

    // Scope to the first quiz card: the lesson has three, and every one of them
    // renders the same control labels.
    const card = page.locator("section").filter({ hasText: QUIZ_PROMPT }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });

    // The attempt POST is fire-and-forget by design (a lost attempt must never
    // interrupt a student mid-quiz) AND it fires from an effect one tick after the
    // optimistic verdict renders. So the verdict below is NOT proof the row exists:
    // reloading on it alone aborts the in-flight request and the reload restores
    // nothing. Arm the wait before submitting, then block on the persisted 200.
    const attemptSaved = page.waitForResponse(
      (res) =>
        res.url().includes("/api/courses/attempt") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 30_000 },
    );

    await card.getByText(QUIZ_CORRECT).click();
    await card.getByRole("button", { name: d.courses.quiz.submit }).click();

    await expect(card.getByText(d.courses.quiz.correct, { exact: false })).toBeVisible();
    await attemptSaved;

    // The real assertion: after a reload this can only have come from quiz_attempts.
    await page.reload();

    const restored = page.locator("section").filter({ hasText: QUIZ_PROMPT }).first();
    await expect(restored.getByText(d.courses.quiz.correct, { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    // Their own answer is selected again, and the card is back in its answered state.
    await expect(restored.getByRole("radio", { name: QUIZ_CORRECT })).toBeChecked();
    await expect(restored.getByRole("button", { name: d.courses.quiz.retry })).toBeVisible();

    // Still ONE attempt: a page load must never record a new one.
    await expect(restored.getByText(/^1 intento$/)).toBeVisible();
  });

  // COURSE-P4-03 — the same enrolment, seen from the other half of the site.
  test("the personal area lists the enrolled course with a resume link", async ({ page }) => {
    await loginAs(page, E2E_USER.email, E2E_USER.name);

    // Opening the lesson is what enrols (there is no enrol button); waiting for the
    // progress UI proves the `seen` write has been accepted before we navigate away.
    await page.goto(LESSON_URL);
    await expect(
      page.getByRole("button", { name: d.courses.progress.markComplete }),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/area-personal");

    // The redesign put enrolled courses behind a tab. The tab button carries the
    // "Mis cursos" label (the pane deliberately does not repeat it as a heading,
    // or this exact-match locator would resolve to two elements), so waiting on it
    // still proves the page rendered — but the card itself needs the tab opened.
    const coursesTab = page.getByRole("tab", {
      name: new RegExp(d.areaPersonal.main.tabs.courses, "i"),
    });
    await expect(coursesTab).toBeVisible({ timeout: 30_000 });
    await coursesTab.click();

    await expect(page.getByText(COURSE_TITLE, { exact: true })).toBeVisible();

    // Nothing completed yet, so the card offers "empezar" — and it points at a lesson.
    const resume = page.getByRole("link", {
      name: new RegExp(d.areaPersonal.courses.startCta, "i"),
    });
    await expect(resume).toBeVisible();
    await expect(resume).toHaveAttribute("href", new RegExp(`/cursos/dl-nlp/`));
  });
});
