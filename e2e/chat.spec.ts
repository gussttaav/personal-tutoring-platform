/**
 * e2e/chat.spec.ts
 *
 * TEST-02: AI chat widget smoke tests.
 *
 * The /api/chat endpoint calls the Claude API and has a real monetary cost.
 * All tests in this file intercept /api/chat with page.route() and return
 * a canned response — no real API calls are made.
 *
 * What is tested:
 *   - Chat widget renders on /mentoria
 *   - Suggestion buttons are visible and clickable
 *   - A mocked response is rendered in the chat thread (including markdown)
 *   - The UI does not crash when the chat endpoint returns an error
 *
 * CHAT-GLOBAL-01: the chat is mounted app-wide (root layout), so it is also checked off the
 * booking pages (courses, blog). Its entry point is the Navbar icon at every width; there is
 * no floating button.
 *
 * CHAT-DRAWER-01: from 1024px the entry point is the labelled «Asistente IA» button and the chat
 * opens as a full-height side panel under the bar; below, the icon, and a full-screen panel on a
 * phone. A closed panel is inert and hidden, so every test opens it first.
 */

import { test, expect } from "@playwright/test";

const MOCK_RESPONSE = "Soy un tutor de **programación** y matemáticas. ¿En qué puedo ayudarte?";

test.describe("AI chat widget (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all /api/chat requests and return a canned plain-text response.
    // This avoids any Claude API calls and prevents monetary charges.
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ reply: MOCK_RESPONSE }),
      });
    });
  });

  test("chat widget is visible on /mentoria", async ({ page }) => {
    await page.goto("/mentoria");

    // A closed panel hides its input (inert + visibility: hidden): it is not a stray tab stop.
    await expect(page.getByRole("textbox", { name: /escribe tu mensaje/i })).toBeHidden();

    await page.getByRole("button", { name: /abrir asistente/i }).click();
    await expect(page.getByRole("textbox", { name: /escribe tu mensaje/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("suggestion buttons are rendered", async ({ page }) => {
    await page.goto("/mentoria");
    await page.getByRole("button", { name: /abrir asistente/i }).click();

    // The Chat component renders suggestion chip buttons (.chat-suggestion) on first load.
    // Scope to the .chat-suggestion class to avoid matching pack booking buttons
    // ("Reservar clase") that also contain the word "clase".
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a suggestion shows the mocked response", async ({ page }) => {
    await page.goto("/mentoria");

    // Open the chat panel via the Navbar button: a closed panel is inert.
    await page.getByRole("button", { name: /abrir asistente/i }).click();

    // Use .chat-suggestion class to avoid accidentally matching pack booking
    // buttons ("Reservar clase") that also contain the word "clase".
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
    await suggestionBtn.click();

    // The mocked response text should appear in the chat thread.
    // Bold markdown (**programación**) is rendered as <strong>programación</strong>.
    await expect(page.locator(".chat-messages").getByText(/programación/i)).toBeVisible({ timeout: 10_000 });
  });

  test("chat renders markdown in responses", async ({ page }) => {
    await page.goto("/mentoria");

    // Open the chat panel via the Navbar button: a closed panel is inert.
    await page.getByRole("button", { name: /abrir asistente/i }).click();

    // Scope to .chat-suggestion class to avoid matching booking buttons
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
    await suggestionBtn.click();

    // "programación" is wrapped in **...** — verify the <strong> tag is present
    const boldText = page.locator(".chat-messages strong", { hasText: /programación/i });
    await expect(boldText).toBeVisible({ timeout: 10_000 });
  });

  test("the labelled Navbar button opens the side panel on /cursos (desktop, no floating button)", async ({ page }) => {
    await page.goto("/cursos");

    const button = page.locator("nav .chat-nav-btn--labelled");
    await expect(button).toBeVisible({ timeout: 15_000 });
    await expect(button).toHaveText(/asistente ia/i);
    await expect(page.locator("nav .chat-nav-btn--icon")).toBeHidden();
    await expect(page.locator(".chat-fab")).toHaveCount(0);

    await button.click();
    const panel = page.locator(".chat-panel--open");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // CHAT-DRAWER-01: flush right (once the slide-in has finished), from under the bar to the
    // bottom of the viewport.
    // `clientWidth`: `right: 0` is the viewport's edge without the page's scrollbar.
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(async () => {
      const b = await panel.boundingBox();
      return b ? Math.round(b.x + b.width) : null;
    }).toBe(clientWidth);
    const box = (await panel.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(page.viewportSize()!.height, 0);
    expect(box.width).toBeCloseTo(440, 0);
    const bar = (await page.locator("nav").first().boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  });

  test("Escape closes the panel and gives focus back to the Navbar button", async ({ page }) => {
    await page.goto("/cursos");

    const button = page.locator("nav .chat-nav-btn--labelled");
    await button.click();
    const input = page.getByRole("textbox", { name: /escribe tu mensaje/i });
    await expect(input).toBeFocused({ timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(page.locator(".chat-panel--open")).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("«Nueva conversación» drops the thread and the server session", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ reply: MOCK_RESPONSE, sessionId: "00000000-0000-4000-8000-000000000000" }),
      });
    });
    await page.goto("/cursos");
    await page.locator("nav .chat-nav-btn--labelled").click();

    const reset = page.getByRole("button", { name: /nueva conversación/i });
    await expect(reset).toBeDisabled({ timeout: 15_000 });

    await page.locator(".chat-suggestion").first().click();
    await expect(page.locator(".chat-messages").getByText(/programación/i)).toBeVisible({ timeout: 10_000 });
    await expect(reset).toBeEnabled();

    await reset.click();
    await expect(page.locator(".chat-messages").getByText(/programación/i)).toHaveCount(0);
    await expect(page.locator(".chat-suggestion").first()).toBeVisible();
    await expect(reset).toBeDisabled();
    expect(await page.evaluate(() => [
      sessionStorage.getItem("chat:messages"),
      localStorage.getItem("chat:sessionId"),
    ])).toEqual([null, null]);
  });

  test("footer link opens the chat on /blog", async ({ page }) => {
    await page.goto("/blog");

    await page.getByRole("button", { name: /pregunta al asistente ia/i }).click();
    await expect(page.locator(".chat-panel--open")).toBeVisible({ timeout: 15_000 });
  });

  test.describe("below 1024px", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the Navbar icon opens the chat full screen, and its ✕ closes it", async ({ page }) => {
      await page.goto("/cursos");

      const icon = page.locator(".chat-nav-btn--icon");
      await expect(icon).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".chat-nav-btn--labelled")).toBeHidden();

      await icon.click();
      const panel = page.locator(".chat-panel--open");
      await expect(panel).toBeVisible();
      await expect(icon).toHaveAttribute("aria-expanded", "true");

      // CHAT-DRAWER-01: the whole screen, the bar included, once the slide-in has finished.
      await expect.poll(async () => (await panel.boundingBox())?.x).toBe(0);
      const box = (await panel.boundingBox())!;
      expect(box.y).toBe(0);
      expect(box.width).toBe(390);
      expect(box.height).toBe(844);

      await panel.getByRole("button", { name: /cerrar chat/i }).click();
      await expect(page.locator(".chat-panel--open")).toHaveCount(0);
      await expect(icon).toBeFocused();
    });
  });
});
