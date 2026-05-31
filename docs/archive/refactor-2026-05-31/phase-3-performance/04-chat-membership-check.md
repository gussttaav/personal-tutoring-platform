# Task P3-04 — Chat membership check in `SessionService.getChatMessages`

**Severity:** 🟡 Medium (security)
**Effort:** 30 minutes
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`SessionService.getChatMessages` has a comment:

> No membership check — mirrors the current SSE handler behaviour.

So any authenticated user who knows an `eventId` can read another session's chat. Add the membership check. The fix is small; calling it out separately because it's security-flavored.

## Context

### The current code

```typescript
// src/services/SessionService.ts:5314
// Returns chat messages starting at fromIndex.
// No membership check — mirrors the current SSE handler behaviour.
async getChatMessages(params: {
  eventId:   string;
  userEmail: string;
  fromIndex: number;
}): Promise<{ messages: string[]; nextCursor: number }> {
  const total = await this.sessions.countChatMessages(params.eventId);
  if (total <= params.fromIndex) {
    return { messages: [], nextCursor: params.fromIndex };
  }
  const messages = await this.sessions.listChatMessages(params.eventId, params.fromIndex, total - 1);
  return { messages, nextCursor: total };
}
```

### How `eventId` leaks

- It's in the URL of `/sesion/{token}` indirectly (the join token resolves to eventId server-side)
- It's in DevTools network tab while a session is live
- It's in browser history / share dialogs
- It could appear in an email forward, a screenshot, a copy-paste

`eventId` should not be treated as a capability. Authorization must be a separate check.

### Why now

[P3-01](01-replace-sse-with-realtime.md) moves the initial backlog fetch into `SessionService.getChatMessages` (via `/api/chat-session/channel`). Without this fix, that endpoint inherits the same leak.

## Files affected

| File | Change |
|------|--------|
| `src/services/SessionService.ts` | Add membership check at the start of `getChatMessages` |
| `src/app/api/chat-session/channel/route.ts` | Map `UnauthorizedError` to 403 (already done if you followed P3-01) |
| `src/services/__tests__/SessionService.test.ts` | New test |

## The change

### `src/services/SessionService.ts`

```typescript
async getChatMessages(params: {
  eventId:   string;
  userEmail: string;
  fromIndex: number;
}): Promise<{ messages: string[]; nextCursor: number }> {
  // REFACTOR-P3-04: Membership check. Previously absent — any authenticated
  // user with knowledge of an eventId could read another session's chat.
  const record = await this.sessions.findByEventId(params.eventId);
  if (!record) throw new BookingNotFoundError();

  const isTutor   = params.userEmail === this.tutorEmail;
  const isStudent = record.studentEmail
    ? record.studentEmail.toLowerCase() === params.userEmail.toLowerCase()
    : false;

  if (!record.studentEmail) {
    // Legacy record (pre SEC-03) — tutor only
    if (!isTutor) throw new UnauthorizedError();
  } else if (!isTutor && !isStudent) {
    log("warn", "Unauthorized chat read attempt", {
      service: "SessionService",
      requester: params.userEmail,
      eventId: params.eventId,
    });
    throw new UnauthorizedError();
  }

  // ── existing read logic; if P3-02 is merged, use *ById variants ──────────
  const zoomSessionId = await this.sessions.resolveZoomSessionId(params.eventId);
  if (!zoomSessionId) return { messages: [], nextCursor: params.fromIndex };

  const total = await this.sessions.countChatMessagesById(zoomSessionId);
  if (total <= params.fromIndex) {
    return { messages: [], nextCursor: params.fromIndex };
  }
  const messages = await this.sessions.listChatMessagesById(zoomSessionId, params.fromIndex, total - 1);
  return { messages, nextCursor: total };
}
```

This pattern is **identical** to what `postChatMessage` already does. Consider extracting a private helper if you want DRY:

