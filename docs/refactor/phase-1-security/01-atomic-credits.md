# Task 1.1 — Atomic Credit Decrement

**Fix ID:** `SEC-01`
**Priority:** P0 — Critical
**Est. effort:** 2–3 hours

## Problem

`decrementCredit()` in `src/lib/kv.ts` has a time-of-check-to-time-of-use (TOCTOU) race condition. It performs:

```
1. GET credits:{email}       → reads current record
2. Check credits > 0         → validates in application code
3. SET credits:{email}       → writes decremented record
```

Two concurrent `POST /api/book` requests for the same student can interleave steps 1–3 such that both reads see `credits: 1`, both pass the check, and both successfully decrement. The result: two bookings are created while only one credit is consumed.

Upstash Redis REST API does **not** support `MULTI`/`EXEC` transactions, so this cannot be fixed with client-side transaction primitives. It can only be fixed with a Lua script executed server-side via `EVAL`, which runs atomically.

## Scope

**Modify:**
- `src/lib/kv.ts` — replace the read/modify/write in `decrementCredit`

**Add tests to:**
- `src/lib/__tests__/kv.test.ts`

**Do not touch:**
- `restoreCredit` (has the same issue, but fix separately to keep PR reviewable)
- `addOrUpdateStudent` (guarded by idempotency key, lower risk)
- Route handlers — `decrementCredit`'s signature stays identical
- Audit logging — it still happens after the atomic operation

## Approach

Use `kv.eval(script, keys, args)` to run a Lua script that:
1. Reads the credit record
2. Returns `{ok: false}` if missing, expired, or `credits <= 0`
3. Decrements and writes atomically
4. Returns `{ok: true, remaining: N}`

The script must parse and re-serialize JSON because Upstash stores records as stringified JSON when using `kv.set(key, record)`.

### Verification required before implementation

Confirm Upstash REST supports `EVAL` by checking the client type signature:

```ts
import { kv } from "@/lib/redis";
// This call should type-check:
await kv.eval(script, keys, args);
```

If the type signature differs (some Upstash versions use `eval` vs `evalsha`), adjust accordingly. Do **not** fall back to a non-atomic implementation.

## Reference Implementation

See `docs/refactor/PLAN.md` → section **6. Security Fixes → Fix 1: Atomic Credit Decrement**.

The Lua script provided there is the authoritative version. Copy it into a module-level constant.

## Acceptance Criteria

- [ ] `decrementCredit(email)` uses `kv.eval()` with the Lua script
- [ ] The function signature is unchanged: returns `Promise<{ok: boolean; remaining: number}>`
- [ ] Expiry check happens **inside** the Lua script (not in TypeScript after the call)
- [ ] The `audit:{email}` entry is still written after a successful decrement
- [ ] The `log("info", "Credit decremented", ...)` call is preserved
- [ ] The Lua script is extracted to a module-level `const DECREMENT_SCRIPT` with a clear comment explaining why it exists
- [ ] A new test simulates concurrency by calling `Promise.all([decrementCredit(e), decrementCredit(e)])` on an account with `credits: 1` and asserts exactly one result has `ok: true`
- [ ] A new test verifies expired packs return `{ok: false, remaining: 0}`
- [ ] A new test verifies `credits: 0` accounts return `{ok: false, remaining: 0}`
- [ ] `npm test` passes
- [ ] `npm run build` passes

## File-specific Notes

### `src/lib/kv.ts`

Prepend a block comment documenting the fix, matching the existing style (see the top of the file for the `Week 2 — ARCH-02:` pattern):

```ts
/**
 * ...existing comment...
 *
 *   SEC-01 — Atomic decrement via Lua script. The previous GET/modify/SET
 *   pattern allowed two concurrent /api/book requests to both read credits=1,
 *   both pass the check, and both decrement — consuming one credit for two
 *   bookings. The Lua script below runs server-side in Redis and is atomic.
 */
```

### `src/lib/__tests__/kv.test.ts`

Existing tests use the Upstash client directly. For concurrency simulation, Promise.all with two concurrent calls is sufficient — Upstash serializes EVAL calls per key, so the test is deterministic.

## Out of Scope

- Fixing `restoreCredit` (separate task, not part of Phase 1)
- Migrating credits to the database (Phase 4)
- Changing the credit record shape
- Adding new fields to `CreditRecord`

## Rollback

If this change breaks in production, revert the PR. The previous non-atomic version still works for single-request traffic; the race only manifests under concurrent load from the same student.
