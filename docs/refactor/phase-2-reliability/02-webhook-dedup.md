# Task 2.2 — Deduplicate Webhook Handlers

**Fix ID:** `REL-02`
**Priority:** P1 — High
**Est. effort:** 3 hours

## Problem

`src/app/api/stripe/webhook/route.ts` contains ~100 lines of nearly identical logic duplicated between:

1. `handleSingleSessionPayment()` — invoked from the `payment_intent.succeeded` branch (embedded PaymentElement flow, current)
2. The inline handler inside the `checkout.session.completed` branch (legacy redirect flow, kept for backward compatibility)

Both do the same work: idempotency check, slot re-check, reschedule handling, calendar event creation with retry, dead-letter on failure, cancellation token, email sending, Zoom session scheduling.

When a bug is fixed in one, the other is often forgotten. The CRIT-03 fix was missed in one branch for two weeks. This is a maintenance time-bomb.

## Scope

**Modify:**
- `src/app/api/stripe/webhook/route.ts` — extract shared logic

**Do not touch:**
- Any other file in the codebase
- The webhook's public behavior — same events handled, same responses returned

## Approach

Both branches converge on the same inputs: an email, name, startIso, endIso, duration, rescheduleToken, and an idempotency identifier. The legacy branch uses `session.id`; the new branch uses `intent.id`. Both are valid idempotency keys.

### Step 1 — Define a common input type

```ts
interface SingleSessionInput {
  email:           string;
  name:            string;
  startIso:        string;
  endIso:          string;
  duration:        string;       // "1h" | "2h"
  rescheduleToken: string | null;
  idempotencyKey:  string;        // pi_xxx or cs_xxx
  refundTarget:    { type: "payment_intent"; id: string } | { type: "charge"; id: string };
}
```

### Step 2 — Single processing function

Consolidate all the common logic into one function that takes `SingleSessionInput` and returns either a success response or a warning response. This replaces the body of `handleSingleSessionPayment` and the `checkoutType === "single"` block in the legacy branch.

```ts
async function processSingleSession(input: SingleSessionInput): Promise<NextResponse> {
  // 1. Idempotency check
  const idempotencyKey = `webhook:single:${input.idempotencyKey}`;
  if (await kv.get(idempotencyKey)) {
    log("info", "Duplicate webhook skipped", { service: "webhook", key: input.idempotencyKey });
    return NextResponse.json({ received: true });
  }

  // 2. Slot re-check
  const durationMinutes = input.duration === "2h" ? 120 : 60;
  const slotDate = input.startIso.slice(0, 10);
  const availableSlots = await getAvailableSlots(slotDate, durationMinutes).catch(() => null);
  const slotStillFree = availableSlots?.some(s => s.start === input.startIso) ?? true;

  if (!slotStillFree) {
    await issueRefund(input.refundTarget, input.idempotencyKey);
    return NextResponse.json({ received: true, warning: "Slot unavailable — refund issued" });
  }

  // 3. Reschedule handling (unchanged logic, extracted)
  if (input.rescheduleToken) { /* ... */ }

  // 4. Calendar event with retry + dead-letter
  // 5. Cancellation token
  // 6. QStash scheduling for Zoom cleanup  (after REL-01 lands)
  // 7. Email sending

  // ... (all existing logic, now in one place)

  return NextResponse.json({ received: true });
}

async function issueRefund(
  target: { type: "payment_intent" | "charge"; id: string },
  idempotencyKey: string
): Promise<void> {
  try {
    const params = target.type === "payment_intent"
      ? { payment_intent: target.id, reason: "duplicate" as const }
      : { charge: target.id, reason: "duplicate" as const };
    await stripe.refunds.create(params);
  } catch (err) {
    log("error", "Auto-refund failed", { service: "webhook", idempotencyKey, error: String(err) });
  }
}
```

### Step 3 — Thin branches

Both event handlers become small adapters that build the input object and delegate:

```ts
// payment_intent.succeeded
if (checkoutType === "single") {
  return processSingleSession({
    email:           metadata.student_email ?? "",
    name:            metadata.student_name ?? "",
    startIso:        metadata.start_iso,
    endIso:          metadata.end_iso,
    duration:        metadata.session_duration ?? "1h",
    rescheduleToken: metadata.reschedule_token || null,
    idempotencyKey:  intent.id,
    refundTarget:    { type: "payment_intent", id: intent.id },
  });
}

// checkout.session.completed (legacy)
if (checkoutType === "single") {
  return processSingleSession({
    email:           session.metadata?.student_email ?? session.customer_email ?? "",
    name:            session.metadata?.student_name ?? "",
    startIso:        session.metadata?.start_iso ?? "",
    endIso:          session.metadata?.end_iso ?? "",
    duration:        session.metadata?.session_duration ?? "1h",
    rescheduleToken: session.metadata?.reschedule_token || null,
    idempotencyKey:  session.id,
    refundTarget:    { type: "payment_intent", id: session.payment_intent as string },
  });
}
```

The pack-payment path already has a single shared function (`handlePackPayment`). No change needed there.

## Acceptance Criteria

- [ ] `processSingleSession(input: SingleSessionInput)` exists as a single shared function
- [ ] `SingleSessionInput` interface is defined
- [ ] `issueRefund` helper is extracted
- [ ] Both webhook branches (new + legacy) call `processSingleSession`
- [ ] The ~100 lines of duplicated logic are removed
- [ ] No behavior change: webhook responses are identical to before for the same inputs
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Manual test: trigger a test pack payment → credits appear as before
- [ ] Manual test: trigger a test single-session payment → booking created as before

## Reference

See `docs/refactor/PLAN.md` → section **1. Key Issues Summary → Issue 5** and **2. Refactor Plan → Phase 2, task: Webhook code duplication**.

## Testing

This task is a pure refactor — no behavior changes. The existing webhook is difficult to unit-test because it requires Stripe event fixtures. Manual verification in Stripe test mode is sufficient:

1. Use Stripe CLI: `stripe trigger payment_intent.succeeded`
2. Use Stripe CLI: `stripe trigger checkout.session.completed`
3. Verify both paths produce the same outcomes as before

## Out of Scope

- Extracting this into a service class (Phase 3)
- Changing the retry logic
- Changing the dead-letter format
- Removing the legacy `checkout.session.completed` branch (keep for backward compat; remove only after confirming no old links in the wild)

## Rollback

Pure refactor — safe to revert. The old inline code is preserved in git history.

Watch for subtle differences the first time this runs in production:
- Ensure both input paths produce a valid `refundTarget` — the legacy path uses `session.payment_intent as string` which could theoretically be null
- Ensure both paths handle missing `start_iso` / `end_iso` identically
