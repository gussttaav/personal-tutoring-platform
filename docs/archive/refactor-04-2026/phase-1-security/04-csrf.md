# Task 1.4 — CSRF Protection Middleware

**Fix ID:** `SEC-04`
**Priority:** P1 — High
**Est. effort:** 1–2 hours

## Problem

Next.js API routes that use cookie-based authentication (NextAuth JWT session cookie) are vulnerable to Cross-Site Request Forgery. An attacker can host a malicious page that submits a form to `POST /api/book`, `POST /api/cancel`, etc. When a logged-in user visits that page, the browser automatically sends the session cookie, and the request succeeds from the server's perspective.

NextAuth v5 sets `sameSite: "lax"` on the session cookie, which blocks the basic form-POST CSRF vector in modern browsers — but:

- `SameSite=Lax` does **not** block `GET` top-level navigation, so any state-changing `GET` is still vulnerable (none currently, but a defensive measure prevents future regressions)
- `SameSite=Lax` is bypassable via link clicks for some request types
- Older browsers and specific configurations may not enforce it
- Defense in depth is the goal

## Scope

**Create:**
- `src/middleware.ts` (Next.js global middleware) OR
- `src/lib/csrf.ts` (helper called from each route — simpler, chosen approach)

**Modify:**
- Every `POST` route under `src/app/api/` **except** `/api/stripe/webhook` and `/api/auth/[...nextauth]`

**Do not touch:**
- `/api/stripe/webhook` — already protected by Stripe signature verification
- `/api/auth/[...nextauth]` — NextAuth handles its own CSRF tokens
- `/api/zoom/end` — protected by `X-Internal-Secret` header (not user-facing)
- `GET` routes — not the target of CSRF

## Approach

### Option chosen: helper function called from each route

A global middleware is cleaner but has edge-case issues with the `/api/stripe/webhook` exemption and with Edge runtime constraints. A small helper called at the top of each protected route is explicit and easy to review.

### Step 1 — Create the helper

```ts
// src/lib/csrf.ts
/**
 * SEC-04 — CSRF protection via Origin header validation.
 *
 * NextAuth's session cookie is SameSite=Lax, which mitigates the basic
 * form-POST CSRF vector. This adds defense in depth by rejecting any
 * state-mutating request whose Origin does not match our own origin.
 *
 * Why not CSRF tokens?
 *   - Our API is consumed exclusively by our own frontend on the same origin
 *   - Origin header is set by the browser on all fetch/XHR POSTs
 *   - Cookie-bearing cross-origin requests will have a different Origin
 *   - Simpler, no token lifecycle to manage
 *
 * Exemptions:
 *   - /api/stripe/webhook has signature verification (better auth than CSRF)
 *   - /api/zoom/end has X-Internal-Secret (not user-facing)
 *   - /api/auth/* handled by NextAuth
 */

import type { NextRequest } from "next/server";

export function isValidOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl) return false;         // Misconfiguration — fail closed
  if (!origin) return false;           // Browsers always set Origin on POST

  try {
    return new URL(origin).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
```

### Step 2 — Apply to each POST route

At the top of each `POST` handler, before any other work:

```ts
import { isValidOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ... rest of handler
}
```

### Routes requiring the check

| Route | Already has other auth? | Apply CSRF check? |
|---|---|---|
| `/api/book` | Yes (auth()) | **Yes** |
| `/api/cancel` | No | **Yes** |
| `/api/chat` | No | **Yes** |
| `/api/chat-session` (POST) | Yes | **Yes** |
| `/api/stripe/checkout` | Yes | **Yes** |
| `/api/stripe/webhook` | Signature | **No — exempt** |
| `/api/zoom/token` | Yes | **Yes** |
| `/api/zoom/end` | X-Internal-Secret | **No — exempt** |

## Acceptance Criteria

- [ ] `src/lib/csrf.ts` exists with the `isValidOrigin` helper
- [ ] The helper has a JSDoc block explaining the SEC-04 fix
- [ ] Each POST route in the table above (marked "Yes") calls `isValidOrigin(req)` first
- [ ] Exempt routes are **not** modified
- [ ] Unit test for `isValidOrigin`: valid origin → true, different origin → false, missing origin → false, missing `NEXT_PUBLIC_BASE_URL` → false
- [ ] Manual verification: craft a `curl -X POST` without `Origin` header → expect 403
- [ ] Manual verification: normal in-app booking still works
- [ ] `npm test` passes
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **6. Security Fixes → Fix 4**.

## Testing

Add tests to a new file `src/lib/__tests__/csrf.test.ts`:

```ts
import { isValidOrigin } from "@/lib/csrf";

function mockReq(origin: string | null): any {
  return { headers: { get: (k: string) => k === "origin" ? origin : null } };
}

describe("isValidOrigin", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_BASE_URL = "https://gustavoai.dev"; });

  it("accepts the configured origin", () => {
    expect(isValidOrigin(mockReq("https://gustavoai.dev"))).toBe(true);
  });

  it("rejects a different origin", () => {
    expect(isValidOrigin(mockReq("https://evil.com"))).toBe(false);
  });

  it("rejects missing origin", () => {
    expect(isValidOrigin(mockReq(null))).toBe(false);
  });

  it("rejects malformed origin", () => {
    expect(isValidOrigin(mockReq("not-a-url"))).toBe(false);
  });
});
```

## Out of Scope

- CSRF tokens (cookie-based, double-submit pattern) — overkill for our use case
- Migrating to a global `middleware.ts` — keep explicit for now
- Rate limiting changes

## Rollback

If legitimate users start getting 403s, the most likely cause is:
- The preview domain differs from `NEXT_PUBLIC_BASE_URL`
- A reverse proxy strips or rewrites the `Origin` header

Check Vercel's preview URL vs the env var. Temporary mitigation: revert the PR; the SameSite cookie still provides partial protection.
