# Task P2-05 — Zoom JWT lifetime matches session duration

**Severity:** 🟡 Medium
**Effort:** 1–2 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`generateZoomJWT` hardcodes `exp: iat + 3600` (1 hour). A 2-hour session's JWT expires mid-class. If the user reloads / re-attaches after the 1-hour mark, the re-issued token from `/api/zoom/token` may find the session record gone (if termination ran). Set JWT lifetime to match session duration + grace, capped at 4 hours.

## Context

### The current code

```typescript
// src/infrastructure/zoom/jwt.ts:4611
export function generateZoomJWT(params: {
  sessionName:     string;
  role:            0 | 1;
  userName:        string;
  sessionPasscode: string;
}): string {
  const iat = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      app_key:       ZOOM_KEY,
      version:       1,
      tpc:           params.sessionName,
      role_type:     params.role,
      user_identity: params.userName,
      session_key:   params.sessionPasscode,
      iat,
      exp:           iat + 3600,  // ← always 1 hour
    },
    ZOOM_SECRET,
    { algorithm: "HS256" }
  );
}
```

### Session durations from `getSessionDurationWithGrace`

| Type | Total minutes |
|------|---------------|
| `free15min` | 20 |
| `session1h` | 70 |
| `session2h` | **130** ← exceeds 60-min JWT |
| `pack` | 70 |

For 2-hour sessions, the JWT dies 10 minutes before the grace period ends.

### Why this matters now

You also issue `expiresAt: Math.floor(Date.now() / 1000) + 3600` from `SessionService.issueJoinToken` (line 5274) — the client uses this to decide when to re-request a token. Currently the client requests a new one before expiry; that re-request succeeds **only if the session record hasn't been terminated yet**. With session lifetime = JWT lifetime, the failure surface shrinks to zero.

Combined with [P1-04](../phase-1-correctness/04-qstash-error-propagation.md), this also makes the JWT lifetime the **enforcement mechanism** for session end (since the Video SDK has no server-side revoke).

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/zoom/jwt.ts` | `generateZoomJWT` accepts `durationSeconds`; cap at 4h |
| `src/infrastructure/zoom/ZoomClient.ts` | Update interface |
| `src/services/SessionService.ts` | Pass duration into `generateJWT`; align `expiresAt` |
| `src/__tests__/fixtures/FakeZoomClient.ts` | Accept new param |
| `src/services/__tests__/SessionService.test.ts` | Verify exp matches session duration |

## The change

### 1. `src/infrastructure/zoom/jwt.ts`

```typescript
// REFACTOR-P2-05: JWT lifetime now matches session duration + grace, capped
// at 4 hours. Previously hardcoded to 1 hour, which caused mid-session expiry
// for 2-hour bookings. The JWT lifetime is also our de facto enforcement of
// session end (the Video SDK has no server-side revoke — see REL-02 in
// ZoomRoomSession.tsx).

const MAX_JWT_LIFETIME_SEC = 4 * 3600;
const MIN_JWT_LIFETIME_SEC = 600;  // 10 min — covers cancel/reschedule grace

export function generateZoomJWT(params: {
  sessionName:     string;
  role:            0 | 1;
  userName:        string;
  sessionPasscode: string;
  durationSeconds: number;  // REFACTOR-P2-05
}): string {
  const iat = Math.floor(Date.now() / 1000);
  const lifetime = Math.max(
    MIN_JWT_LIFETIME_SEC,
    Math.min(MAX_JWT_LIFETIME_SEC, params.durationSeconds),
  );

  return jwt.sign(
    {
      app_key:       ZOOM_KEY,
      version:       1,
      tpc:           params.sessionName,
      role_type:     params.role,
      user_identity: params.userName,
      session_key:   params.sessionPasscode,
      iat,
      exp:           iat + lifetime,
    },
    ZOOM_SECRET,
    { algorithm: "HS256" }
  );
}
```

### 2. `src/infrastructure/zoom/ZoomClient.ts`

```typescript
export interface IZoomClient {
  generateSessionCredentials(params: { sessionName: string }): {
    sessionId: string;
    sessionName: string;
    sessionPasscode: string;
  };

  generateJWT(params: {
    sessionName:     string;
    role:            0 | 1;
    userName:        string;
    sessionPasscode: string;
    durationSeconds: number;  // REFACTOR-P2-05
  }): string;

