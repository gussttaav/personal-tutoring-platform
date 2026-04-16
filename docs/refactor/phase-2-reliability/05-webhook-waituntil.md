# Task 2.5 — Webhook Async Processing via `waitUntil`

**Fix ID:** `REL-05`
**Priority:** P2 — Medium
**Est. effort:** 1 hour

## Problem

The Stripe webhook responds to Stripe only after it finishes:
1. Writing credits / creating calendar events
2. Creating cancellation tokens
3. Sending confirmation emails (with retry logic, up to 3 attempts with backoff)
4. Sending admin notification emails

Stripe expects webhook responses within 20 seconds. Each email round-trip takes 500ms–2s. Two emails with 3-attempt retry can consume 6–12 seconds on a bad day. If Resend is slow, the webhook times out, Stripe retries, and we get duplicate event processing (caught by idempotency, but wasteful).

Emails are non-critical to the booking itself — the calendar event is the source of truth. Emails should be deferred: acknowledge the webhook immediately, send emails in the background.

Vercel's `waitUntil` from `next/server` lets a handler return a response while continuing work. This is the Vercel-native equivalent of "fire and forget" with actual execution guarantees.

## Scope

**Modify:**
- `src/app/api/stripe/webhook/route.ts` — wrap email sends in `waitUntil`

**Do not touch:**
- Email retry logic itself
- The calendar event creation or credit writing (these must complete before response)
- `/api/book` route (different context — it's a user-initiated request, latency matters less)

## Approach

### Before (blocking):

```ts
try {
  await Promise.all([
    sendConfirmationEmail({ ... }),
    sendNewBookingNotificationEmail({ ... }),
  ]);
} catch (emailErr) {
  log("error", "Email send failed after booking", { ... });
}

return NextResponse.json({ received: true });
```

### After (non-blocking with waitUntil):

```ts
import { waitUntil } from "next/server";

// ...

waitUntil(
  Promise.all([
    sendConfirmationEmail({ ... }),
    sendNewBookingNotificationEmail({ ... }),
  ]).catch((emailErr) => {
    log("error", "Email send failed after booking", {
      service: "webhook", email, intentId, error: String(emailErr),
    });
  })
);

return NextResponse.json({ received: true });
```

The return happens immediately. Vercel keeps the function alive long enough for `waitUntil` promises to resolve, with a separate timeout budget from the response cycle.

## Where to apply

After Task 2.2 consolidates the webhook, there's one email-sending site (inside `processSingleSession`) and one more for pack credits (`addOrUpdateStudent` doesn't send emails — purchase confirmations are sent on the client via SSE + `/sesion-confirmada`). Check the consolidated code to see where emails are sent. Apply `waitUntil` at each site.

If Task 2.2 has not landed yet, apply `waitUntil` in both duplicate branches.

## Acceptance Criteria

- [ ] `waitUntil` is imported from `next/server`
- [ ] All `await Promise.all([sendConfirmationEmail(...), sendNewBookingNotificationEmail(...)])` in the webhook are wrapped in `waitUntil(...)`
- [ ] The `.catch()` handler is preserved so errors still log
- [ ] The webhook returns its response BEFORE emails complete
- [ ] Calendar event creation still completes BEFORE response (not wrapped in waitUntil)
- [ ] KV writes still complete BEFORE response (not wrapped)
- [ ] Manual test: trigger a test payment → check that webhook response time drops significantly → confirmation email still arrives within ~5 seconds
- [ ] Fix-ID comment added
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **7.4 Reduce Webhook Processing Time**.

Next.js `waitUntil` reference: it's exported from `next/server` and is a no-op on self-hosted Node (the promise just runs in the background without special handling). On Vercel, the runtime keeps the function alive for the promise to complete.

## Testing

Automated testing of `waitUntil` behavior is difficult (requires Vercel runtime). Manual verification:

1. Add `console.time("webhook")` at the top of the handler and `console.timeEnd("webhook")` before `return NextResponse.json`
2. Trigger a test payment
3. Before this task: webhook takes 2–5 seconds
4. After this task: webhook takes <500ms, email still arrives

## Out of Scope

- Moving ALL work (including calendar + KV) to background — these MUST complete before response for correctness
- Migrating to a proper queue system (QStash) for emails — overkill for this use case
- Changing email templates or retry counts

## Rollback

Trivial. Remove the `waitUntil` wrapper and the handler is back to blocking mode. No data changes, no new dependencies.

One subtle risk: on self-hosted deployments (not Vercel), `waitUntil` may behave differently. Since this project is deployed on Vercel exclusively, this is not a concern — but document the dependency in a comment so a future platform migration doesn't silently break email delivery.
