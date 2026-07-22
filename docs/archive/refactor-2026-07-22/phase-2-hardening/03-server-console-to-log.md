# P2-03 — Replace server-side `console.*` with `log()`

**Tag:** `REFACTOR-R3-P2-03` · **Severity:** 🟡 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Two `console.error` calls in `src/auth.ts` run in server code, so they bypass the structured
logger — invisible to Sentry, missing the `x-request-id` correlation from cycle 2's
`REFACTOR-P4-02`. One of them (`Failed to fetch role`) silently downgrades a user to
`student` on a DB failure — exactly the event that should page. Replace with `log()`.

## Context

- `src/auth.ts:62` — `console.error("Failed to seed locale on login:", err)` in the `signIn` callback.
- `src/auth.ts:85` — `console.error("Failed to fetch role:", err)` in the `jwt` callback (role downgrade path).
- `src/lib/logger.ts` — `log(level, message, context)` routes to Sentry + stamps request id.
- Project rule (CLAUDE.md "Do Not"): *"Add `console.log` — use `log()` from `src/lib/logger.ts`"*.
- **Already excluded:** `src/infrastructure/resend/email-functions.ts` console calls are converted inside **P1-01** (one PR per task). Client components (`ZoomRoomSession.tsx`, `SessionSettings.tsx`) legitimately use `console.warn` — `log()` is server-only; leave them.

## Files affected

| File | Change |
|------|--------|
| `src/auth.ts` | 2 × `console.error` → `log("error", ...)` with `service: "auth"` context |

## The change

```ts
// src/auth.ts
import { log } from "@/lib/logger";

// signIn callback:
} catch (err) {
  // Locale seeding is best-effort — never block sign-in on it.
  log("error", "Failed to seed locale on login", { service: "auth", error: String(err) });
}

// jwt callback:
} catch (err) {
  // Don't fail auth if DB is down — fall back to existing role on the token.
  log("error", "Role fetch failed — falling back to cached/student role", {
    service: "auth", error: String(err),
  });
  token.role = token.role ?? "student";
}
```

## Acceptance criteria

- [ ] `grep -rn "console\." src --include="*.ts"` (excluding `.tsx` client components and `__tests__`) → only `email-functions.ts` remains if P1-01 hasn't landed, nothing otherwise
- [ ] Both events reach Sentry with `service: "auth"` when forced in dev
- [ ] Preserved comments about best-effort behavior stay in place (project rule: keep correct comments)
- [ ] File-top comment block updated with `REFACTOR-R3-P2-03`

## Test plan

- **Existing:** `pnpm test`, `pnpm build` (auth.ts compiles into the edge/server bundle — build catches import issues).
- **Manual:** point `SUPABASE_SERVICE_ROLE_KEY` at garbage in dev, sign in → both log lines appear structured; sign-in still completes.

## Notes / gotchas

- `log()` imports must not drag anything client-only into `auth.ts` (it's imported by middleware-adjacent code). `src/lib/logger.ts` is already server-safe — just verify `pnpm build` passes.
- If P2-01 (role refresh) lands first, its catch block already uses `log()` — this task then only converts the locale-seeding line. Coordinate to avoid a no-op PR; fold whichever lands second.

## Out of scope

- `email-functions.ts` (P1-01 owns it).
- Client-component `console.warn` calls.
- The `pino` migration (deferred since cycle 2).
