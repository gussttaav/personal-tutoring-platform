# Task 2.4 — Chat Route Auth + Tiered Rate Limiting

**Fix ID:** `REL-04`
**Priority:** P2 — Medium
**Est. effort:** 1–2 hours

## Problem

`POST /api/chat` calls the Gemini API on behalf of any visitor. It is rate-limited at 20 requests/minute per IP, but:

- No authentication check — anyone can call it
- 20 requests/minute per IP over 24 hours = up to 28,800 requests/IP/day
- Gemini 2.5 Flash at ~512 output tokens averages ~€0.001 per request
- A single abuser via VPN rotation could drive meaningful Gemini costs

The chat is intentionally public (it's the landing-page assistant for prospective students), so full authentication is not appropriate. But unauthenticated users should have much tighter limits than authenticated ones.

## Scope

**Modify:**
- `src/app/api/chat/route.ts` — check auth, apply tiered limits
- `src/lib/ratelimit.ts` — add a second, stricter limiter for anonymous users

**Do not touch:**
- The Gemini client or prompt
- The chat UI component behavior
- Other rate-limited routes

## Approach

### Step 1 — Add a stricter anonymous limiter

```ts
// src/lib/ratelimit.ts — add at the bottom

/**
 * REL-04 — Anonymous chat: 5 messages per minute per IP.
 * Authenticated users continue to use chatRatelimit (20/min).
 */
export const chatRatelimitAnon = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix:  "rl:chat:anon",
});

/**
 * REL-04 — Anonymous chat daily cap: 30 messages per day per IP.
 * This caps total Gemini spend per anonymous IP. Authenticated users
 * rely on the 20/min limiter only (no daily cap for signed-in users).
 */
export const chatRatelimitAnonDaily = new Ratelimit({
  redis:   kv,
  limiter: Ratelimit.slidingWindow(30, "1 d"),
  prefix:  "rl:chat:anon:daily",
});
```

### Step 2 — Apply in the chat route

```ts
// src/app/api/chat/route.ts
import { auth } from "@/auth";
import { chatRatelimit, chatRatelimitAnon, chatRatelimitAnonDaily } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const session = await auth();
  const isAuthenticated = !!session?.user?.email;

  // Tiered rate limiting
  if (isAuthenticated) {
    const { success } = await chatRatelimit.limit(`auth:${session.user.email}`);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento." },
        { status: 429 }
      );
    }
  } else {
    // Apply both per-minute and per-day limits for anonymous users
    const [perMinute, perDay] = await Promise.all([
      chatRatelimitAnon.limit(ip),
      chatRatelimitAnonDaily.limit(ip),
    ]);

    if (!perMinute.success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento." },
        { status: 429 }
      );
    }

    if (!perDay.success) {
      return NextResponse.json(
        {
          error: "Has alcanzado el límite diario. Inicia sesión para seguir chateando, o vuelve mañana.",
          requiresAuth: true,
        },
        { status: 429 }
      );
    }
  }

  // ... rest of handler unchanged
}
```

### Step 3 — (Optional) UI nudge

The response includes `requiresAuth: true` when the daily anonymous cap is hit. The chat UI can surface a "Sign in to continue" CTA. This is optional — the task is complete without a UI change; the server-side limits work regardless.

## Acceptance Criteria

- [ ] `chatRatelimitAnon` and `chatRatelimitAnonDaily` exist in `ratelimit.ts`
- [ ] Chat route checks `auth()` and applies different limiters per state
- [ ] Authenticated users use `chatRatelimit` keyed by email (not IP — so they can switch networks)
- [ ] Anonymous users use both `chatRatelimitAnon` and `chatRatelimitAnonDaily` in parallel
- [ ] Daily-cap response includes `requiresAuth: true` flag
- [ ] Manual test: 6 rapid requests from same IP while anonymous → 6th returns 429
- [ ] Manual test: sign in → 20 requests work → 21st returns 429
- [ ] Fix-ID comments added
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **1. Key Issues → Issue 7** and **2. Refactor Plan → Phase 2: Chat auth**.

## Testing

Add a test to `src/lib/__tests__/ratelimit.test.ts` (create the file if it doesn't exist):

```ts
describe("chat rate limits", () => {
  it("allows up to 5 anonymous requests per minute", async () => {
    const ip = `test-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const { success } = await chatRatelimitAnon.limit(ip);
      expect(success).toBe(true);
    }
    const { success } = await chatRatelimitAnon.limit(ip);
    expect(success).toBe(false);
  });
});
```

(This test hits a real Upstash instance — mark it as integration and skip in CI if needed.)

## Out of Scope

- Implementing the UI sign-in nudge (optional)
- Changing the Gemini model or prompt
- Adding per-session context (future: conversation history could be stored in Redis per session)
- Changing authenticated user limits

## Rollback

Safe. Reverting restores the previous (single-tier, IP-only) rate limiting. No data changes.

Watch for false positives: shared networks (offices, universities) may hit the anonymous daily cap collectively if several students use the chat from the same outbound IP. If this happens in practice, raise the anonymous daily cap to 60 or switch to a device-fingerprint key — but measure first.
