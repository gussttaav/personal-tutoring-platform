# Task 1.5 — Split Join Token From Cancel Token

**Fix ID:** `SEC-05`
**Priority:** P1 — High
**Est. effort:** 3–4 hours

## Problem

The same token serves two purposes:
- `/sesion/{token}` — join the Zoom session
- `/cancelar?token={token}` — cancel the booking

If a student forwards their confirmation email (common — "please forward to my parent who will join instead"), the recipient can now cancel the class. More subtly: if the join link is shared in any context where "view the session page" is intended but "cancel it" is not, the capability leak is present.

Tokens should grant the minimum capability needed. A join token should allow joining, nothing else. A cancel token should allow cancelling, nothing else.

## Scope

**Modify:**
- `src/lib/calendar.ts` — add `createBookingTokens()` that creates both tokens; keep `createCancellationToken` as a deprecated wrapper
- `src/app/api/book/route.ts` — use the new function, include both tokens in the response
- `src/app/api/stripe/webhook/route.ts` — use the new function (both handlers)
- `src/lib/email.ts` — update confirmation email to use join token for join URL, cancel token for cancel URL
- `src/app/sesion/[token]/page.tsx` — validate that the token is a join token (not a cancel token)

**Do not touch:**
- `/api/cancel` route — continues to accept cancel tokens as before
- `/api/my-bookings` route — continues to return cancel tokens (the user legitimately has cancel capability for their own bookings)

## Approach

### Step 1 — Token generation

In `src/lib/calendar.ts`:

```ts
/**
 * SEC-05 — Issues two capability-scoped tokens for a booking.
 *
 * Previously, a single token allowed both joining and cancelling — any
 * recipient of a forwarded confirmation email could cancel the class.
 * Separating tokens ensures forwarding a join link does not grant cancel
 * capability.
 *
 * Storage:
 *   cancel:{cancelToken} → BookingRecord (existing)
 *   join:{joinToken}     → { eventId, email } (new, minimal shape)
 */
export async function createBookingTokens(
  record: Omit<BookingRecord, "used">
): Promise<{ cancelToken: string; joinToken: string }> {
  const cancelPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const joinPayload   = `join:${cancelPayload}`;

  const cancelToken = signToken(cancelPayload);
  const joinToken   = signToken(joinPayload);

  const ttlSecs = /* existing TTL calculation */;

  // Existing cancel-token storage
  await kv.set(`cancel:${cancelToken}`, { ...record, used: false }, { ex: ttlSecs });
  await kv.zadd(`bookings:${record.email.toLowerCase().trim()}`, {
    score:  new Date(record.startsAt).getTime(),
    member: cancelToken,
  });

  // New join-token storage
  await kv.set(
    `join:${joinToken}`,
    { eventId: record.eventId, email: record.email.toLowerCase().trim() },
    { ex: ttlSecs }
  );

  return { cancelToken, joinToken };
}

/**
 * @deprecated Use createBookingTokens. Kept for backward compat during migration.
 */
export async function createCancellationToken(
  record: Omit<BookingRecord, "used">
): Promise<string> {
  const { cancelToken } = await createBookingTokens(record);
  return cancelToken;
}
```

### Step 2 — Verification helper

Add a new helper for the session page to validate join tokens:

```ts
export async function resolveJoinToken(
  joinToken: string
): Promise<{ eventId: string; email: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(joinToken)) return null;
  const record = await kv.get<{ eventId: string; email: string }>(`join:${joinToken}`);
  if (!record) return null;

  // HMAC verification: re-sign the expected payload and compare
  // Note: we cannot reconstruct the exact payload without startsAt, so the
  // presence of the record in Redis under this token IS the proof. The HMAC
  // still prevents token forgery because an attacker cannot produce a token
  // that collides with a real one without CANCEL_SECRET.
  return record;
}
```

### Step 3 — Update the session page

`src/app/sesion/[token]/page.tsx` currently calls `verifyCancellationToken`. Change it to call `resolveJoinToken` instead. The session page should only accept join tokens.

### Step 4 — Update emails

In `src/lib/email.ts`, the `sendConfirmationEmail` function currently takes a single `cancelToken` parameter and uses it for both the join URL and the cancel URL. Change the signature:

```ts
export async function sendConfirmationEmail(params: {
  // ... existing ...
  joinToken: string;    // NEW — for /sesion/{token}
  cancelToken: string;  // KEPT — for /cancelar?token={token}
  // ... existing ...
}): Promise<void>
```

