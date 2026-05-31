# Task P3-02 — Fix `SupabaseSessionRepository` N+1 on zoom_session_id resolution

**Severity:** 🟠 High
**Effort:** 2–3 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

Every chat message read/write resolves `eventId → booking_id → zoom_session_id` (2 queries) **twice** for read paths (once for `count`, once for `list`). Fix by passing the resolved `zoom_session_id` once and reusing it.

## Context

### The current shape

```typescript
// src/infrastructure/supabase/SupabaseSessionRepository.ts:4478
async appendChatMessage(eventId: string, message: string): Promise<number> {
  const zoomSessionId = await this.findZoomSessionId(eventId);  // 2 queries
  if (!zoomSessionId) throw new Error(`No zoom session for eventId: ${eventId}`);
  const { error } = await supabase.from("session_messages").insert({ /* ... */ });
  if (error) throw error;
  return this.countChatMessages(eventId);  // 2 more queries
}

async listChatMessages(eventId: string, from: number, to: number): Promise<string[]> {
  const zoomSessionId = await this.findZoomSessionId(eventId);  // 2 queries
  // ...
}

async countChatMessages(eventId: string): Promise<number> {
  const zoomSessionId = await this.findZoomSessionId(eventId);  // 2 queries
  // ...
}

private async findZoomSessionId(eventId: string): Promise<string | null> {
  const { data: booking } = await supabase.from("bookings").select("id").eq(...).maybeSingle();
  if (!booking) return null;
  const { data: zs } = await supabase.from("zoom_sessions").select("id").eq("booking_id", booking.id).maybeSingle();
  return zs?.id ?? null;
}
```

### Why it's bad

In the old polling SSE (replaced by P3-01), each 1.5s poll did:

```
count(eventId)  → 2 queries
list(eventId, ...)  → 2 queries
= 4 queries per poll × ~13 polls = ~52 queries per 20s connection per user
```

Even after P3-01 swaps SSE for Realtime, the **POST** path stays:

```
postChatMessage:
  findByEventId       → 3 queries (bookings, zoom_sessions, users)
  countChatMessages   → 2 queries (findZoomSessionId + count)
  appendChatMessage   → 3 queries (findZoomSessionId + insert + countChatMessages → which does 2 more)
                                                                  ↑
                                                          recursive N+1
= ~10 queries per chat message
```

We can collapse that to ~3.

## Files affected

| File | Change |
|------|--------|
| `src/domain/repositories/ISessionRepository.ts` | Add `*ById` variants that accept `zoomSessionId` directly |
| `src/infrastructure/supabase/SupabaseSessionRepository.ts` | Implement `*ById` methods; cache resolution per call site |
| `src/services/SessionService.ts` | Resolve once, pass through |
| `src/__tests__/fixtures/InMemorySessionRepository.ts` | Implement the new methods |

## The change

### 1. Domain interface

```typescript
// src/domain/repositories/ISessionRepository.ts
export interface ISessionRepository {
  // Existing — keep for backward compat / convenience callers
  createSession(eventId: string, session: ZoomSession): Promise<void>;
  findByEventId(eventId: string): Promise<ZoomSession | null>;
  deleteByEventId(eventId: string): Promise<void>;
  appendChatMessage(eventId: string, message: string): Promise<number>;
  listChatMessages(eventId: string, from: number, to: number): Promise<string[]>;
  countChatMessages(eventId: string): Promise<number>;

  // REFACTOR-P3-02: Direct-by-id variants. SessionService resolves the
  // zoomSessionId once per request and threads it through, eliminating the
  // findZoomSessionId N+1.
  resolveZoomSessionId(eventId: string): Promise<string | null>;
  appendChatMessageById(zoomSessionId: string, message: string): Promise<number>;
  listChatMessagesById(zoomSessionId: string, from: number, to: number): Promise<string[]>;
  countChatMessagesById(zoomSessionId: string): Promise<number>;

  // From P3-01
  broadcastChatMessage?(eventId: string, message: unknown): Promise<void>;
}
```

### 2. Supabase implementation

```typescript
// src/infrastructure/supabase/SupabaseSessionRepository.ts

// REFACTOR-P3-02: Resolves eventId → zoom_session_id in a single round trip
// via a join. Callers should call this once per request, then pass the id
// into *ById methods.
async resolveZoomSessionId(eventId: string): Promise<string | null> {
  // PostgREST supports embedded resources via foreign-key hints.
  // bookings(id) -> zoom_sessions(booking_id) is the FK chain.
  const { data, error } = await supabase
    .from("bookings")
    .select("zoom_sessions!inner(id)")
    .eq("calendar_event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  const joined = data?.zoom_sessions as { id: string } | { id: string }[] | null;
  if (!joined) return null;
  // PostgREST returns either a single object or an array depending on the FK direction
  return Array.isArray(joined) ? joined[0]?.id ?? null : joined.id;
}

async appendChatMessageById(zoomSessionId: string, message: string): Promise<number> {
  const { error } = await supabase.from("session_messages").insert({
    zoom_session_id: zoomSessionId,
    content:         message,
  });
  if (error) throw error;
  return this.countChatMessagesById(zoomSessionId);
}

async listChatMessagesById(
  zoomSessionId: string, from: number, to: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("session_messages")
    .select("content")
    .eq("zoom_session_id", zoomSessionId)
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return (data ?? []).map(r => r.content);
}

async countChatMessagesById(zoomSessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("session_messages")
    .select("id", { count: "exact", head: true })
    .eq("zoom_session_id", zoomSessionId);
  if (error) throw error;
  return count ?? 0;
}

// Keep the existing eventId-based methods as thin wrappers that resolve once:
async appendChatMessage(eventId: string, message: string): Promise<number> {
  const id = await this.resolveZoomSessionId(eventId);
  if (!id) throw new Error(`No zoom session for eventId: ${eventId}`);
  return this.appendChatMessageById(id, message);
}

async listChatMessages(eventId: string, from: number, to: number): Promise<string[]> {
  const id = await this.resolveZoomSessionId(eventId);
  if (!id) return [];
  return this.listChatMessagesById(id, from, to);
}

async countChatMessages(eventId: string): Promise<number> {
  const id = await this.resolveZoomSessionId(eventId);
  if (!id) return 0;
  return this.countChatMessagesById(id);
}

// findByEventId stays — it returns more fields than just zoom_session_id and
// is used by issueJoinToken which needs them all.
```

