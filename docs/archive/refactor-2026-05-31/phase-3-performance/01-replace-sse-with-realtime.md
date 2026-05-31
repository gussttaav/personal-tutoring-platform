# Task P3-01 — Replace `/api/chat-session` SSE polling with Supabase Realtime

**Severity:** 🟠 High
**Effort:** 1–2 days
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`GET /api/chat-session` polls Supabase every 1.5s for up to 20s, then closes; the EventSource reconnects with `Last-Event-ID`. Each poll runs ~6 queries (because of [P3-02](02-session-repository-n1.md)'s N+1). Result: ~100 queries/min per chat session, plus 1.5s message-delivery latency.

Supabase Realtime gives sub-second delivery and one persistent WebSocket per browser, with **zero polling**.

## Context

### Why polling exists today

Vercel functions have a hard 25-second cap. Long-lived SSE was implemented as repeated short SSE windows with `Last-Event-ID` resumption. Reasonable choice given the constraint; expensive given the multipliers.

### Why Realtime works here

- `session_messages.INSERT` is the only event that needs to fan out — natural fit for Postgres CDC.
- Filter is straightforward: `zoom_session_id=eq.X`.
- Realtime client is in the browser; no Vercel function involved.
- One persistent connection per browser tab.

### Auth model for Realtime

This is the **only** subtle bit:

- Realtime uses the Supabase anon key + a JWT
- The deny-anon RLS policies from [P2-01](../phase-2-hardening/01-rls-policies.md) will reject subscriptions

Two ways to handle this:

**Option A (recommended): Realtime-broadcast channels, not Postgres CDC.**
- Server publishes a row insert to a `broadcast` channel with a per-eventId topic
- Clients subscribe to the channel; topic is unguessable (HMAC of eventId)
- Bypasses RLS entirely (broadcast doesn't read DB)
- Backend keeps writing to `session_messages` for persistence; broadcast is fire-and-forget alongside

**Option B: Postgres-CDC with a custom JWT.**
- Server issues a signed Supabase JWT that includes `(eventId, role)` claims
- Add an RLS policy on `session_messages` that uses `current_setting('request.jwt.claims', true)::jsonb` to check claims
- More auditable, more complex

This task uses **Option A** — simpler, fewer moving parts, no schema or policy changes.

## Files affected

| File | Change |
|------|--------|
| `src/app/api/chat-session/route.ts` | Remove GET (SSE). POST also broadcasts via Realtime |
| `src/services/SessionService.ts` | `postChatMessage` calls a new `broadcastChat` infrastructure call |
| `src/infrastructure/supabase/SupabaseSessionRepository.ts` | (optional) Add `broadcastChatMessage` |
| `src/lib/supabase-browser.ts` | **NEW** — browser-side Supabase client (anon key) for Realtime |
| `src/hooks/useSessionChatStream.ts` | Rewrite — subscribe to Realtime channel, no EventSource |
| `src/lib/realtime-channel.ts` | **NEW** — server signs HMAC, browser verifies (token-style) |

## The change

### 1. New file: `src/lib/realtime-channel.ts`

```typescript
/**
 * REFACTOR-P3-01: Per-eventId Realtime channel tokens.
 *
 * The channel name encodes the eventId; the channel access token is an HMAC
 * over (eventId + userEmail). Only the server can mint these. The browser
 * presents the token via Realtime's `broadcast.ack` extension.
 *
 * This is NOT enforcement — Realtime broadcast channels are open to anyone
 * who knows the channel name. The enforcement is that the channel name is
 * itself a secret: `chat:{HMAC(eventId, channelSecret)}`. Without knowing
 * the secret, you can't compute the channel name.
 */

import crypto from "crypto";

const REALTIME_CHANNEL_SECRET = process.env.REALTIME_CHANNEL_SECRET!;
if (!REALTIME_CHANNEL_SECRET) {
  throw new Error("REALTIME_CHANNEL_SECRET is not set");
}

export function chatChannelName(eventId: string): string {
  const mac = crypto
    .createHmac("sha256", REALTIME_CHANNEL_SECRET)
    .update(eventId)
    .digest("hex")
    .slice(0, 32);  // 128 bits, plenty
  return `chat:${mac}`;
}
```

Add `REALTIME_CHANNEL_SECRET` to `startup-checks.ts` and generate with `openssl rand -hex 32`.

### 2. `src/services/SessionService.ts` — broadcast on post

```typescript
async postChatMessage(params: {
  eventId:     string;
  senderEmail: string;
  senderName:  string;
  text:        string;
}): Promise<{ messageId: string }> {
  const record = await this.sessions.findByEventId(params.eventId);
  if (!record) throw new BookingNotFoundError();

  const isTutor   = params.senderEmail === this.tutorEmail;
  const isStudent = record.studentEmail
    ? record.studentEmail.toLowerCase() === params.senderEmail.toLowerCase()
    : false;
  if (!isTutor && !isStudent) throw new UnauthorizedError();

  const currentLen = await this.sessions.countChatMessages(params.eventId);
  const message = {
    id:          `${params.eventId}:${currentLen}`,
    senderEmail: params.senderEmail,
    senderName:  params.senderName,
    text:        params.text.trim().slice(0, 1000),
    sentAt:      new Date().toISOString(),
  };
  await this.sessions.appendChatMessage(params.eventId, JSON.stringify(message));

  // REFACTOR-P3-01: Broadcast for live delivery. Best-effort — persistence
  // already happened above, so a broadcast failure just means subscribers
  // refresh via a fallback fetch.
  try {
    await this.sessions.broadcastChatMessage(params.eventId, message);
  } catch (err) {
    log("warn", "Realtime broadcast failed (subscribers will catch up on next reconnect)", {
      service: "SessionService", eventId: params.eventId, error: String(err),
    });
  }

  return { messageId: message.id };
}
```

### 3. `src/infrastructure/supabase/SupabaseSessionRepository.ts` — add broadcastChatMessage

```typescript
import { supabase } from "./client";
import { chatChannelName } from "@/lib/realtime-channel";

// REFACTOR-P3-01: Broadcast on a per-eventId channel. The channel name is
// derived via HMAC from eventId + REALTIME_CHANNEL_SECRET, so unguessable
// without the secret.
async broadcastChatMessage(eventId: string, message: unknown): Promise<void> {
  const channelName = chatChannelName(eventId);
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: false } } });
  await channel.send({ type: "broadcast", event: "message", payload: message });
  await supabase.removeChannel(channel);
}
```

Add to `ISessionRepository`:

```typescript
broadcastChatMessage(eventId: string, message: unknown): Promise<void>;
```

In `InMemorySessionRepository`, make it a no-op or stash into a test-observable array.

### 4. New file: `src/lib/supabase-browser.ts`

```typescript
/**
 * REFACTOR-P3-01: Browser-side Supabase client for Realtime only.
 * Uses the anon key (NEVER the service role key — that would leak privileges).
 * Realtime broadcast channels don't query tables, so RLS doesn't apply.
 */

import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `startup-checks.ts`. Find these in Supabase project settings.

### 5. Rewrite `src/hooks/useSessionChatStream.ts`

```typescript
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface ChatMessage {
  id: string; senderEmail: string; senderName: string;
  text: string; sentAt: string;
}

interface ChannelTokenResponse {
  channelName: string;
  initialMessages: ChatMessage[];
}

export function useSessionChatStream(eventId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabaseBrowser.channel> | null = null;

    async function start() {
      // 1. Fetch the channel name + initial backlog from the server
      //    (server holds the HMAC secret; client cannot compute the channel name).
      const res = await fetch(`/api/chat-session/channel?eventId=${encodeURIComponent(eventId)}`);
      if (!res.ok) return;
      const { channelName, initialMessages } = (await res.json()) as ChannelTokenResponse;

      if (cancelled) return;

      // Seed state with backlog
      const seeded: ChatMessage[] = [];
      for (const m of initialMessages) {
        if (!seenIds.current.has(m.id)) {
          seenIds.current.add(m.id);
          seeded.push(m);
        }
      }
      setMessages(seeded);

      // 2. Subscribe to live updates
      channel = supabaseBrowser
        .channel(channelName)
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const msg = payload as ChatMessage;
          if (seenIds.current.has(msg.id)) return;
          seenIds.current.add(msg.id);
          setMessages(prev => [...prev, msg]);
        })
        .subscribe();
    }

    start();

    return () => {
      cancelled = true;
      if (channel) supabaseBrowser.removeChannel(channel);
    };
  }, [eventId]);

  return messages;
}
```

### 6. Replace `GET /api/chat-session` with a one-shot channel endpoint

```typescript
// src/app/api/chat-session/channel/route.ts (NEW)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionService } from "@/services";
import { chatChannelName } from "@/lib/realtime-channel";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  try {
    // REFACTOR-P3-04: membership check (also see Task P3-04 for the underlying fix)
    const { messages } = await sessionService.getChatMessages({
      eventId,
      userEmail: session.user.email,
      fromIndex: 0,
    });

    const parsed = messages.map(m => {
      try { return JSON.parse(m); } catch { return null; }
    }).filter(Boolean);

    return NextResponse.json({
      channelName: chatChannelName(eventId),
      initialMessages: parsed,
    });
  } catch (err) {
    if (err instanceof BookingNotFoundError) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    if (err instanceof UnauthorizedError)    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    throw err;
  }
}
```

### 7. Delete `GET` handler from `src/app/api/chat-session/route.ts`

The POST handler stays. Remove the GET handler, the SSE stream, the polling loop, and `dynamic = "force-dynamic"` if no longer needed. The `/channel` endpoint replaces it.

## Acceptance criteria

- [ ] `GET /api/chat-session` SSE handler removed
- [ ] `GET /api/chat-session/channel` returns `channelName` + `initialMessages`
- [ ] `POST /api/chat-session` continues to persist; additionally broadcasts via Realtime
- [ ] Client `useSessionChatStream` subscribes to the channel; no `EventSource`
- [ ] Messages delivered to other participant in <500 ms p95 (was ~1.5s)
- [ ] Total DB queries per session: 1 (backlog fetch) + 1 per posted message — no polling
- [ ] `REALTIME_CHANNEL_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` added to `startup-checks.ts`
- [ ] All existing chat tests updated; new tests for broadcast path

## Test plan

### Update e2e

```bash
pnpm test:e2e e2e/chat.spec.ts
```

The chat test will need updates — instead of waiting for EventSource events, it should wait for DOM updates after Realtime delivery. Increase the timeout slightly during transition.

### New service test

```typescript
describe("REFACTOR-P3-01: broadcast on post", () => {
  it("broadcasts the chat message after persistence", async () => {
    const services = buildTestServices();
    const broadcastSpy = jest.spyOn(services.sessionRepo, "broadcastChatMessage");

    await services.sessionService.postChatMessage({
      eventId: "evt",
      senderEmail: "s@example.com",
      senderName: "S",
      text: "hello",
    });

    expect(broadcastSpy).toHaveBeenCalledWith("evt", expect.objectContaining({ text: "hello" }));
  });

  it("does not fail postChatMessage if broadcast throws", async () => {
    const services = buildTestServices();
    jest.spyOn(services.sessionRepo, "broadcastChatMessage").mockRejectedValueOnce(new Error("network"));

    await expect(services.sessionService.postChatMessage({ /* ... */ })).resolves.toBeDefined();
  });
});
```

### Manual

```bash
# Tutor and student open the same session in two browser tabs.
# In the network panel: no recurring polls to /api/chat-session.
# A WebSocket connection to wss://<project>.supabase.co is established.
# Send a message from one tab; appears in the other within ~200 ms.
```

## Notes / gotchas

- **Realtime quotas:** Supabase free tier has limits (200 concurrent connections / 2M messages per month). For a single tutor's load, fine. For scale, check the dashboard.
- **Channel name leakage:** if a logged-in user somehow obtains another session's eventId AND tricks the server into emitting its channel name, they can subscribe to the broadcast. The membership check in `/channel` (Task P3-04) is what prevents the server from emitting the name to non-members.
- **Browser anon key in CSP:** ensure `wss://*.supabase.co` is in your CSP `connect-src`. Update `next.config.mjs` accordingly.
- **No backwards-compat shim:** the SSE endpoint is removed in the same PR. If you want a deploy window where both work, keep GET for one deploy cycle then delete.

## Out of scope

- Realtime presence (who's typing). Adds complexity; not requested.
- Migrating `/api/sse` (payment confirmation) to Realtime. Different table, different consumer pattern. Defer.
- Realtime ACKs / delivery guarantees. Best-effort is sufficient for chat; durability is via DB persistence.
