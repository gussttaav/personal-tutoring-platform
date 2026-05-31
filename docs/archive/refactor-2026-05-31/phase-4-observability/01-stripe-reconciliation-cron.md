# Task P4-01 — Stripe ↔ Supabase reconciliation cron

**Severity:** 🟡 Medium
**Effort:** 2–3 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

A daily cron lists all Stripe `payment_intents` with `status=succeeded` from the last 48 hours and checks that each one has a matching `webhook_events.idempotency_key`. Any mismatch = a dropped webhook = manual reconciliation needed. Alert via Sentry (and log so it appears in your existing log dashboards).

## Context

### Why this is needed even after P1-02

Phase 1 Task 02 made the webhook handler return 500 on retryable failures so Stripe retries. That covers:

- Our server returned an error
- Our server was reachable but slow

It does **not** cover:

- Our server was unreachable for the entire 3-day retry window (long outage)
- Stripe's delivery infrastructure dropped the event entirely (rare but documented)
- A signature verification bug rejected legitimate events
- A `PermanentWebhookError` was thrown for something that was actually recoverable

For a single-tutor platform that handles money, a daily check is cheap insurance.

### What we look for

For each succeeded PI in the last 48 hours:

1. `webhook_events` should contain a row with `idempotency_key = pi.id`
2. If single-session: `bookings` should contain a row (status `confirmed` or `cancelled`) with `stripe_payment_id = pi.id`
3. If pack: `credit_packs` should contain a row with `stripe_payment_id = pi.id`

Mismatch on (1) means the webhook never ran. Mismatch on (2) or (3) but match on (1) means the webhook ran but the downstream write failed silently — which P1 made impossible, but defense-in-depth.

## Files affected

| File | Change |
|------|--------|
| `src/app/api/internal/reconcile-stripe/route.ts` | **NEW** — cron handler |
| `vercel.json` | Register the cron |
| `src/lib/startup-checks.ts` | `CRON_SECRET` (already added in P1-04 if you did that task) |

## The change

### 1. New route: `src/app/api/internal/reconcile-stripe/route.ts`

```typescript
/**
 * GET /api/internal/reconcile-stripe
 *
 * REFACTOR-P4-01: Daily Vercel cron. Lists succeeded Stripe PaymentIntents
 * from the last 48 hours and verifies each one has a matching row in
 * webhook_events (proof the webhook ran). Mismatches alert via Sentry.
 *
 * Auth: requires CRON_SECRET in the Authorization header.
 * Vercel sets this automatically for crons defined in vercel.json.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/infrastructure/stripe/client-singleton";
import { supabase } from "@/infrastructure/supabase/client";
import { log } from "@/lib/logger";

const LOOKBACK_HOURS = 48;
const PAGE_SIZE      = 100;
const MAX_PAGES      = 10;  // hard cap: 1000 PIs per run; alert if we hit it

interface Mismatch {
  paymentIntentId: string;
  amount:          number;
  currency:        string;
  email?:          string;
  createdAt:       string;
  reason:          "no_webhook_row" | "no_downstream_row";
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = Math.floor((Date.now() - LOOKBACK_HOURS * 3600_000) / 1000);
  const mismatches: Mismatch[] = [];
  let totalScanned = 0;
  let starting_after: string | undefined;
  let pageCount = 0;

  try {
    while (pageCount < MAX_PAGES) {
      const page = await stripe.paymentIntents.list({
        created: { gte: since },
        limit:   PAGE_SIZE,
        ...(starting_after ? { starting_after } : {}),
      });
      pageCount++;

      for (const pi of page.data) {
        totalScanned++;
        if (pi.status !== "succeeded") continue;

        // Check (1): webhook ran?
        const { data: webhookRow } = await supabase
          .from("webhook_events")
          .select("idempotency_key")
          .eq("idempotency_key", pi.id)
          .maybeSingle();

        if (!webhookRow) {
          mismatches.push({
            paymentIntentId: pi.id,
            amount:          pi.amount,
            currency:        pi.currency,
            email:           pi.metadata?.student_email,
            createdAt:       new Date(pi.created * 1000).toISOString(),
            reason:          "no_webhook_row",
          });
          continue;  // can't check downstream if webhook didn't run
        }

        // Check (2)/(3): downstream wrote?
        const checkoutType = pi.metadata?.checkout_type;
        if (checkoutType === "pack") {
          const { data } = await supabase
            .from("credit_packs")
            .select("id")
            .eq("stripe_payment_id", pi.id)
            .maybeSingle();
          if (!data) {
            mismatches.push({
              paymentIntentId: pi.id, amount: pi.amount, currency: pi.currency,
              email: pi.metadata?.student_email,
              createdAt: new Date(pi.created * 1000).toISOString(),
              reason: "no_downstream_row",
            });
          }
        } else if (checkoutType === "single") {
          const { data } = await supabase
            .from("bookings")
            .select("id")
            .eq("stripe_payment_id", pi.id)
            .maybeSingle();
          if (!data) {
            // ...but also check failed_bookings — that's a "known failure", not a mismatch
            const { data: dead } = await supabase
              .from("failed_bookings")
              .select("stripe_session_id")
              .eq("stripe_session_id", pi.id)
              .maybeSingle();
            if (!dead) {
              mismatches.push({
                paymentIntentId: pi.id, amount: pi.amount, currency: pi.currency,
                email: pi.metadata?.student_email,
                createdAt: new Date(pi.created * 1000).toISOString(),
                reason: "no_downstream_row",
              });
            }
          }
        }
      }

      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
    }

    if (pageCount === MAX_PAGES) {
      log("warn", "Reconciliation hit page cap — may have missed older PIs", {
        service: "reconciliation",
        lookbackHours: LOOKBACK_HOURS,
        maxPages: MAX_PAGES,
      });
    }

    if (mismatches.length > 0) {
      // log("error") forwards to Sentry per OBS-02
      log("error", "Stripe reconciliation found mismatched PaymentIntents", {
        service: "reconciliation",
        count:   mismatches.length,
        scanned: totalScanned,
        // Limit detail in the log payload — Sentry truncates large extras.
        // Full list is in the response body, which is visible in Vercel cron history.
        sample:  mismatches.slice(0, 10),
      });
    } else {
      log("info", "Stripe reconciliation: all clear", {
        service: "reconciliation",
        scanned: totalScanned,
      });
    }

    return NextResponse.json({
      scanned: totalScanned,
      mismatches: mismatches.length,
      details: mismatches,
    });
  } catch (err) {
    log("error", "Reconciliation cron failed", {
      service: "reconciliation",
      error:   String(err),
    });
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
```

