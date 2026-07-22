# P2-02 — Rate-limit `/api/cancel`; clean up `zoom/token`'s limiter

**Tag:** `REFACTOR-R3-P2-02` · **Severity:** 🟡 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`POST /api/cancel` is deliberately unauthenticated (cancel links in emails) but is the only
POST route with **no rate limiter**, permitting unbounded token guessing. Separately,
`POST /api/zoom/token` hand-rolls `x-forwarded-for` parsing instead of `getClientIp()` and
borrows `availabilityRatelimit` with a key prefix. Add two dedicated limiters and use the
shared IP helper.

## Context

- `src/app/api/cancel/route.ts:17-31` — CSRF check + token parse; no limiter. Tokens are
  high-entropy (HMAC, `CANCEL_SECRET` ≥ 32 chars enforced at startup), so this is consistency
  hardening, not an open door — but every other unauthenticated/POST surface is limited.
- `src/app/api/zoom/token/route.ts:52-57` — inline `req.headers.get("x-forwarded-for")?.split(",")[0]` duplicating `getClientIp()` (`src/lib/ip-utils.ts`), keyed into `availabilityRatelimit` as `zoom:token:${ip}`.
- `src/lib/ratelimit.ts` — 11 existing limiters; follow the same construction pattern (project rule: new limiters live here).

## Files affected

| File | Change |
|------|--------|
| `src/lib/ratelimit.ts` | Add `cancelRatelimit` (5/min per IP) and `zoomTokenRatelimit` (10/min per IP) |
| `src/app/api/cancel/route.ts` | Apply `cancelRatelimit` before CSRF/parse |
| `src/app/api/zoom/token/route.ts` | Use `getClientIp()` + `zoomTokenRatelimit`; drop the inline parsing |

## The change

```ts
// src/lib/ratelimit.ts (mirror the existing style, e.g. reviewRatelimit)
// REFACTOR-R3-P2-02: unauthenticated cancel endpoint — tight per-IP cap.
export const cancelRatelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:cancel",
});

// REFACTOR-R3-P2-02: dedicated limiter (was piggybacking on availabilityRatelimit).
export const zoomTokenRatelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:zoomtoken",
});
```

```ts
// cancel/route.ts — top of postHandler (before isValidOrigin, matching reviews/subscribe order)
const { success } = await cancelRatelimit.limit(getClientIp(req));
if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
```

```ts
// zoom/token/route.ts — replace lines 52-57
const { success } = await zoomTokenRatelimit.limit(getClientIp(req));
if (!success) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
```

## Acceptance criteria

- [ ] 6th `POST /api/cancel` from one IP within a minute → 429; legit single cancel unaffected
- [ ] `zoom/token` has no inline header parsing; uses `getClientIp` + `zoomTokenRatelimit`
- [ ] A user joining a session (PreJoin → join, incl. one retry) stays comfortably under 10/min
- [ ] Limiter prefixes follow the existing `rl:*` Redis namespace (CLAUDE.md data-storage contract)
- [ ] File-top comment blocks updated with `REFACTOR-R3-P2-02`

## Test plan

- **Existing:** `pnpm test`; e2e cancel + join flows (`pnpm test:e2e` — re-run once on a single unrelated flake, known issue).
- **New (integration, `src/__tests__/integration/`):** hammer the cancel handler 6× with a mocked limiter store → expect the 6th to 429 (follow the pattern used by existing rate-limit tests if present; otherwise a unit test on handler ordering is enough).
- **Manual:** cancel a real dev booking via the email link — one request, succeeds.

## Notes / gotchas

- Keep the limiter **before** `isValidOrigin` on cancel (cheapest rejection first — matches `reviews`/`subscribe` ordering).
- The cancel page may render server-side and then POST once; 5/min is generous for humans, hostile to scanners. If support ever reports legit 429s (shared NAT / school networks), bump to 10 — note it in STATUS deviations.
- Zoom token requests happen at session-join time and on reconnect; `useZoomConnectionQuality`/rejoin logic should not loop token requests — verify with a joined session in dev before merging.

## Out of scope

- Rate-limiting GET endpoints that already have limiters.
- Replacing the token-capability design of cancel links (works as intended).
- CAPTCHA or lockout logic.
