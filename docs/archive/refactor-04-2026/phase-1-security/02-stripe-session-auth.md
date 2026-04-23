# Task 1.2 — Auth Gate on `/api/stripe/session`

**Fix ID:** `SEC-02`
**Priority:** P0 — Critical
**Est. effort:** 30 minutes

## Problem

`GET /api/stripe/session?payment_intent_id=pi_xxx` in `src/app/api/stripe/session/route.ts` has **zero authentication**. Any caller who guesses or discovers a valid `pi_xxx` identifier can retrieve:

- The student's email
- The student's name
- The checkout type (pack vs single)
- The pack size or session duration

`pi_` IDs appear in browser URLs after a successful payment (e.g., `/pago-exitoso?payment_intent=pi_xxx`) and are therefore present in browser history, referrer headers, and any logs that capture URLs. An attacker who obtains one ID can read the associated student's PII.

## Scope

**Modify:**
- `src/app/api/stripe/session/route.ts`

**Do not touch:**
- The `/api/sse` route (already has this fix — see CRIT-03 comment)
- Stripe webhook (signature verification is the auth mechanism)
- Any client pages that call this endpoint

## Approach

Add two checks at the top of the handler, before the Stripe API call:

1. **Authentication check** — require a valid NextAuth session.
2. **Ownership check** — after retrieving the PaymentIntent, verify that `intent.metadata.student_email` matches the authenticated user's email (case-insensitive).

Return `401` for missing auth, `403` for ownership mismatch. Do not leak whether the PaymentIntent exists when auth fails — return the same error shape as the existing validation errors.

## Acceptance Criteria

- [ ] The handler calls `await auth()` before any other work
- [ ] Returns `401 { error: "Authentication required" }` when no session
- [ ] After retrieving the PaymentIntent, compares `intent.metadata?.student_email` with `session.user.email` (both lowercased, trimmed)
- [ ] Returns `403 { error: "Forbidden" }` on ownership mismatch
- [ ] Existing behavior preserved for legitimate calls: same response shape, same status codes for success
- [ ] Existing `log()` calls preserved; add one `log("warn", "Unauthorized /stripe/session access attempt", ...)` on the 403 path
- [ ] A fix-ID comment block is added at the top of the file, matching the existing style in other route files
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **6. Security Fixes → Fix 2**. Compare the pattern used in `src/app/api/sse/route.ts` (CRIT-03) which has the same auth+ownership check already implemented — use that as your template.

## Testing

This route has no existing test file. You do **not** need to add one for this task (route handler tests require mocking NextAuth + Stripe, which is better introduced in Phase 3's testing overhaul). Manual verification is acceptable:

```bash
# Should return 401
curl -v "https://your-preview-url/api/stripe/session?payment_intent_id=pi_xxx"

# Should return 403 if authenticated as a different user than the PI owner
# (do this in the browser with DevTools)
```

Record the manual verification steps in the PR description.

## Out of Scope

- Adding route handler test infrastructure (Phase 3)
- Changing the client pages that consume this endpoint
- Rate limiting this route (it already has none; adding one is optional and not required for security)

## Rollback

Low-risk change. If legitimate callers start failing with 403, the likely cause is a case-sensitivity mismatch in email comparison — verify `toLowerCase().trim()` is applied on both sides.