### 2. `vercel.json` — add the cron

If you already have a `crons` array (from P1-04), append:

```json
{
  "crons": [
    {
      "path": "/api/internal/zoom-terminate-fallback",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/internal/reconcile-stripe",
      "schedule": "30 3 * * *"
    }
  ]
}
```

Daily at 03:30 UTC, 30 minutes after the zoom-terminate fallback. Adjust for off-peak.

## Acceptance criteria

- [ ] Endpoint returns 403 without `CRON_SECRET`
- [ ] Endpoint returns 200 with a JSON body listing `scanned`, `mismatches`, `details`
- [ ] Mismatches with `reason: "no_webhook_row"` log at `error` level → Sentry alert
- [ ] PIs with a `failed_bookings` row don't count as mismatches (they're expected failures)
- [ ] Cron registered in `vercel.json`
- [ ] Manual test: intentionally drop a webhook (see Test plan), wait for cron, confirm alert

## Test plan

### Unit-ish test (mock Stripe + Supabase)

```typescript
describe("REFACTOR-P4-01: reconciliation", () => {
  it("returns 0 mismatches when every PI has a webhook_events row", async () => {
    // Mock stripe.paymentIntents.list to return 3 succeeded PIs
    // Mock webhook_events lookups to return all 3
    // Mock downstream lookups to return all 3
    // Call the route handler with valid auth
    // Expect 200 + mismatches=0
  });

  it("flags PIs without a webhook_events row", async () => {
    // Mock 3 PIs; webhook_events has 2 of them
    // Expect mismatches=1
  });

  it("does NOT flag PIs that have a failed_bookings entry", async () => {
    // Mock 1 PI with webhook_events row but no bookings row
    // failed_bookings has it
    // Expect mismatches=0
  });

  it("logs at error level when mismatches > 0", async () => {
    const logSpy = jest.spyOn(/* logger */);
    // ... setup that produces 1 mismatch
    expect(logSpy).toHaveBeenCalledWith("error", expect.any(String), expect.any(Object));
  });
});
```

### Manual verification

```bash
# 1. Stop your dev server / disable webhook delivery temporarily
# 2. Trigger a real (test mode) checkout end-to-end so a PI succeeds
# 3. Restart dev server but DON'T replay the webhook
# 4. Run the cron manually:
curl -H "Authorization: Bearer $CRON_SECRET" https://gustavoai.dev/api/internal/reconcile-stripe
# Expect: { scanned: N, mismatches: 1, details: [{ paymentIntentId: "pi_...", reason: "no_webhook_row" }] }
# Confirm: a Sentry error event appears
```

## Notes / gotchas

- **Cost:** `stripe.paymentIntents.list` is paginated. 1 API call per 100 PIs. For 100 PIs/day, this is 1 call. For 10k/day, 100 calls. Stripe rate limit is 100 req/sec, so even spike-day reconciliation finishes in <1 minute.
- **Cron timing:** put it AFTER off-hours — both for Stripe reconciliation and to avoid colliding with your other crons.
- **Lookback window:** 48h is intentionally longer than Stripe's typical retry window. Catches anything that retried multiple times before failing.
- **What to do with mismatches:** the on-call human reads the Sentry alert and either replays the webhook from Stripe Dashboard (Dashboard → Developers → Events → resend) or manually creates the booking via the admin UI. Consider a follow-up to surface mismatches in the admin dashboard.
- **Idempotency:** the cron itself is read-only. Safe to run multiple times.

## Out of scope

- Auto-repairing mismatches (replay the webhook automatically). Risk of accidental double-processing; keep it manual.
- Reconciling refunds (`charge.refunded`). Different table, different shape; add when refund volume matters.
- Reconciling failed payments. Stripe Dashboard surfaces these.
- Daily summary email of "X reconciled successfully, 0 mismatches". Sentry alert on mismatches is enough signal.