### 3. `SessionService` — resolve once, thread through

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

  // REFACTOR-P3-02: resolve once, reuse for count + append
  const zoomSessionId = await this.sessions.resolveZoomSessionId(params.eventId);
  if (!zoomSessionId) throw new BookingNotFoundError();

  const currentLen = await this.sessions.countChatMessagesById(zoomSessionId);
  const message = {
    id:          `${params.eventId}:${currentLen}`,
    senderEmail: params.senderEmail,
    senderName:  params.senderName,
    text:        params.text.trim().slice(0, 1000),
    sentAt:      new Date().toISOString(),
  };
  await this.sessions.appendChatMessageById(zoomSessionId, JSON.stringify(message));

  // From P3-01:
  try { await this.sessions.broadcastChatMessage?.(params.eventId, message); }
  catch (err) { log("warn", "Broadcast failed", { eventId: params.eventId, error: String(err) }); }

  return { messageId: message.id };
}

async getChatMessages(params: {
  eventId:   string;
  userEmail: string;
  fromIndex: number;
}): Promise<{ messages: string[]; nextCursor: number }> {
  // REFACTOR-P3-02: single resolution; subsequent count + list reuse the id
  const zoomSessionId = await this.sessions.resolveZoomSessionId(params.eventId);
  if (!zoomSessionId) return { messages: [], nextCursor: params.fromIndex };

  // Note: P3-04 will add a membership check here. Keep its insertion point in mind.

  const total = await this.sessions.countChatMessagesById(zoomSessionId);
  if (total <= params.fromIndex) {
    return { messages: [], nextCursor: params.fromIndex };
  }
  const messages = await this.sessions.listChatMessagesById(zoomSessionId, params.fromIndex, total - 1);
  return { messages, nextCursor: total };
}
```

### 4. `InMemorySessionRepository`

Mirror the new methods. The in-memory map keyed by eventId already has the equivalent of "resolved" sessions; add an internal id field if needed.

## Acceptance criteria

- [ ] `ISessionRepository` exposes `resolveZoomSessionId` + three `*ById` methods
- [ ] Supabase impl uses a single join query in `resolveZoomSessionId`
- [ ] `SessionService.postChatMessage` makes ≤ 3 DB queries: `findByEventId`, `resolveZoomSessionId` (cached if you store it on record), `countChatMessagesById`, `appendChatMessageById`. (4 queries acceptable if you don't cache.)
- [ ] `SessionService.getChatMessages` makes ≤ 3 queries: `resolveZoomSessionId`, `countChatMessagesById`, `listChatMessagesById`
- [ ] Old eventId-based methods still work (thin wrappers) so other call sites don't break
- [ ] All existing tests pass

## Test plan

### Query count test

Spy on the Supabase mock and assert call counts:

```typescript
describe("REFACTOR-P3-02: query counts", () => {
  it("postChatMessage uses ≤ 4 DB queries", async () => {
    const services = buildTestServices();
    const dbSpy = instrumentRepoCalls(services.sessionRepo);

    await services.sessionService.postChatMessage({
      eventId: "evt", senderEmail: "s@example.com",
      senderName: "S", text: "hi",
    });

    expect(dbSpy.totalCalls).toBeLessThanOrEqual(4);
  });

  it("getChatMessages uses ≤ 3 DB queries", async () => {
    const services = buildTestServices();
    const dbSpy = instrumentRepoCalls(services.sessionRepo);

    await services.sessionService.getChatMessages({
      eventId: "evt", userEmail: "s@example.com", fromIndex: 0,
    });

    expect(dbSpy.totalCalls).toBeLessThanOrEqual(3);
  });
});
```

`instrumentRepoCalls` is a small helper that wraps every method in a `jest.fn()` and counts invocations.

### Manual verification via Supabase logs

```bash
# In Supabase dashboard → Logs → Query log
# Set filter: sql ILIKE '%session_messages%' OR sql ILIKE '%zoom_sessions%'
# Send one chat message via the live app
# Count distinct queries with that timestamp — should be 3-4, not 8-10
```

## Notes / gotchas

- **PostgREST embed syntax:** `zoom_sessions!inner(id)` requires a FK from `zoom_sessions.booking_id → bookings.id`. The schema has this; verify with `\d zoom_sessions`. If the embed returns `null` despite a record existing, you have a FK problem.
- **Don't cache `zoom_session_id` across requests** (in-process). Vercel functions are not guaranteed to be the same instance per user, and the cost of one lookup is acceptable. Cache only within the same request.
- **The wrapper methods avoid breaking changes.** If any external caller (admin tools, scripts) uses the old eventId-based methods, they continue to work.

## Out of scope

- Adding a materialized view `eventId_to_zoom_session_id`. Negligible benefit; embedded join is sufficient.
- Caching the resolution in Redis. Premature; measure first.
- Changing the `bookings.calendar_event_id` to be a UUID FK directly. Schema-level work for marginal gain.