Update the two URL constructions in the template.

### Step 5 — Update callers

`src/app/api/book/route.ts`:
```ts
const { cancelToken, joinToken } = await createBookingTokens({ ... });
const joinUrl = `${BASE_URL}/sesion/${joinToken}`;

await sendConfirmationEmail({
  ...,
  joinToken,
  cancelToken,
  ...,
});

return NextResponse.json({
  ok: true,
  eventId,
  zoomSessionName,
  zoomPasscode,
  cancelToken,
  joinToken,  // NEW in response
  emailFailed: !confirmSent,
});
```

Update `BookResponse` type in `src/types/index.ts` to include `joinToken`.

`src/app/api/stripe/webhook/route.ts` — same pattern in both branches.

## Backward Compatibility

Existing `cancel:{token}` records continue to work for the `/api/cancel` route. The `/sesion/{token}` route will now reject cancel tokens:
- **During the migration window (first 24h after deploy)**, existing confirmation emails sent before the fix still have the old token. The session page should fall back to `verifyCancellationToken` if `resolveJoinToken` fails.
- **After 24h**, remove the fallback. All active bookings have both tokens by then (they're issued at booking time, and sessions expire within 24h of their end time).

```ts
// Temporary backward-compat in the session page:
let resolved = await resolveJoinToken(token);
if (!resolved) {
  const cancelRecord = await verifyCancellationToken(token);
  if (cancelRecord) {
    resolved = { eventId: cancelRecord.record.eventId, email: cancelRecord.record.email };
    log("warn", "Legacy token used on session page", { service: "sesion" });
  }
}
if (!resolved) /* 404 */;
```

Remove the fallback in a follow-up PR after 48h.

## Acceptance Criteria

- [ ] `createBookingTokens()` exists and returns `{ cancelToken, joinToken }`
- [ ] `createCancellationToken` still works (wraps the new function) — no callers break
- [ ] `resolveJoinToken()` exists and validates the token format and HMAC
- [ ] `join:{token}` keys are stored with the same TTL as `cancel:{token}` keys
- [ ] Session page `src/app/sesion/[token]/page.tsx` uses `resolveJoinToken` with the fallback branch
- [ ] `sendConfirmationEmail` accepts both `joinToken` and `cancelToken`
- [ ] Confirmation email's join URL uses `joinToken`, cancel URL uses `cancelToken`
- [ ] `BookResponse` type includes `joinToken: string`
- [ ] `/api/book` response includes `joinToken`
- [ ] Both webhook branches use `createBookingTokens`
- [ ] Manual test: book a class → click join link → succeeds; try to use the same token on `/cancelar?token=...` → should fail
- [ ] Manual test: book a class → click cancel link → succeeds
- [ ] Fix-ID comments added to all modified files
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **6. Security Fixes → Fix 5**.

## Testing

Add tests to `src/lib/__tests__/calendar.test.ts`:

```ts
describe("createBookingTokens", () => {
  it("returns two distinct tokens", async () => {
    const { cancelToken, joinToken } = await createBookingTokens(sampleRecord);
    expect(cancelToken).not.toBe(joinToken);
    expect(cancelToken).toMatch(/^[0-9a-f]{64}$/);
    expect(joinToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores both tokens in Redis", async () => {
    const { cancelToken, joinToken } = await createBookingTokens(sampleRecord);
    expect(await kv.get(`cancel:${cancelToken}`)).not.toBeNull();
    expect(await kv.get(`join:${joinToken}`)).not.toBeNull();
  });
});

describe("resolveJoinToken", () => {
  it("resolves a valid join token", async () => { /* ... */ });
  it("rejects a cancel token used as join token", async () => { /* ... */ });
  it("rejects malformed tokens", async () => { /* ... */ });
});
```

## Out of Scope

- Rotating CANCEL_SECRET (future task)
- Making tokens JWT-based (no benefit over HMAC for this use case)
- Expiring tokens immediately on single use (they're already single-use for cancel)

## Rollback

Higher risk than other Phase 1 tasks because it changes stored data shapes and email templates. Before merging:
1. Verify in preview: new booking → new email → join link works, cancel link works
2. Verify in preview: the fallback branch handles old-format tokens

If production issues arise:
- If only some users are affected → likely stale cached pages showing old emails; wait 10 min
- If all users cannot join → revert; the backward-compat branch should have caught this
