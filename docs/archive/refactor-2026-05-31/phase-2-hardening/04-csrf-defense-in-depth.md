# Task P2-04 — CSRF defense in depth (`Sec-Fetch-Site`)

**Severity:** 🟢 Low
**Effort:** 30 minutes
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`lib/csrf.ts` checks `Origin` against `NEXT_PUBLIC_BASE_URL`. Correct for fetch/XHR. Belt-and-suspenders: also check `Sec-Fetch-Site`, which is unspoofable from page-controlled code on all evergreen browsers.

## Context

### The current code

```typescript
// src/lib/csrf.ts:4928
export function isValidOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) return false;
  if (!origin) return false;  // ← this is the soft spot

  try {
    return new URL(origin).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
```

### What's already good

- `SameSite=Lax` on the session cookie (auth.ts) prevents basic CSRF
- `Origin` is set by browsers on all fetch/XHR POSTs
- The check rejects mismatched origins

### What's still possible

`Origin` may be omitted by:

- Some old form submissions (`<form method="POST">` in pre-2020 Safari)
- Requests from non-browser clients (curl, scripts) — not a CSRF vector by definition
- Some misconfigured proxies that strip headers

In those cases, the current code returns `false` (deny) — that's the safe default. So the current code is **not insecure**; it's just **noisy**: legitimate corner-case requests get denied alongside attacks.

`Sec-Fetch-Site` is a Fetch Metadata header sent by all evergreen browsers (Chrome 76+, Firefox 90+, Safari 16+, Edge 79+). Values: `same-origin`, `same-site`, `cross-site`, `none`. A cross-site CSRF attempt always has `cross-site`. The page cannot set this header; only the browser can.

## Files affected

| File | Change |
|------|--------|
| `src/lib/csrf.ts` | Add `Sec-Fetch-Site` check before `Origin` |
| `src/lib/__tests__/csrf.test.ts` | New tests |

## The change

### `src/lib/csrf.ts`

```typescript
/**
 * lib/csrf.ts — CSRF protection via Origin + Sec-Fetch-Site validation
 *
 * SEC-04: NextAuth's session cookie is SameSite=Lax, which mitigates the
 * basic form-POST CSRF vector. This adds defense in depth by rejecting any
 * state-mutating request whose Origin does not match our own origin OR whose
 * Sec-Fetch-Site indicates a cross-site request.
 *
 * REFACTOR-P2-04: Sec-Fetch-Site is unspoofable from page-controlled code
 * on all evergreen browsers (Chrome 76+, Firefox 90+, Safari 16+, Edge 79+).
 * It's checked first because:
 *   - It catches cross-site requests even when Origin happens to be missing
 *   - It's cheaper than parsing a URL
 *
 * Exemptions:
 *   - /api/stripe/webhook has signature verification (better auth than CSRF)
 *   - /api/internal/zoom-terminate has QStash signature verification
 *   - /api/internal/zoom-terminate-fallback has CRON_SECRET
 *   - /api/auth/* handled by NextAuth
 */

import type { NextRequest } from "next/server";

export function isValidOrigin(req: NextRequest): boolean {
  // REFACTOR-P2-04: Check Sec-Fetch-Site first. Values:
  //   "same-origin": from our own page — allow
  //   "same-site":   from a same-eTLD+1 subdomain — allow (we have none today)
  //   "none":        not from a page (user typed URL, browser opened directly) — allow
  //                  Also: not present in older browsers — fall through to Origin check
  //   "cross-site":  from a different site — DENY
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  // Origin check (existing behaviour)
  const origin  = req.headers.get("origin");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return false;
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
```

## Acceptance criteria

- [ ] Requests with `Sec-Fetch-Site: cross-site` are denied even if `Origin` matches
- [ ] Requests with `Sec-Fetch-Site: same-origin` are allowed if `Origin` matches
- [ ] Requests with no `Sec-Fetch-Site` (older browsers, server-to-server) still fall through to `Origin` validation
- [ ] No existing functionality breaks
- [ ] New unit tests cover all four `Sec-Fetch-Site` values

## Test plan

### Update `src/lib/__tests__/csrf.test.ts`

```typescript
import { NextRequest } from "next/server";
import { isValidOrigin } from "../csrf";

const BASE = "https://gustavoai.dev";

function reqWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://gustavoai.dev/api/foo", { headers });
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_URL = BASE;
});

describe("isValidOrigin", () => {
  it("allows same-origin requests", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
  });

  // REFACTOR-P2-04: new tests
  it("denies cross-site requests even when origin happens to match", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,                  // could be spoofed in non-browser clients
      "sec-fetch-site": "cross-site",  // but browsers tell the truth here
    }))).toBe(false);
  });

  it("allows same-site requests (future subdomain support)", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
      "sec-fetch-site": "same-site",
    }))).toBe(true);
  });

  it("falls back to origin check when sec-fetch-site is absent", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
    }))).toBe(true);
  });

  it("denies when origin mismatches", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": "https://evil.example.com",
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });

  it("denies when origin is absent", () => {
    expect(isValidOrigin(reqWithHeaders({}))).toBe(false);
  });
});
```

### Manual verification

Hard to test in a browser (the browser sets `Sec-Fetch-Site` automatically). Use curl:

```bash
# Simulating a cross-site attack
curl -X POST https://gustavoai.dev/api/book \
  -H "Origin: https://gustavoai.dev" \
  -H "Sec-Fetch-Site: cross-site" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{}'
# Expected: 403
```

## Notes / gotchas

- **Order matters:** `Sec-Fetch-Site` check before `Origin` check is intentional. Cheaper, catches the highest-risk case (cross-site) explicitly.
- **`Sec-Fetch-Site: none`** is sent when the request was not initiated from a page (e.g. user typed URL directly, or it's a server-to-server call). We do not reject this — same as legacy behavior.
- **No coverage for IE11 / Safari <16:** they don't send `Sec-Fetch-Site`. We rely on `Origin` + `SameSite=Lax` for those. Acceptable; <0.5% market share.
- **Stripe webhook / QStash callbacks:** these don't have `Origin` either; they're already exempted by not calling `isValidOrigin`. No change.

## Out of scope

- Adopting full Fetch Metadata isolation (`Sec-Fetch-Mode`, `Sec-Fetch-Dest`, `Sec-Fetch-User`). The Site check covers the CSRF use case; the rest is for more elaborate isolation patterns.
- Per-request CSRF tokens. Origin-based works for same-origin SPAs; tokens add ceremony with no marginal benefit here.
