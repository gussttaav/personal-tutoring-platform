# Task 1.3 — Zoom Token Session-Membership Check

**Fix ID:** `SEC-03`
**Priority:** P0 — Critical
**Est. effort:** 2 hours

## Problem

`POST /api/zoom/token` in `src/app/api/zoom/token/route.ts` verifies the caller is authenticated but does **not** verify they are authorized to join the specific session. Any authenticated user who knows or guesses an `eventId` can:

1. Post `{ eventId }` to the endpoint
2. Receive a valid Zoom JWT signed with `role_type: 0` (participant)
3. Join another student's private class

Since `eventId` values are UUIDs embedded in URLs and emails, they are long but not secret. A malicious user who acquires one — via forwarded email, session page shared, or URL logs — can impersonate a student.

The current role check only distinguishes tutor vs participant (`session.user.email === TUTOR_EMAIL`). There is no check that the authenticated user is *the* student registered for the session.

## Scope

**Modify:**
- `src/lib/zoom.ts` — extend `ZoomSessionRecord` type
- `src/lib/calendar.ts` — populate the new field in `createCalendarEvent`
- `src/app/api/book/route.ts` — pass studentEmail through to calendar.ts
- `src/app/api/stripe/webhook/route.ts` — pass studentEmail through (two places: new handler + legacy handler)
- `src/app/api/zoom/token/route.ts` — enforce the membership check

**Do not touch:**
- The JWT generation logic in `zoom.ts` (`generateZoomJWT`)
- The session lifecycle or TTL logic

## Approach

### Step 1 — Extend `ZoomSessionRecord`

Add a required `studentEmail` field to the type in `src/lib/zoom.ts`:

```ts
export interface ZoomSessionRecord {
  sessionId:       string;
  sessionName:     string;
  sessionPasscode: string;
  startIso:        string;
  durationMinutes: number;
  sessionType:     string;
  studentEmail:    string;  // SEC-03
}
```

### Step 2 — Populate in `createCalendarEvent`

Update the function signature to accept `studentEmail` and include it in the `zoomRecord` object before `kv.set(\`zoom:session:${eventId}\`, ...)`.

### Step 3 — Pass through from callers

Three call sites call `createCalendarEvent`:
1. `src/app/api/book/route.ts`
2. `src/app/api/stripe/webhook/route.ts` — `handleSingleSessionPayment()`
3. `src/app/api/stripe/webhook/route.ts` — legacy `checkout.session.completed` branch

Each has the student email in scope already (from `session.user.email` or `metadata.student_email`). Pass it through.

### Step 4 — Enforce in token route

In `src/app/api/zoom/token/route.ts`, after looking up the `ZoomSessionRecord`:

```ts
const isTutor = session.user.email === process.env.TUTOR_EMAIL;
const isStudent = record.studentEmail.toLowerCase() === session.user.email.toLowerCase();

if (!isTutor && !isStudent) {
  log("warn", "Unauthorized Zoom token request", {
    service: "zoom",
    requester: session.user.email,
    eventId,
  });
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}
```

## Backward Compatibility

Existing `ZoomSessionRecord` entries in Redis **will not have** the `studentEmail` field. Handle this gracefully:

```ts
if (!record.studentEmail) {
  // Legacy record created before SEC-03 — allow tutor only
  if (!isTutor) {
    return NextResponse.json({ error: "Sesión heredada — contacta con soporte" }, { status: 403 });
  }
}
```

Legacy records TTL out within ~24h after the session ends, so this compatibility code can be removed in a follow-up PR after deployment + 48h.

## Acceptance Criteria

- [ ] `ZoomSessionRecord` type includes `studentEmail: string`
- [ ] `createCalendarEvent` accepts and stores `studentEmail`
- [ ] All three call sites pass the correct email
- [ ] `/api/zoom/token` returns `403` for non-tutor non-student callers
- [ ] `/api/zoom/token` logs unauthorized attempts with `log("warn", ...)`
- [ ] Backward-compat branch handles legacy records (tutor-only fallback)
- [ ] Existing tutor flow still works (tutor can join any session)
- [ ] Existing student flow still works (student can join their own session)
- [ ] Fix-ID comments added to all modified files
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **6. Security Fixes → Fix 3**.

## Testing

Manual verification matrix:

| Caller | Target session belongs to | Expected |
|---|---|---|
| Tutor | any student | 200 + JWT |
| Student A | Student A | 200 + JWT |
| Student A | Student B | 403 |
| Unauthenticated | any | 401 |

## Out of Scope

- Adding concurrent-user limits per session (see PLAN.md §9.5 — later task)
- Session persistence changes (Phase 4)
- Rate limiting adjustments

## Rollback

Moderate risk. If students report being unable to join their own sessions, likely causes:
1. Case mismatch — ensure both emails are lowercased on comparison
2. Legacy record with no `studentEmail` field and a non-tutor caller — the fallback branch should handle this

Revert is safe; no data migration is required (the new field is additive).
