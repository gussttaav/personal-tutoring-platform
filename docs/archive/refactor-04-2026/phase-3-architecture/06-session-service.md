# Task 3.6 — Extract `SessionService`

**Fix ID:** `ARCH-15`
**Priority:** P2
**Est. effort:** 3 hours

## Problem

Zoom-session logic is split across:

- `/api/zoom/token/route.ts` — JWT generation, session-membership check (from SEC-03), rate limiting
- `/api/zoom/end/route.ts` (or `/api/internal/zoom-terminate` after REL-01) — session termination
- `/api/chat-session/route.ts` — in-session chat, both POST and GET (SSE)
- `src/lib/zoom.ts` — JWT signing, credential generation, duration-with-grace math

A `SessionService` consolidates the session-lifecycle logic so the routes are thin and the business rules live in one place. This also prepares for Phase 4, where session history moves to the database — all DB interaction will happen via `SessionService`.

## Scope

**Create:**
- `src/services/SessionService.ts`
- `src/services/__tests__/SessionService.test.ts`
- `src/infrastructure/zoom/ZoomClient.ts` — interface + implementation
- `src/infrastructure/zoom/index.ts`

**Modify:**
- `src/app/api/zoom/token/route.ts` — thin handler
- `src/app/api/internal/zoom-terminate/route.ts` — thin handler
- `src/app/api/chat-session/route.ts` — thin handler (both POST + GET)
- `src/services/index.ts` — add singleton

**Do not touch:**
- The Zoom Video SDK itself
- The in-browser Zoom client components (`ZoomRoom.tsx`, `ZoomRoomSession.tsx`)
- `src/lib/zoom.ts` — still works; `ZoomClient` wraps it

## Approach

### Step 1 — ZoomClient abstraction

```ts
// src/infrastructure/zoom/ZoomClient.ts
import * as zoomLib from "@/lib/zoom";
import type { SessionType } from "@/domain/types";

export interface IZoomClient {
  generateSessionCredentials(params: { sessionName: string }): {
    sessionId: string; sessionName: string; sessionPasscode: string;
  };

  generateJWT(params: {
    sessionName: string; role: 0 | 1;
    userName: string; sessionPasscode: string;
  }): string;

  getDurationWithGrace(sessionType: SessionType): number;
}

export class ZoomClient implements IZoomClient {
  generateSessionCredentials = zoomLib.generateZoomSessionCredentials;
  generateJWT                = zoomLib.generateZoomJWT;
  getDurationWithGrace       = zoomLib.getSessionDurationWithGrace;
}
```

### Step 2 — SessionService surface

```ts
// src/services/SessionService.ts
export class SessionService {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly zoom:     IZoomClient,
    private readonly tutorEmail: string,
  ) {}

  /**
   * Issues a short-lived JWT for a user to join a Zoom session.
   * Enforces membership: only the tutor or the assigned student can join.
   */
  async issueJoinToken(params: {
    eventId: string;
    userEmail: string;
    userName: string;
  }): Promise<IssueJoinTokenResult>;

  /**
   * Terminates a Zoom session record (removes it so no new JWTs can be issued).
   * Called by QStash after the session grace period, or manually by an admin.
   */
  async terminateSession(eventId: string): Promise<void>;

  /**
   * Appends a chat message to a live session. Validates that the sender is
   * a participant of the session.
   */
  async postChatMessage(params: {
    eventId: string;
    senderEmail: string;
    senderName: string;
    text: string;
  }): Promise<{ messageId: string }>;

  /**
   * Reads chat messages from a session, starting at cursor.
   * Returns raw JSON strings — parsed by the caller.
   */
  async getChatMessages(params: {
    eventId: string; userEmail: string; fromIndex: number;
  }): Promise<{ messages: string[]; nextCursor: number }>;
}
```

### Step 3 — Implementation highlights

