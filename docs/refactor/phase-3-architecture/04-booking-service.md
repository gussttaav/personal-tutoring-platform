# Task 3.4 — Extract `BookingService`

**Fix ID:** `ARCH-13`
**Priority:** P2
**Est. effort:** 6 hours

## Problem

`/api/book/route.ts` is 200+ lines containing: auth check, schema validation, reschedule token handling, slot availability re-check, credit decrement, calendar event creation, Zoom session scheduling, cancellation token creation, email sending with retry, dead-letter on failure. This is business orchestration masquerading as a route handler.

This task extracts all of it into `BookingService`. The route handler becomes a parser + dispatcher.

## Scope

**Create:**
- `src/services/BookingService.ts`
- `src/services/__tests__/BookingService.test.ts`

**Modify:**
- `src/app/api/book/route.ts` — thin handler calling the service
- `src/app/api/cancel/route.ts` — call `bookingService.cancel(...)` instead of inline logic
- `src/app/api/my-bookings/route.ts` — call `bookingService.listForUser(...)`
- `src/services/index.ts` — add singleton

**Do not touch:**
- `src/app/api/stripe/webhook/route.ts` — that's Task 3.5 (`PaymentService`)
- Email module

## Approach

### Service surface

```ts
// src/services/BookingService.ts
export class BookingService {
  constructor(
    private readonly bookings: IBookingRepository,
    private readonly sessions: ISessionRepository,
    private readonly credits:  CreditService,
    private readonly calendar: CalendarClient,        // Google Calendar adapter
    private readonly zoom:     ZoomClient,            // Zoom credentials generator
    private readonly scheduler: IScheduler,           // QStash (REL-01)
    private readonly email:    EmailClient,
  ) {}

  /**
   * Create a booking. Handles:
   *  - Pack credit decrement (if sessionType === "pack")
   *  - Reschedule token consumption (if provided)
   *  - Min-notice guard
   *  - Calendar event creation with retry
   *  - Zoom session record
   *  - QStash-scheduled Zoom cleanup
   *  - Token generation (cancel + join)
   *  - Confirmation + notification emails
   */
  async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput>;

  /**
   * Cancel a booking by cancel token. Handles:
   *  - Token verification + atomic consumption
   *  - 2-hour-before-start window check
   *  - Calendar event deletion (best-effort)
   *  - Credit restoration (if pack session)
   *  - Cancellation confirmation + notification emails
   */
  async cancelByToken(token: string): Promise<CancelByTokenOutput>;

  /**
   * List active bookings for a user. Filters out expired/consumed tokens.
   */
  async listForUser(email: string): Promise<UserBooking[]>;

  /**
   * Look up a booking by join token for the session page. Returns only
   * the fields the client needs — no cancel token leaked.
   */
  async getJoinInfo(token: string): Promise<{ eventId: string; email: string } | null>;
}
```

### Key abstractions to introduce

Two new thin abstractions over existing code:

1. **`CalendarClient`** — interface for `createCalendarEvent`, `deleteCalendarEvent`, `getAvailableSlots`. Implementation wraps `src/lib/calendar.ts`.
2. **`ZoomClient`** — interface for `generateZoomSessionCredentials`, `generateZoomJWT`, `getSessionDurationWithGrace`. Implementation wraps `src/lib/zoom.ts`.
3. **`IScheduler`** — interface with `scheduleAt(url, body, delaySeconds)`. Implementation wraps QStash.
4. **`EmailClient`** — interface for `sendConfirmation`, `sendCancellation`, `sendNotification`, `sendAdminFailure`. Implementation wraps `src/lib/email.ts`.

Put these in `src/infrastructure/{google,zoom,qstash,resend}/` following the pattern from Task 3.2.

### Input/output types

```ts
// src/services/BookingService.ts

export interface CreateBookingInput {
  email:           string;
  name:            string;
  startIso:        string;
  endIso:          string;
  sessionType:     SessionType;
  note?:           string;
  timezone?:       string;
  rescheduleToken?: string;
}

export interface CreateBookingOutput {
  eventId:          string;
  zoomSessionName:  string;
  zoomPasscode:     string;
  cancelToken:      string;
  joinToken:        string;
  emailFailed:      boolean;
}

export interface CancelByTokenOutput {
  sessionLabel:    string;
  startIso:        string;
  creditsRestored: boolean;
}
```

### Orchestration sketch

