# Task P3-05 — Replace `/api/sse` payment-confirmation SSE polling with Supabase Realtime

**Severity:** 🟡 Medium
**Effort:** 0.5–1 day
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`GET /api/sse` polls Supabase every 1.5s for up to 24s (~13 polls per connection) after an embedded pack payment,
waiting for the Stripe webhook to write the `credit_packs` row. Each poll runs `hasProcessedPayment`; on success it
runs one more `getBalance`. Result: up to ~13 wasted queries per checkout, plus up to 1.5s of confirmation latency.

This is the same shape [P3-01](01-replace-sse-with-realtime.md) already fixed for chat. There is exactly **one** row
of interest per checkout (the pack credited for this `PaymentIntent`), so a `broadcast` channel keyed by the
PaymentIntent id — fired by the webhook after persistence — mirrors P3-01 perfectly: sub-second confirmation, one
WebSocket per tab, **zero polling**.

## Context

### Why polling exists today

Vercel functions have a hard 25-second cap. The confirmation wait was implemented as a single short-lived SSE window
that polls Supabase until the webhook lands or the 24s deadline passes
([`src/app/api/sse/route.ts`](../../../src/app/api/sse/route.ts), `MAX_WAIT_MS = 24_000`, `POLL_INTERVAL_MS = 1_500`).
Reasonable given the constraint; wasteful given that nothing happens until exactly one webhook fires.

The current flow ([`api/sse/route.ts:8-21`](../../../src/app/api/sse/route.ts)):

1. Browser opens `GET /api/sse?payment_intent_id=pi_xxx` after a successful embedded `PaymentElement` payment.
2. Server authenticates the session, retrieves the `PaymentIntent` from Stripe, reads `student_email` /
   `student_name` / `pack_size` from its metadata, and verifies the authenticated user owns it (CRIT-03).
