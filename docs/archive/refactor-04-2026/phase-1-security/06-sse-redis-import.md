# Task 1.6 — Fix SSE Duplicate Redis Client

**Fix ID:** `SEC-06` (architectural, not a direct vulnerability — grouped with security for locality)
**Priority:** P1 — Trivial fix with architectural importance
**Est. effort:** 5 minutes

## Problem

`src/app/api/sse/route.ts` contains:

```ts
import { Redis } from "@upstash/redis";
const kv = Redis.fromEnv();
```

This contradicts the ARCH-02 fix that established `src/lib/redis.ts` as the single place to instantiate Upstash clients. The reason ARCH-02 exists: every `Redis.fromEnv()` call parses env vars and initializes its own HTTP fetch wrapper. Having one extra client per cold start is not a performance disaster, but:

1. It violates the codebase convention.
2. It makes future changes (e.g., swapping to a different Redis provider, adding instrumentation) require touching multiple files.
3. It's noise in Phase 3 when the repository pattern is introduced — the refactor should start from a clean baseline.

Do this first in Phase 1 to remove noise from later diffs.

## Scope

**Modify:**
- `src/app/api/sse/route.ts` — replace the local `kv` with an import

## Approach

Replace:

```ts
import { Redis } from "@upstash/redis";
const kv = Redis.fromEnv();
```

With:

```ts
import { kv } from "@/lib/redis";
```

Remove the unused `Redis` import line.

## Acceptance Criteria

- [ ] `Redis.fromEnv()` no longer appears in `src/app/api/sse/route.ts`
- [ ] The `@upstash/redis` import is removed from that file
- [ ] `import { kv } from "@/lib/redis"` replaces it
- [ ] The `kv.get<CreditRecord>(kvKey)` call site is unchanged
- [ ] `npm run build` passes
- [ ] Manual test: complete a pack purchase, verify SSE still fires `credits_ready`

## Testing

No new tests required. Existing SSE behavior must work end-to-end. Verify in preview:

1. Sign in, purchase a pack
2. On the payment success page, watch Network tab for `/api/sse` EventSource
3. Verify the `credits_ready` event fires and credits are displayed

## Out of Scope

- Any other changes to the SSE route
- Any refactoring of the polling loop
- Any changes to timeout values

## Rollback

Trivial. If anything breaks (it won't), revert the one-line change.