```ts
async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
  // 1. Min-notice guard
  this.assertWithinBookingWindow(input.startIso);

  // 2. Reschedule flow (if applicable)
  let consumedReschedule = false;
  if (input.rescheduleToken) {
    consumedReschedule = await this.consumeReschedule(input);
  } else if (input.sessionType === "session1h" || input.sessionType === "session2h") {
    throw new DomainError("Las sesiones individuales requieren pago previo.", "REQUIRES_PAYMENT");
  }

  // 3. Credit decrement (if pack)
  let packSize: number | undefined;
  if (input.sessionType === "pack") {
    await this.credits.useCredit(input.email);
    const balance = await this.credits.getBalance(input.email);
    packSize = balance?.packSize ?? undefined;
  }

  // 4. Calendar event + Zoom session
  let eventId: string;
  let zoomSessionName: string;
  let zoomPasscode: string;
  try {
    const created = await this.calendar.createEvent({ /* ... */ });
    eventId         = created.eventId;
    zoomSessionName = created.zoomSessionName;
    zoomPasscode    = created.zoomPasscode;
  } catch (err) {
    // Compensating actions
    if (input.sessionType === "pack") await this.credits.restoreCredit(input.email);
    if (consumedReschedule) await this.recordRescheduleFailure(input, err);
    throw err;
  }

  // 5. Schedule Zoom cleanup via QStash
  await this.scheduler.scheduleAt({
    url: `${BASE_URL}/api/internal/zoom-terminate`,
    body: { eventId },
    delaySeconds: this.zoom.getDurationWithGrace(input.sessionType) * 60,
  });

  // 6. Booking tokens
  const { cancelToken, joinToken } = await this.bookings.createBooking({
    eventId, email: input.email, name: input.name, sessionType: input.sessionType,
    startsAt: input.startIso, endsAt: input.endIso,
    ...(packSize !== undefined ? { packSize } : {}),
  });

  // 7. Emails (retry inside service)
  const emailSent = await this.sendConfirmationEmails({ /* ... */ });

  return {
    eventId, zoomSessionName, zoomPasscode, cancelToken, joinToken,
    emailFailed: !emailSent,
  };
}
```

### Route handler becomes tiny

```ts
// src/app/api/book/route.ts
export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });

  const parsed = BookSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });

  try {
    const result = await bookingService.createBooking({
      email:           session.user.email,
      name:            session.user.name ?? session.user.email,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapDomainErrorToResponse(err);
  }
}
```

`mapDomainErrorToResponse` is a helper that turns domain errors into HTTP responses — add it to `src/lib/http-errors.ts`.

## Acceptance Criteria

- [ ] `BookingService` exists with methods described above
- [ ] All dependencies injected via constructor
- [ ] Compensating actions on failure (credit restore, reschedule rollback) happen inside the service, not in the route handler
- [ ] `src/app/api/book/route.ts` is under 40 lines
- [ ] `src/app/api/cancel/route.ts` is under 40 lines
- [ ] `src/app/api/my-bookings/route.ts` is under 30 lines
- [ ] Unit tests cover: credit decrement on pack booking, calendar failure triggers credit restore, reschedule flow consumes token atomically, missing credits throws correct error
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual test: full booking + cancel + reschedule flow works as before
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **3. Suggested Folder Structure** and the current `/api/book/route.ts` for what needs to be extracted.

## Testing

Focus on the orchestration logic — that's where bugs hide.

```ts
describe("BookingService.createBooking", () => {
  it("restores credit when calendar event creation fails", async () => {
    const credits = mockCreditService();
    const calendar = mockCalendar();
    calendar.createEvent.mockRejectedValue(new Error("calendar down"));

    const service = new BookingService(
      mockBookings(), mockSessions(), credits, calendar,
      mockZoom(), mockScheduler(), mockEmail()
    );

    await expect(service.createBooking({ ...packInput }))
      .rejects.toThrow("calendar down");

    expect(credits.useCredit).toHaveBeenCalled();
    expect(credits.restoreCredit).toHaveBeenCalled();
  });

  it("does not decrement credits for free sessions", async () => {
    const credits = mockCreditService();
    // ...
    await service.createBooking({ ...freeInput });
    expect(credits.useCredit).not.toHaveBeenCalled();
  });
});
```

Aim for 10+ tests here — this is the heart of the application.

## Out of Scope

- Webhook consolidation (Task 3.5)
- Zoom lifecycle (Task 3.6)
- Database migration (Phase 4)

## Rollback

Each route handler can be reverted independently. Biggest risk is the compensating-action logic — if a bug is introduced where credits aren't restored on failure, it must be caught in testing. The unit tests above cover the critical paths.
