# P2-01 — Hourly admin-role re-fetch in the JWT callback

**Tag:** `REFACTOR-R3-P2-01` · **Severity:** 🟠 · **Effort:** S · **Owner:** Gustavo · **Status:** 🚫 WON'T DO

> ## 🚫 Rejected — 2026-07-13
>
> **The premise of this task is wrong for this app.** The 🟠 severity assumes a multi-admin
> deployment where an admin can turn hostile and must be revoked fast. Reality:
>
> - There is exactly **one admin: Gustavo, the tutor/owner.** There is nobody to demote.
> - The app has **no role-management feature.** Promotion/demotion is a manual `users.role` edit
>   in Supabase and essentially never happens — so "propagate a role change within ≤ 1h" solves a
>   transition that does not occur.
> - Admins and students have **disjoint feature sets** (admin panel vs. booking/paying), so a stale
>   role does not silently grant a student anything.
> - The cost lands on the wrong people: one role query per hour for every **student**, who gain
>   nothing from it.
> - A leaked admin cookie already has a revocation lever — rotate `AUTH_SECRET` (instant, blunt:
>   logs out all users).
>
> It was implemented and then reverted; `src/auth.ts` is unchanged. **Revisit only if the app gains
> multiple admins or in-app role management.** Known unrelated TODO (Gustavo's, not urgent): make
> the admin panel the landing page for admins so they no longer see the booking flow.
>
> The original task text is preserved below for context.

## TL;DR

`token.role` is fetched from the DB only on `trigger === "signIn"`, but the session cookie
lives 30 days. Demoting or revoking an admin has no effect until they happen to re-login —
up to 30 days of retained access to `/admin/*` and every `isAdmin()`-gated API. Cycle 2's
P2-02 task doc explicitly specified an hourly re-fetch cache; ship it: stamp `roleCheckedAt`
into the JWT and re-fetch when stale.

## Context

- `src/auth.ts:72-91` — `jwt` callback; role fetch guarded by `trigger === "signIn"`.
- `src/auth.ts:104-116` — cookie `maxAge: 60 * 60 * 24 * 30`.
- `docs/archive/refactor-2026-05-31/phase-2-hardening/02-admin-role-from-db.md:339` — "the hourly cache prevents a DB hit on every request, but does add one DB hit per hour per user."
- `src/lib/session.ts:32` — mobile bearer already expires hourly and re-reads the role on every mint: **web-only gap**.
- `src/services/UserService.ts` — `getRoleAndBootstrap(email)` is the existing fetch; reuse it.

## Files affected

| File | Change |
|------|--------|
| `src/auth.ts` | Add `roleCheckedAt` to the JWT type; re-fetch role when > 1h old |
| `src/services/__tests__/UserService.test.ts` | Unchanged (fetch itself already tested) — callback logic is exercised via e2e/manual |

## The change

```ts
// src/auth.ts
declare module "next-auth/jwt" {
  interface JWT {
    role?: "student" | "teacher" | "admin";
    roleCheckedAt?: number; // REFACTOR-R3-P2-01
  }
}

const ROLE_REFRESH_MS = 60 * 60 * 1000; // 1 hour — matches archived P2-02 spec

async jwt({ token, profile, trigger }) {
  if (profile) { /* unchanged */ }

  // REFACTOR-R3-P2-01: re-fetch the DB role at sign-in AND whenever the cached
  // role is older than an hour, so demotion/revocation propagates without re-login.
  const stale =
    token.roleCheckedAt === undefined ||
    Date.now() - token.roleCheckedAt > ROLE_REFRESH_MS;

  if (token.email && (trigger === "signIn" || stale)) {
    try {
      token.role = await userService.getRoleAndBootstrap(token.email as string);
      token.roleCheckedAt = Date.now();
    } catch (err) {
      log("error", "Role refresh failed — keeping cached role", { service: "auth", error: String(err) });
      token.role ??= "student";
      // Do NOT stamp roleCheckedAt on failure — retry on the next request.
    }
  }

  return token;
},
```

(If P2-03 hasn't landed yet, use the `log()` call anyway — it's the same import.)

## Acceptance criteria

_(Moot — task rejected; see the banner at the top.)_

- [ ] Flipping `users.role` admin→student in the DB → admin API calls return 403 within ≤ 1h with the same cookie
- [ ] Promotion propagates the same way (student→admin usable within ≤ 1h)
- [ ] Steady state adds at most ~1 role query per user per hour (verify via Supabase logs during manual test)
- [ ] DB outage during refresh degrades to the cached role (no auth hard-failure), and retries next request
- [ ] Existing sign-in flow unchanged (`trigger === "signIn"` still forces a fetch)
- [ ] File-top comment block updated with `REFACTOR-R3-P2-01`

## Test plan

- **Existing:** `pnpm test` (UserService tests), `pnpm test:e2e` login flows.
- **New (manual, dev):** sign in as an `E2E_EMAILS` admin → demote the row in Supabase →
  wait for staleness (temporarily set `ROLE_REFRESH_MS` to 10s locally) → hit `/api/admin/pricing` → expect 403.
- **New (unit, optional):** extract the staleness predicate into a pure helper if testing the callback directly proves awkward (NextAuth callbacks are painful to unit-test — don't over-invest).

## Notes / gotchas

- **Cookie persistence asymmetry (the real subtlety):** with the JWT strategy, `auth()` inside
  Server Components/route handlers can *read* the mutated token but cannot always *re-set* the
  cookie (headers already sent / RSC can't set cookies). NextAuth persists the updated JWT when
  the session endpoint or middleware handles the request. Practical effect: once stale, a user
  might pay the role query on several consecutive requests until a cookie-writable request path
  runs. That's the accepted cost (one indexed query); do NOT try to force cookie writes from RSC.
- `getRoleAndBootstrap` also runs the env-bootstrap — it's idempotent and cheap after first run; reusing it keeps one code path.
- Don't touch `MOBILE_BEARER_MAX_AGE` — mobile is already correct.

## Out of scope

- Instant revocation (server-side session store / deny-list) — out of proportion for a single-admin app.
- Shortening the 30-day session cookie.
- Admin UI for role management.
