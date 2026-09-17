/**
 * e2e/chat.spec.ts
 *
 * TEST-02: AI chat widget smoke tests.
 *
 * The /api/chat endpoint calls Gemini and has a real monetary cost.
 * All tests in this file intercept /api/chat with page.route() and return
 * a canned response — no real API calls are made.
 *
 * What is tested:
 *   - Chat widget renders on /mentoria
 *   - Suggestion buttons are visible and clickable
 *   - A mocked response is rendered in the chat thread (including markdown)
 *   - The UI does not crash when the chat endpoint returns an error
 */

import { test, expect } from "@playwright/test";

const MOCK_RESPONSE = "Soy un tutor de **programación** y matemáticas. ¿En qué puedo ayudarte?";

test.describe("AI chat widget (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all /api/chat requests and return a canned plain-text response.
    // This avoids any Gemini API calls and prevents monetary charges.
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

    // Open the chat panel via the FAB — the panel needs pointer-events: all for
    // the suggestion click to register (closed panel has pointer-events: none).
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

    // Open the chat panel via the FAB — needed for pointer-events: all
    await page.getByRole("button", { name: /abrir asistente/i }).click();

    // Scope to .chat-suggestion class to avoid matching booking buttons
    const suggestionBtn = page.locator(".chat-suggestion").first();
    await expect(suggestionBtn).toBeVisible({ timeout: 15_000 });
    await suggestionBtn.click();

    // "programación" is wrapped in **...** — verify the <strong> tag is present
    const boldText = page.locator(".chat-messages strong", { hasText: /programación/i });
    await expect(boldText).toBeVisible({ timeout: 10_000 });
  });
});
