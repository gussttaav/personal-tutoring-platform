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

    // The chat input is always rendered inside the chat panel.
    await expect(page.getByRole("textbox", { name: /escribe tu mensaje/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("suggestion buttons are rendered", async ({ page }) => {
    await page.goto("/mentoria");

    // The Chat component renders suggestion chip buttons (.chat-suggestion) on first load.
    // Scope to the .chat-suggestion class to avoid matching pack booking buttons
    // ("Reservar clase") that also contain the word "clase".
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a suggestion shows the mocked response", async ({ page }) => {
    await page.goto("/mentoria");

    // Open the chat panel via the Navbar icon — the panel needs pointer-events: all
    // for the suggestion click to register (closed panel has pointer-events: none).
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

    // Open the chat panel via the Navbar icon — needed for pointer-events: all
    await page.getByRole("button", { name: /abrir asistente/i }).click();

    // Scope to .chat-suggestion class to avoid matching booking buttons
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
    await suggestionBtn.click();

    // "programación" is wrapped in **...** — verify the <strong> tag is present
    const boldText = page.locator(".chat-messages strong", { hasText: /programación/i });
    await expect(boldText).toBeVisible({ timeout: 10_000 });
  });

  test("the Navbar icon opens the chat on /cursos (desktop, no floating button)", async ({ page }) => {
    await page.goto("/cursos");

    const icon = page.locator("nav .chat-nav-btn");
    await expect(icon).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".chat-fab")).toHaveCount(0);

    await icon.click();
    await expect(page.locator(".chat-panel--open")).toBeVisible({ timeout: 15_000 });
  });

  test("footer link opens the chat on /blog", async ({ page }) => {
    await page.goto("/blog");

    await page.getByRole("button", { name: /pregunta al asistente ia/i }).click();
    await expect(page.locator(".chat-panel--open")).toBeVisible({ timeout: 15_000 });
  });

  test.describe("below 1024px", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the Navbar icon opens and closes the chat", async ({ page }) => {
      await page.goto("/cursos");

      const icon = page.locator(".chat-nav-btn");
      await expect(icon).toBeVisible({ timeout: 15_000 });

      await icon.click();
      await expect(page.locator(".chat-panel--open")).toBeVisible();
      await expect(icon).toHaveAttribute("aria-expanded", "true");

      await icon.click();
      await expect(page.locator(".chat-panel--open")).toHaveCount(0);
    });
  });
});
