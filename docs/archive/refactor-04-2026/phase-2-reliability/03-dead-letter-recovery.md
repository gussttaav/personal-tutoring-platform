# Task 2.3 — Dead-Letter Recovery Endpoint

**Fix ID:** `REL-03`
**Priority:** P2 — Medium
**Est. effort:** 2–3 hours

## Problem

The webhook handler writes failed bookings to Redis under `failed:booking:{stripeSessionId}` with a 30-day TTL when calendar event creation fails after all retries. An admin notification email is also sent. But there is **no way to recover** from these failures without manually:

1. Reading the Upstash console to find the failed entry
2. Manually creating the calendar event via Google Calendar UI
3. Manually sending the confirmation email
4. Manually issuing a refund if the class can't be scheduled

Students have paid but received nothing, and the tutor has no tooling to fix it.

This task adds two admin-only API endpoints: one to list failed bookings, one to retry them.

## Scope

**Create:**
- `src/lib/admin.ts` — helper for admin email check
- `src/app/api/admin/failed-bookings/route.ts` — GET (list), POST (retry)

**Modify:**
- `src/lib/startup-checks.ts` — add `ADMIN_EMAILS` required var

**Do not touch:**
- The existing `writeDeadLetter` function in the webhook — the format is kept stable
- Any UI — this task is API-only. The admin dashboard is Phase 4.

## Approach

### Step 1 — Admin auth helper

```ts
// src/lib/admin.ts
/**
 * REL-03 — Admin authorization check.
 *
 * Admin routes are guarded by comparing the authenticated user's email
 * against ADMIN_EMAILS (comma-separated list). This is sufficient for a
 * single-tutor platform; migrate to a proper role column when the database
 * lands (Phase 4).
 */
import type { Session } from "next-auth";

export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(session.user.email.toLowerCase());
}
```

### Step 2 — List endpoint (GET)

```ts
// src/app/api/admin/failed-bookings/route.ts
/**
 * REL-03 — Dead-letter recovery API.
 *
 * GET  — list all failed bookings in Redis
 * POST — retry a specific failed booking by stripeSessionId
 */
export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Scan Redis for failed:booking:* keys
  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch] = await kv.scan(cursor, { match: "failed:booking:*", count: 100 });
    keys.push(...batch);
    cursor = next;
  } while (cursor !== 0 && cursor !== "0");

  const entries = await Promise.all(
    keys.map(async (k) => {
      const record = await kv.get(k);
      return { key: k, record };
    })
  );

  return NextResponse.json({ entries });
}
```

### Step 3 — Retry endpoint (POST)

```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stripeSessionId } = await req.json().catch(() => ({}));
  if (!stripeSessionId || typeof stripeSessionId !== "string") {
    return NextResponse.json({ error: "stripeSessionId required" }, { status: 400 });
  }

  const key = `failed:booking:${stripeSessionId}`;
  const record = await kv.get<{
    email: string;
    startIso: string;
    stripeSessionId: string;
    failedAt: string;
    error: string;
  }>(key);

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The stored record does not contain the full input to recreate the booking.
  // We need to fetch the PaymentIntent from Stripe to retrieve metadata.
  const intent = await stripe.paymentIntents.retrieve(stripeSessionId);
  if (!intent) {
    return NextResponse.json({ error: "PaymentIntent not found" }, { status: 404 });
  }

  // Delegate to the same processing function used by the webhook
  // (exported from the webhook file for reuse, or extracted to a shared module)
  const result = await retrySingleSession({
    email:           intent.metadata.student_email ?? "",
    name:            intent.metadata.student_name ?? "",
    startIso:        intent.metadata.start_iso ?? "",
    endIso:          intent.metadata.end_iso ?? "",
    duration:        intent.metadata.session_duration ?? "1h",
    rescheduleToken: intent.metadata.reschedule_token || null,
    idempotencyKey:  stripeSessionId,
    refundTarget:    { type: "payment_intent", id: stripeSessionId },
  });

  if (result.ok) {
    await kv.del(key);  // Remove dead-letter entry on success
    return NextResponse.json({ ok: true, eventId: result.eventId });
  }

  return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
}
```

### Step 4 — Export the processing function

Task 2.2 consolidates single-session processing into one function. Export that function (or a wrapper) from the webhook module so this recovery endpoint can reuse it. If Task 2.2 is not yet merged, note in the PR that this depends on it.

Preferably, **do Task 2.2 first**, then this task can import `processSingleSession` directly.

### Step 5 — Add env var

```ts
// src/lib/startup-checks.ts
"ADMIN_EMAILS",   // comma-separated list of emails with admin access
```

For a single-tutor deployment, this is just `TUTOR_EMAIL`. The indirection allows adding more admins later without touching code.

## Acceptance Criteria

- [ ] `src/lib/admin.ts` exists with `isAdmin(session)` helper
- [ ] `GET /api/admin/failed-bookings` returns list of dead-letter entries for admins
- [ ] `GET /api/admin/failed-bookings` returns 403 for non-admins
- [ ] `GET /api/admin/failed-bookings` returns 401 for unauthenticated
- [ ] `POST /api/admin/failed-bookings` with `{ stripeSessionId }` retries the booking
- [ ] On successful retry, the dead-letter entry is deleted from Redis
- [ ] On failed retry, the dead-letter entry is preserved and error returned
- [ ] `ADMIN_EMAILS` is in `startup-checks.ts`
- [ ] Manual test: force a calendar failure → verify dead-letter entry appears in GET → retry via POST → verify calendar event is created and entry is cleared
- [ ] Fix-ID comments added
- [ ] `npm run build` passes

## Reference

See `docs/refactor/PLAN.md` → section **2. Refactor Plan → Phase 2: Dead-letter recovery** and section **11.2 Admin Dashboard**.

## Testing

Manual testing in preview:

1. Temporarily set `GOOGLE_CALENDAR_ID` to an invalid value
2. Trigger a test single-session payment via Stripe CLI
3. Webhook fails → dead-letter entry created → admin notification email sent
4. Restore `GOOGLE_CALENDAR_ID`
5. Call `GET /api/admin/failed-bookings` → see the entry
6. Call `POST /api/admin/failed-bookings` with the `stripeSessionId` → calendar event created, entry removed

Unit tests for `isAdmin` in `src/lib/__tests__/admin.test.ts`:

```ts
describe("isAdmin", () => {
  beforeEach(() => { process.env.ADMIN_EMAILS = "tutor@example.com,admin@example.com"; });
  it("accepts exact match", () => { /* ... */ });
  it("is case-insensitive", () => { /* ... */ });
  it("rejects non-listed emails", () => { /* ... */ });
  it("rejects when ADMIN_EMAILS is empty", () => { /* ... */ });
  it("rejects null session", () => { /* ... */ });
});
```

## Out of Scope

- Building the admin UI (Phase 4)
- Automated retry on a schedule (could be a follow-up: QStash job that retries dead-letter entries every hour)
- Richer filtering (date ranges, sorting) — add if needed later
- Bulk retry — `POST` takes one at a time for now

## Rollback

Safe. These are new endpoints; removing them affects no existing flow. If a retry causes issues (e.g., double-booking because the slot is now taken), fix the logic in `processSingleSession` to handle the re-check path (which it already does via the "Slot unavailable — refund issued" branch).
