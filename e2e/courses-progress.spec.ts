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
 * The lesson under test is the P1-01 rendering fixture, which is the only published
 * lesson until Phase 5. When real content lands, prefer a real lesson slug.
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
const LESSON_URL = "/cursos/dl-nlp/pipeline-fixture";
const LESSON_SLUG = "pipeline-fixture";

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
});
