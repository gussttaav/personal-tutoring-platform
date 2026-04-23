# Task 4.7 — E2E Test Suite (Playwright)

**Fix ID:** `TEST-02`
**Priority:** P3
**Est. effort:** 8 hours

## Problem

Unit and integration tests verify the backend. They don't catch:

- Frontend bugs in the booking wizard
- Stripe Elements rendering issues
- Zoom SDK initialization problems
- Auth flow edge cases (redirect loops, session-expiry handling)
- Interactions between the SSE credit notification and the UI

E2E tests exercise the real application like a user would, catching integration bugs between frontend and backend.

## Scope

**Create:**
- `e2e/` — Playwright test directory
- `e2e/booking-free.spec.ts` — free 15-min session flow
- `e2e/booking-pack.spec.ts` — pack purchase + book + cancel
- `e2e/booking-single.spec.ts` — single-session purchase
- `e2e/cancellation.spec.ts` — cancel via email link
- `e2e/reschedule.spec.ts` — reschedule flow
- `e2e/chat.spec.ts` — AI chat with rate limiting
- `e2e/fixtures/` — auth helpers, Stripe helpers
- `playwright.config.ts`
- `.github/workflows/e2e.yml` — CI workflow
- `package.json` — scripts

**Do not touch:**
- Application code (unless an E2E test exposes a real bug — raise a separate issue)
- Production data

## Approach

### Step 1 — Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

### Step 2 — Configuration

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false, // our single-tutor app can't handle parallel bookings
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

### Step 3 — Auth fixture

Real Google OAuth in E2E is painful. Two approaches:

**Option A — dedicated test accounts:** Keep a real test Google account; Playwright logs in with saved cookies. Brittle when Google changes its login UI.

**Option B — test-mode auth bypass:** Add a test-only endpoint that sets a valid NextAuth session cookie for a whitelisted test email. Only enabled when `E2E_MODE=true`. Recommended — far more reliable.

```ts
// src/app/api/test/auth/route.ts — ONLY enabled when E2E_MODE=true
export async function POST(req: NextRequest) {
  if (process.env.E2E_MODE !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email, name } = await req.json();
  // Verify email is in the E2E whitelist
  const whitelist = (process.env.E2E_EMAILS ?? "").split(",");
  if (!whitelist.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Manually sign a NextAuth session JWT for this user
  // (use the same AUTH_SECRET — this produces a cookie identical to real login)
  // ... implementation ...

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `next-auth.session-token=${signedJwt}; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
}
```

```ts
// e2e/fixtures/auth.ts
import { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, name: string) {
  await page.request.post("/api/test/auth", { data: { email, name } });
  // Cookie is now set for subsequent page.goto calls
}
```

### Step 4 — Booking-free test

```ts
// e2e/booking-free.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test("student books a free 15-min session", async ({ page }) => {
  await loginAs(page, "e2e-test@example.com", "E2E Test");

  await page.goto("/");
  await page.getByRole("button", { name: /encuentro inicial/i }).click();

  // Wizard: pick a date
  await page.getByRole("button", { name: /mañana/i }).click();

  // Pick first available slot
  const slot = page.getByRole("button", { name: /\d{2}:\d{2}/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();

  // Confirm booking
  await page.getByLabel(/motivo de la sesión/i).fill("Me gustaría aprender programación");
  await page.getByRole("button", { name: /confirmar/i }).click();

  // Success page
  await expect(page).toHaveURL(/\/reserva-confirmada/);
  await expect(page.getByText(/clase confirmada/i)).toBeVisible();
});
```

### Step 5 — Booking-pack test

Uses Stripe test mode. Playwright drives the Stripe Elements iframe:

```ts
// e2e/booking-pack.spec.ts
test("student purchases a pack, books a session, cancels it", async ({ page }) => {
  await loginAs(page, "e2e-test@example.com", "E2E Test");
  await page.goto("/");

  // Purchase pack
  await page.getByRole("button", { name: /pack esencial/i }).click();
  await page.getByRole("button", { name: /pagar/i }).click();

  // Stripe Elements — fill in test card
  const stripeFrame = page.frameLocator('iframe[name*="stripe"]').first();
  await stripeFrame.locator('input[name="number"]').fill("4242424242424242");
  await stripeFrame.locator('input[name="expiry"]').fill("12/34");
  await stripeFrame.locator('input[name="cvc"]').fill("123");

  await page.getByRole("button", { name: /completar pago/i }).click();

  // SSE credits ready
  await expect(page.getByText(/¡créditos añadidos!/i)).toBeVisible({ timeout: 30_000 });

  // Book a session
  await page.getByRole("link", { name: /reservar clase/i }).click();
  await page.getByRole("button", { name: /pasado mañana/i }).click();
  await page.getByRole("button", { name: /\d{2}:\d{2}/ }).first().click();
  await page.getByRole("button", { name: /confirmar/i }).click();
  await expect(page).toHaveURL(/\/reserva-confirmada/);

  // Go to personal area, verify booking shows up
  await page.goto("/area-personal");
  await expect(page.getByText(/próxima sesión/i)).toBeVisible();

  // Cancel it
  await page.getByRole("button", { name: /cancelar/i }).click();
  await page.getByRole("button", { name: /confirmar cancelación/i }).click();
  await expect(page.getByText(/reserva cancelada/i)).toBeVisible();

  // Credit restored
  await expect(page.getByText(/4 créditos restantes/i)).toBeVisible();
});
```

### Step 6 — CI workflow

```yaml
# .github/workflows/e2e.yml
name: E2E tests
on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E against preview deployment
        run: npx playwright test
        env:
          E2E_BASE_URL:  ${{ steps.deploy-preview.outputs.url }}
          E2E_MODE:      "true"
          E2E_EMAILS:    "e2e-test@example.com,e2e-admin@example.com"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Step 7 — Package scripts

```json
{
  "scripts": {
    "test:e2e":         "playwright test",
    "test:e2e:ui":      "playwright test --ui",
    "test:e2e:headed":  "playwright test --headed"
  }
}
```

## Acceptance Criteria

- [ ] Playwright installed, config exists
- [ ] Six E2E test files covering the flows listed
- [ ] `loginAs` fixture works via test-mode auth bypass
- [ ] Test-auth endpoint returns 404 when `E2E_MODE !== "true"`
- [ ] Test-auth endpoint validates against `E2E_EMAILS` whitelist
- [ ] All tests run successfully against local dev (`npm run dev` + `npm run test:e2e`)
- [ ] All tests run successfully against a Vercel preview deployment
- [ ] CI workflow runs E2E on every PR
- [ ] Failed tests upload screenshots + video + trace artifacts
- [ ] README documents how to run E2E locally
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **10. Testing Strategy → E2E Tests**.

## Testing

Run the tests locally first:

```bash
npm run dev &
E2E_MODE=true E2E_EMAILS=e2e-test@example.com npm run test:e2e:headed
```

Watch the browser automate the flows. Fix any flaky selectors (prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors).

## Out of Scope

- Cross-browser testing — chromium only is sufficient for now
- Mobile viewports — add if mobile issues surface in practice
- Load / performance testing

## Rollback

Tests only — safe to revert. If the test-auth endpoint becomes a security concern (e.g., someone forgets to unset `E2E_MODE` in production), the production startup check from Task 2.1 can be extended to fail if `E2E_MODE === "true"` in production:

```ts
// src/lib/startup-checks.ts
if (process.env.NODE_ENV === "production" && process.env.E2E_MODE === "true") {
  throw new Error("E2E_MODE must not be enabled in production");
}
```

Add this guard.