```typescript
private async assertParticipant(eventId: string, userEmail: string): Promise<ZoomSession> {
  const record = await this.sessions.findByEventId(eventId);
  if (!record) throw new BookingNotFoundError();

  const isTutor   = userEmail === this.tutorEmail;
  const isStudent = record.studentEmail
    ? record.studentEmail.toLowerCase() === userEmail.toLowerCase()
    : false;

  if (!record.studentEmail) {
    if (!isTutor) throw new UnauthorizedError();
  } else if (!isTutor && !isStudent) {
    log("warn", "Unauthorized session access", {
      service: "SessionService", requester: userEmail, eventId,
    });
    throw new UnauthorizedError();
  }

  return record;
}
```

Then call from `issueJoinToken`, `postChatMessage`, and the new `getChatMessages`.

### Route handler — already done if you did P3-01

```typescript
// src/app/api/chat-session/channel/route.ts
catch (err) {
  if (err instanceof BookingNotFoundError) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (err instanceof UnauthorizedError)    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  throw err;
}
```

If you haven't done P3-01 yet, the old `GET /api/chat-session` SSE handler also needs the same mapping. The 401 it returns today for missing auth is fine; what it lacks is the 403 for present-but-unauthorized.

## Acceptance criteria

- [ ] `getChatMessages` throws `BookingNotFoundError` for unknown `eventId`
- [ ] `getChatMessages` throws `UnauthorizedError` for an authenticated user who is not tutor or student
- [ ] Calling code maps `UnauthorizedError` → 403
- [ ] Existing tests pass
- [ ] New test covers the unauthorized-read path

## Test plan

### New test

```typescript
describe("REFACTOR-P3-04: chat membership check", () => {
  it("throws UnauthorizedError when caller is not tutor or student", async () => {
    const services = buildTestServices();
    await seedZoomSession(services, {
      eventId: "evt",
      studentEmail: "alice@example.com",
      sessionType: "session1h",
      startIso: new Date().toISOString(),
    });

    await expect(services.sessionService.getChatMessages({
      eventId: "evt",
      userEmail: "bob@example.com",  // not the student, not the tutor
      fromIndex: 0,
    })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("allows the assigned student", async () => {
    const services = buildTestServices();
    await seedZoomSession(services, {
      eventId: "evt",
      studentEmail: "alice@example.com",
      sessionType: "session1h",
      startIso: new Date().toISOString(),
    });

    await expect(services.sessionService.getChatMessages({
      eventId: "evt",
      userEmail: "alice@example.com",
      fromIndex: 0,
    })).resolves.toBeDefined();
  });

  it("allows the tutor", async () => {
    const services = buildTestServices({ tutorEmail: "tutor@example.com" });
    await seedZoomSession(services, { eventId: "evt", studentEmail: "alice@example.com", /* ... */ });

    await expect(services.sessionService.getChatMessages({
      eventId: "evt",
      userEmail: "tutor@example.com",
      fromIndex: 0,
    })).resolves.toBeDefined();
  });
});
```

### Manual

```bash
# Sign in as a user who is NOT the tutor and NOT the student for eventId X
curl -H "Cookie: $OUTSIDER_SESSION" \
     "https://gustavoai.dev/api/chat-session/channel?eventId=X"
# Expected: 403
```

## Notes / gotchas

- **Legacy records:** `record.studentEmail` may be `null` for pre-SEC-03 bookings. The check above falls through to "tutor only" — same convention as `issueJoinToken`. Don't accidentally allow these to anyone.
- **Case sensitivity:** emails compared via `.toLowerCase()`. Matches the convention used elsewhere.
- **`UnauthorizedError` already exists** in `domain/errors.ts` — no new error class needed.

## Out of scope

- Logging chat access in `audit_log`. Useful but a separate concern.
- Per-message ACLs (e.g. private messages from tutor). Out of scope — chat is room-wide.
- Rate-limiting chat reads (already covered by general API rate limiter).