3. Server polls `creditService.hasProcessedPayment(paymentIntentId)` every 1.5s.
4. Webhook `POST /api/stripe/webhook` → `paymentService.processWebhookEvent` → `handlePackPayment` →
   `creditService.addCredits(...)` ([`PaymentService.ts:342`](../../../src/services/PaymentService.ts#L342)).
5. Server detects the row and streams `event: credits_ready` with `{ credits, name, packSize }`, then closes.
6. On timeout it streams `event: timeout` and the browser falls back to a manual refresh.

### Consumer

The only consumer is [`useSSECredits`](../../../src/hooks/useSSECredits.ts), used by the pack success page
[`pago-exitoso/page.tsx:34`](../../../src/app/pago-exitoso/page.tsx#L34). It opens one `EventSource`, listens for
`credits_ready` / `timeout`, and exposes `{ state, credits, name, packSize }`.

> The single-session confirmation page `sesion-confirmada` does **not** use SSE — it fetches `/api/stripe/session`
> directly — so it is unaffected by this task (see Out of scope).

### Why Realtime works here

- Exactly one event needs to fan out per checkout: "this PaymentIntent's pack has been credited." Natural fit for a
  fire-and-forget broadcast.
- The identity is unambiguous and unguessable-by-derivation: the Stripe `PaymentIntent` id (`pi_xxx`), already on the
  browser URL. We key the channel by `HMAC(paymentIntentId, REALTIME_CHANNEL_SECRET)`, exactly as P3-01 keys chat by
  `HMAC(eventId, …)`.
- The Realtime client runs in the browser; no Vercel function holds a connection open.

### Why broadcast over Postgres-Changes

Same reasoning as [P3-01 §Auth model](01-replace-sse-with-realtime.md):

- Postgres-Changes (CDC) on `credit_packs` would be rejected by the deny-anon RLS policies from
  [P2-01](../phase-2-hardening/01-rls-policies.md) unless we mint a custom claims JWT and add a matching policy.
- A `broadcast` channel doesn't read tables, so RLS doesn't apply. The channel name (an HMAC) is the capability: the
  server only emits it to the verified owner, so an attacker can't compute it.
- There's only ever **one** row of interest per checkout, so broadcast keyed by `paymentIntentId` is a tighter fit
  than a filtered CDC subscription.

This task reuses the P3-01 infrastructure wholesale — **no new HMAC secret, no schema or policy changes.**

### The race we must handle

The webhook can fire **before** the browser subscribes (Stripe webhooks are fast; the redirect to `pago-exitoso`
plus React mount is not instant). A pure subscription would then wait forever for an event that already happened.
P3-01 solved the analogous problem by having the `/channel` endpoint also return the message backlog
(`initialMessages`). Here the equivalent is: the channel endpoint also returns the **current confirmation state**
(`hasProcessedPayment` + `getBalance`), so a late subscriber resolves immediately without ever needing the broadcast.

## Files affected

| File | Change |
|------|--------|
| `src/lib/realtime-channel.ts` | Add `paymentChannelName(checkoutId)` helper (reuses `REALTIME_CHANNEL_SECRET`) |
| `src/domain/repositories/ICreditRepository.ts` | Add `broadcastPaymentConfirmed(paymentIntentId, payload)` |
| `src/infrastructure/supabase/SupabaseCreditRepository.ts` | Implement `broadcastPaymentConfirmed` via `supabase.channel(...).send(...)` |
| `src/__tests__/fixtures/` (in-memory credit repo) | Add `broadcastPaymentConfirmed` — no-op or test-observable stub |
| `src/services/CreditService.ts` | Thin `broadcastPaymentConfirmed` pass-through |
| `src/services/PaymentService.ts` | `handlePackPayment` fires the broadcast best-effort after `addCredits` |
| `src/app/api/payment-confirmation/channel/route.ts` | **NEW** — one-shot endpoint: auth + Stripe-ownership gate + current confirmation state |
| `src/app/api/sse/route.ts` | **DELETE** — replaced by the channel endpoint + Realtime |
| `src/hooks/useSSECredits.ts` | Rewrite — subscribe to the Realtime channel; **public API unchanged** |

## The change

### 1. `src/lib/realtime-channel.ts` — add a payment channel helper

Reuse the existing module and its `REALTIME_CHANNEL_SECRET`; do **not** introduce a second secret.

```typescript
// REFACTOR-P3-05: Per-PaymentIntent Realtime channel name. Same HMAC capability
// model as chatChannelName (REFACTOR-P3-01): the server only emits this name to
// the verified owner of the PaymentIntent, so it acts as an unguessable token.
export function paymentChannelName(checkoutId: string): string {
  const mac = crypto
    .createHmac("sha256", REALTIME_CHANNEL_SECRET!)
    .update(checkoutId)
    .digest("hex")
    .slice(0, 32); // 128 bits
  return `pay:${mac}`;
}
```

### 2. `src/services/CreditService.ts` + repository — broadcast on confirmation

Add to `ICreditRepository`:

```typescript
// REFACTOR-P3-05
broadcastPaymentConfirmed(
  paymentIntentId: string,
  payload: { credits: number; name: string; packSize: number },
): Promise<void>;
```

`SupabaseCreditRepository` — mirror `SupabaseSessionRepository.broadcastChatMessage`:

```typescript
import { paymentChannelName } from "@/lib/realtime-channel";

// REFACTOR-P3-05: Broadcast on a per-PaymentIntent channel. The name is derived
// via HMAC from paymentIntentId + REALTIME_CHANNEL_SECRET, so unguessable without
// the secret. Fire-and-forget — persistence already happened in addCredits.
async broadcastPaymentConfirmed(paymentIntentId: string, payload: {
  credits: number; name: string; packSize: number;
}): Promise<void> {
  const channel = supabase.channel(paymentChannelName(paymentIntentId), {
    config: { broadcast: { ack: false } },
  });
  await channel.send({ type: "broadcast", event: "confirmed", payload });
  await supabase.removeChannel(channel);
}
```

`CreditService` gets a thin pass-through, and the in-memory fixture repo gets a no-op (or pushes into a
test-observable array so unit tests can assert it was called).

### 3. `src/services/PaymentService.ts` — broadcast after persistence (best-effort)

In `handlePackPayment`, right after `addCredits`, fire the broadcast guarded exactly like
`SessionService.postChatMessage` ([P3-01 §2](01-replace-sse-with-realtime.md)):

```typescript
await this.credits.addCredits({
  email, name, amount: packSize,
  packLabel: `Pack ${packSize} clases`, stripeSessionId: intentId,
});
log("info", "Pack credits written", { service: "payment", email, packSize });

// REFACTOR-P3-05: Broadcast for live confirmation. Best-effort — credits are
// already persisted above, so a broadcast failure just means the browser falls
// back to the channel-endpoint state check on (re)subscribe.
try {
  const balance = await this.credits.getBalance(email);
  await this.credits.broadcastPaymentConfirmed(intentId, {
    credits:  balance?.credits  ?? packSize,
    name:     balance?.name     ?? name,
    packSize: balance?.packSize ?? packSize,
  });
} catch (err) {
  log("warn", "Realtime payment broadcast failed (browser will catch up via channel endpoint)", {
    service: "payment", intentId, error: String(err),
  });
}
```

> Keep the broadcast inside `PaymentService`, not the webhook route. The route
> ([`api/stripe/webhook/route.ts`](../../../src/app/api/stripe/webhook/route.ts)) stays a thin adapter (ARCH-14);
> business logic — including the broadcast — belongs in the service.

### 4. New file: `src/app/api/payment-confirmation/channel/route.ts`

One-shot GET that reuses the **exact** auth + Stripe-ownership gate from the current `/api/sse`, then returns the
channel name plus the current confirmation state (so a late subscriber resolves without waiting for a broadcast).

```typescript
// REFACTOR-P3-05: replaces the polling GET /api/sse. Returns the Realtime channel
// name (HMAC-derived, server-only) plus the current confirmation state. The browser
// subscribes to the channel for live delivery; if the webhook already fired, `confirmed`
// is true here and no broadcast is needed.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { creditService } from "@/services";
import { paymentChannelName } from "@/lib/realtime-channel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");
  if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
    return NextResponse.json({ error: "Missing or invalid payment_intent_id" }, { status: 400 });
  }

  const authSession = await auth();
  if (!authSession?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Resolve identity from PaymentIntent metadata (never trust URL params) — same as the old /api/sse gate.
  let email: string, name: string, packSize: number;
  try {
    const intent = await new Stripe(process.env.STRIPE_SECRET_KEY!).paymentIntents.retrieve(paymentIntentId);
    email    = intent.metadata?.student_email ?? "";
    name     = intent.metadata?.student_name  ?? "";
    packSize = parseInt(intent.metadata?.pack_size ?? "0", 10);
    if (!email) return NextResponse.json({ error: "PaymentIntent metadata incomplete" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not retrieve PaymentIntent" }, { status: 500 });
  }

  if (email.toLowerCase() !== authSession.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Current state ("backlog" equivalent): if the webhook already landed, return the balance now.
  const confirmed = await creditService.hasProcessedPayment(paymentIntentId);
  const balance   = confirmed ? await creditService.getBalance(email) : null;

  return NextResponse.json({
    channelName: paymentChannelName(paymentIntentId),
    confirmed,
    credits:  balance?.credits  ?? (confirmed ? packSize : null),
    name:     balance?.name     ?? name,
    packSize: balance?.packSize ?? packSize,
  });
}
```

### 5. Rewrite `src/hooks/useSSECredits.ts` — subscribe instead of poll

Keep the **public API identical** (`{ state, credits, name, packSize }`) so
[`pago-exitoso/page.tsx`](../../../src/app/pago-exitoso/page.tsx) needs no changes. Mirror the reconnect/state-refetch
pattern from [`useSessionChatStream`](../../../src/hooks/useSessionChatStream.ts):

```typescript
"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

// REFACTOR-P3-05: replaced the polling SSE EventSource with a Supabase Realtime
// broadcast subscription. The browser fetches the channel name + current state
// from /api/payment-confirmation/channel and subscribes for live confirmation —
// one WebSocket per tab, zero polling. Public API is unchanged.
export function useSSECredits({ paymentIntentId }: UseSSECreditsOptions): SSECreditsResult {
  // ...same state shape: state / credits / name / packSize...

  useEffect(() => {
    if (!paymentIntentId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabaseBrowser.channel> | null = null;

    const applyConfirmed = (d: { credits: number; name: string; packSize: number | null }) => {
      setCredits(d.credits); setName(d.name); setPackSize(d.packSize); setState("confirmed");
    };

    // Fetch channel name + current state. Returns channelName, or null if already resolved/failed.
    const fetchState = async (): Promise<string | null> => {
      const res = await fetch(`/api/payment-confirmation/channel?payment_intent_id=${encodeURIComponent(paymentIntentId)}`);
      if (cancelled || !res.ok) return null;
      const data = await res.json();
      if (cancelled) return null;
      if (data.confirmed) { applyConfirmed(data); return null; } // race: webhook already fired
      return data.channelName as string;
    };

    (async () => {
      const channelName = await fetchState();
      if (cancelled || !channelName) return;

      channel = supabaseBrowser
        .channel(channelName)
        .on("broadcast", { event: "confirmed" }, ({ payload }) => applyConfirmed(payload))
        .subscribe((status) => {
          // On reconnect, re-check state in case the broadcast landed during the gap.
          if (status === "SUBSCRIBED") void fetchState();
        });
    })();

    // Client-side timeout fallback (was the server `timeout` event) → manual refresh prompt.
    const timer = setTimeout(() => { if (!cancelled) setState((s) => (s === "confirmed" ? s : "timeout")); }, 30_000);

    return () => { cancelled = true; clearTimeout(timer); if (channel) supabaseBrowser.removeChannel(channel); };
  }, [paymentIntentId]);

  return { state, credits, name, packSize };
}
```

### 6. Delete `src/app/api/sse/route.ts`

The channel endpoint + Realtime fully replace it. Remove the route file (and confirm no other caller references
`/api/sse` — only `useSSECredits` does today).

## Acceptance criteria

- [ ] `paymentChannelName(checkoutId)` added to `realtime-channel.ts`, reusing the existing `REALTIME_CHANNEL_SECRET`
      (no new secret introduced).
- [ ] `GET /api/payment-confirmation/channel` returns `{ channelName, confirmed, credits, name, packSize }` behind the
      same auth + Stripe-ownership gate the old `/api/sse` used.
- [ ] `handlePackPayment` broadcasts the confirmation after `addCredits`; a broadcast failure never fails the webhook
      (returns 200, logs `warn`).
- [ ] `GET /api/sse` deleted; no remaining references.
- [ ] `useSSECredits` subscribes to the channel (no `EventSource`); its public API (`state`/`credits`/`name`/`packSize`)
      is unchanged and `pago-exitoso/page.tsx` is untouched.
- [ ] Webhook-before-subscribe race resolves immediately via the channel endpoint's `confirmed` state.
- [ ] DB queries per confirmation: ≤ 2 (state check + balance) with no polling (was up to ~13).
- [ ] Confirmation visible to the browser in <500 ms p95 (was up to ~1.5s).
- [ ] Unit test for `paymentChannelName`; service tests for the broadcast path (see below).

## Test plan

### New / updated service tests

```typescript
describe("REFACTOR-P3-05: broadcast on pack confirmation", () => {
  it("broadcasts after credits are written", async () => {
    const services = buildTestServices();
    const spy = jest.spyOn(services.creditRepo, "broadcastPaymentConfirmed");

    await services.paymentService.processWebhookEvent(packSucceededEvent("pi_123"));

    expect(spy).toHaveBeenCalledWith("pi_123", expect.objectContaining({ packSize: expect.any(Number) }));
  });

  it("does not fail the webhook if broadcast throws", async () => {
    const services = buildTestServices();
    jest.spyOn(services.creditRepo, "broadcastPaymentConfirmed").mockRejectedValueOnce(new Error("network"));

    await expect(services.paymentService.processWebhookEvent(packSucceededEvent("pi_123"))).resolves.toBeUndefined();
  });
});
```

Plus a unit test asserting `paymentChannelName` is deterministic and differs from `chatChannelName` for the same id.

### Component / e2e

Update the `pago-exitoso` coverage so it waits for a Realtime-driven confirmation (or a `confirmed: true` channel
response) instead of an `EventSource` event. Increase the timeout slightly during the transition.

### Manual

```bash
# Buy a pack with the embedded PaymentElement, land on /pago-exitoso.
# Network panel: no recurring polls to /api/sse (route is gone); one GET to
#   /api/payment-confirmation/channel; a wss://<project>.supabase.co connection.
# Confirmation (credits shown) appears within ~200 ms of the webhook landing.
# Also test the race: trigger the webhook before opening the page — the channel
#   endpoint returns confirmed:true and the UI resolves without any broadcast.
```

## Notes / gotchas

- **Webhook-before-subscribe race** is the main subtlety — handled by returning `confirmed`/balance from the channel
  endpoint and re-checking state on every `SUBSCRIBED` (including reconnects). Do not rely on the broadcast alone.
- **Reuse `REALTIME_CHANNEL_SECRET`** from P3-01 — no new env var, no new `startup-checks.ts` entry.
- **CSP** already allows `wss://*.supabase.co` (added in P3-01), so no `next.config.mjs` change is needed.
- **Best-effort broadcast:** DB persistence (`addCredits`) is the source of truth. The broadcast is fire-and-forget;
  late or disconnected subscribers recover via the channel endpoint's state check.
- **No backwards-compat shim:** `/api/sse` is removed in the same PR. If a zero-downtime deploy window is desired,
  keep the old GET for one deploy cycle, then delete.
- **Single getBalance in the broadcast:** the webhook reads the balance once to populate the payload; this is the same
  read the old SSE did on success, just moved to the producer side.

## Out of scope

- The single-session `sesion-confirmada` flow — it uses a direct `/api/stripe/session` fetch, not SSE.
- Postgres-Changes / custom-claims-JWT + RLS approach (broadcast is simpler and sufficient; see Context).
- Realtime presence or delivery ACKs — best-effort broadcast plus DB persistence is enough here.
- Touching `api/stripe/webhook/route.ts` beyond what already calls `processWebhookEvent` — it stays a thin adapter.