```ts
async issueJoinToken(params) {
  const record = await this.sessions.findByEventId(params.eventId);
  if (!record) throw new BookingNotFoundError();

  const isTutor = params.userEmail === this.tutorEmail;
  const isStudent = record.studentEmail?.toLowerCase() === params.userEmail.toLowerCase();

  // Backward-compat: legacy records without studentEmail field — tutor only
  if (!record.studentEmail && !isTutor) {
    throw new UnauthorizedError();
  }
  if (record.studentEmail && !isTutor && !isStudent) {
    throw new UnauthorizedError();
  }

  const role: 0 | 1 = isTutor ? 1 : 0;
  const token = this.zoom.generateJWT({
    sessionName:     record.sessionName,
    role,
    userName:        params.userName,
    sessionPasscode: record.sessionPasscode,
  });

  return {
    token,
    sessionName:       record.sessionName,
    passcode:          record.sessionPasscode,
    startIso:          record.startIso,
    durationWithGrace: this.zoom.getDurationWithGrace(record.sessionType),
    expiresAt:         Math.floor(Date.now() / 1000) + 3600,
  };
}

async postChatMessage(params) {
  const record = await this.sessions.findByEventId(params.eventId);
  if (!record) throw new BookingNotFoundError();

  const isTutor = params.senderEmail === this.tutorEmail;
  const isStudent = record.studentEmail?.toLowerCase() === params.senderEmail.toLowerCase();
  if (!isTutor && !isStudent) throw new UnauthorizedError();

  const currentLen = await this.sessions.countChatMessages(params.eventId);
  const message = {
    id: `${params.eventId}:${currentLen}`,
    senderEmail: params.senderEmail,
    senderName:  params.senderName,
    text:        params.text.trim().slice(0, 1000),
    sentAt:      new Date().toISOString(),
  };
  await this.sessions.appendChatMessage(params.eventId, JSON.stringify(message));
  return { messageId: message.id };
}
```

### Step 4 — Route handlers shrink

**Token route:**
```ts
export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const { success } = await availabilityRatelimit.limit(`zoom:token:${getClientIp(req)}`);
  if (!success) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const { eventId } = await req.json();
  if (typeof eventId !== "string" || !eventId) {
    return NextResponse.json({ error: "Se requiere eventId" }, { status: 400 });
  }

  try {
    const result = await sessionService.issueJoinToken({
      eventId,
      userEmail: session.user.email,
      userName:  session.user.name ?? session.user.email,
    });
    return NextResponse.json(result);
  } catch (err) {
    return mapDomainErrorToResponse(err, { service: "zoom-token", eventId });
  }
}
```

**Chat session GET (SSE)** keeps its streaming logic in the route handler (SSE is a Next.js concern), but uses `sessionService.getChatMessages` to read from storage. The SSE loop becomes simpler because storage access is abstracted.

## Acceptance Criteria

- [ ] `SessionService` exists with methods described above
- [ ] `ZoomClient` abstraction exists and is injected
- [ ] Session membership is enforced inside the service (SEC-03 behavior preserved)
- [ ] Legacy records without `studentEmail` fall back to tutor-only access
- [ ] `src/app/api/zoom/token/route.ts` is under 40 lines
- [ ] `src/app/api/internal/zoom-terminate/route.ts` is under 30 lines
- [ ] `src/app/api/chat-session/route.ts` POST is under 40 lines
- [ ] Chat message sender authorization moved to service (not in route)
- [ ] Unit tests: non-participant throws UnauthorizedError, tutor can always join, legacy record allows tutor and denies students
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual test: full session flow (join as student, join as tutor, attempt to join someone else's session → 403)
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **9. Video System Improvements**.

## Testing

```ts
describe("SessionService.issueJoinToken", () => {
  it("allows the tutor to join any session", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({ studentEmail: "student@example.com", /*...*/ });

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    const result = await service.issueJoinToken({
      eventId: "x", userEmail: "tutor@example.com", userName: "Tutor",
    });
    expect(result.token).toBeDefined();
  });

  it("rejects a different student trying to join", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({ studentEmail: "alice@example.com", /*...*/ });

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "x", userEmail: "bob@example.com", userName: "Bob",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("allows tutor on legacy records without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({ studentEmail: undefined, /*...*/ });

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    const result = await service.issueJoinToken({
      eventId: "x", userEmail: "tutor@example.com", userName: "Tutor",
    });
    expect(result.token).toBeDefined();
  });
});
```

## Out of Scope

- Adding concurrent-user limits per session (mentioned in PLAN.md §9.5 — defer to a post-refactor follow-up)
- Chat message persistence beyond 24h (Phase 4)
- Session history for the personal area (Phase 4)

## Rollback

Safe. Each route migration is independent — if one breaks, revert just that route. The service can be left in place (unused) during rollback. No data format changes.