  getDurationWithGrace(sessionType: string): number;
}
```

### 3. `src/services/SessionService.ts`

```typescript
async issueJoinToken(params: {
  eventId:   string;
  userEmail: string;
  userName:  string;
}): Promise<IssueJoinTokenResult> {
  const record = await this.sessions.findByEventId(params.eventId);
  if (!record) throw new BookingNotFoundError();

  // ── existing membership check ────────────────────────────────────────────
  const isTutor   = params.userEmail === this.tutorEmail;
  const isStudent = record.studentEmail
    ? record.studentEmail.toLowerCase() === params.userEmail.toLowerCase()
    : false;

  if (!record.studentEmail) {
    if (!isTutor) throw new UnauthorizedError();
  } else if (!isTutor && !isStudent) {
    log("warn", "Unauthorized Zoom token request", {
      service: "SessionService", requester: params.userEmail, eventId: params.eventId,
    });
    throw new UnauthorizedError();
  }

  // REFACTOR-P2-05: JWT lifetime = session-end-from-now + 30 min buffer,
  // capped at 4h by generateZoomJWT. This way the JWT can't outlive the
  // session by much, but is guaranteed to cover the whole class.
  const sessionEndMs = new Date(record.startIso).getTime()
    + this.zoom.getDurationWithGrace(record.sessionType) * 60_000;
  const secondsUntilEnd = Math.ceil((sessionEndMs - Date.now()) / 1000);
  const durationSeconds = Math.max(600, secondsUntilEnd + 1800);  // +30 min buffer

  const role: 0 | 1 = isTutor ? 1 : 0;
  const token = this.zoom.generateJWT({
    sessionName:     record.sessionName,
    role,
    userName:        params.userName,
    sessionPasscode: record.sessionPasscode,
    durationSeconds,
  });

  log("info", "Zoom token issued", {
    service: "SessionService", email: params.userEmail, eventId: params.eventId,
    role, lifetimeSec: durationSeconds,
  });

  return {
    token,
    sessionName:       record.sessionName,
    passcode:          record.sessionPasscode,
    startIso:          record.startIso,
    durationWithGrace: this.zoom.getDurationWithGrace(record.sessionType),
    expiresAt:         Math.floor(Date.now() / 1000) + durationSeconds,  // align with JWT
  };
}
```

### 4. `src/__tests__/fixtures/FakeZoomClient.ts`

Make sure `generateJWT` accepts `durationSeconds` and ideally returns it (or a struct including it) so tests can assert.

## Acceptance criteria

- [ ] `generateZoomJWT` accepts `durationSeconds`
- [ ] Lifetime is `min(4h, max(10min, durationSeconds))`
- [ ] `SessionService.issueJoinToken` computes lifetime from session end + 30-min buffer
- [ ] `result.expiresAt` matches the JWT's `exp` claim (within 1 second)
- [ ] For a 2h session issued at t=0, JWT exp ≥ 130 min from now
- [ ] For a re-issue near session end, lifetime is at least 10 minutes
- [ ] All existing tests pass with updated signatures

## Test plan

### Tests in `src/services/__tests__/SessionService.test.ts`

```typescript
import jwt from "jsonwebtoken";

describe("REFACTOR-P2-05: JWT lifetime", () => {
  it("issues a JWT that lives until session end + buffer for a 2h session", async () => {
    const services = buildTestServices();
    await seedZoomSession(services, {
      eventId: "evt",
      sessionType: "session2h",  // 130 min total
      startIso: new Date().toISOString(),
      studentEmail: "s@example.com",
    });

    const { token, expiresAt } = await services.sessionService.issueJoinToken({
      eventId: "evt",
      userEmail: "s@example.com",
      userName: "S",
    });

    const decoded = jwt.decode(token) as { exp: number };
    const nowSec = Math.floor(Date.now() / 1000);

    // At least 130 min (session) — 30 min buffer is on top
    expect(decoded.exp - nowSec).toBeGreaterThanOrEqual(130 * 60);
    expect(decoded.exp - nowSec).toBeLessThanOrEqual(4 * 3600);  // capped at 4h

    expect(Math.abs(decoded.exp - expiresAt)).toBeLessThanOrEqual(1);
  });

  it("clamps lifetime to 10 min minimum for re-issue near session end", async () => {
    const services = buildTestServices();
    // Session that ended 1 hour ago
    await seedZoomSession(services, {
      eventId: "evt",
      sessionType: "session1h",
      startIso: new Date(Date.now() - 2 * 3600_000).toISOString(),
      studentEmail: "s@example.com",
    });

    const { token } = await services.sessionService.issueJoinToken({
      eventId: "evt",
      userEmail: "s@example.com",
      userName: "S",
    });

    const decoded = jwt.decode(token) as { exp: number };
    const nowSec = Math.floor(Date.now() / 1000);
    expect(decoded.exp - nowSec).toBe(600);  // 10 min floor
  });
});
```

### Manual verification

```bash
# In the dashboard, book a 2h session
# Open DevTools → Application → Cookies → grab session
# Then:
curl -X POST https://gustavoai.dev/api/zoom/token \
  -H "Content-Type: application/json" \
  -H "Origin: https://gustavoai.dev" \
  -H "Cookie: $SESSION" \
  -d '{"eventId":"<your event id>"}' | jq

# In the response, decode the token:
echo "<token>" | cut -d. -f2 | base64 -d 2>/dev/null | jq

# exp - iat should be >= 130*60 = 7800 (and ≤ 14400 = 4h cap)
```

## Notes / gotchas

- **Zoom Video SDK respects the JWT exp.** When `exp` is reached the user is disconnected (or fails to (re)join). This becomes your hard-stop mechanism in lieu of a server-side revoke.
- **Re-issue near session end:** if a student rejoins 5 minutes before scheduled end, they get a 10-minute token (the floor) — covers the legitimate "I dropped, need to come back" case without permitting a 4h squatter.
- **Tutor's role doesn't change the lifetime** — both host and participant get the same JWT lifetime. Simpler, no leakage of role-specific timings.
- **Don't reuse old tokens.** Every `POST /api/zoom/token` mints a fresh JWT. If you want to limit concurrent tokens per user, add a counter — out of scope here.

## Out of scope

- Token revocation list. The Video SDK doesn't support it natively, and JWTs short enough that revocation buys little.
- Per-role JWT lifetime (tutor longer, student shorter). YAGNI.
- Detecting clock skew between server and client. Standard JWT tooling handles this.
