# Task 4.6 — Integration Test Suite

**Fix ID:** `TEST-01`
**Priority:** P3
**Est. effort:** 6 hours

## Problem

Existing Jest tests cover pure functions (`calendar.test.ts`, `kv.test.ts`, `validation.test.ts`) but no test exercises the interaction between services — the actual value the application delivers. Integration tests fill this gap.

Specifically, these flows have no automated coverage:

- Booking a pack session: decrements credits, creates calendar event, schedules cleanup, creates tokens, sends email
- Stripe webhook processing: single-session slot re-check, refund on conflict, dead-letter on failure
- Cancellation: token verification, calendar deletion, credit restoration, email
- Reschedule: old booking cancelled, new booking created atomically

Because Phase 3 put all these behind services with injected dependencies, integration tests can be written quickly and run fast (no HTTP mocking, no Next.js lifecycle).

## Scope

**Create:**
- `src/__tests__/integration/booking.test.ts`
- `src/__tests__/integration/payment.test.ts`
- `src/__tests__/integration/cancellation.test.ts`
- `src/__tests__/integration/reschedule.test.ts`
- `src/__tests__/fixtures/` — reusable mock builders
- `jest.config.js` — add integration project config

**Do not touch:**
- Existing unit tests
- Service implementations (unless a genuine bug is found — then raise a separate issue)

## Approach

### Step 1 — Fixture builders

```ts
// src/__tests__/fixtures/services.ts
/**
 * TEST-01 — Fixture builders for integration tests.
 *
 * These create service instances with in-memory or mock infrastructure,
 * so tests can exercise real business logic without hitting external systems.
 */
import { CreditService } from "@/services/CreditService";
import { BookingService } from "@/services/BookingService";
// ...

export function buildTestBookingService(overrides: Partial<BookingServiceDeps> = {}) {
  const defaults = {
    bookings:  new InMemoryBookingRepo(),
    sessions:  new InMemorySessionRepo(),
    credits:   buildTestCreditService(),
    calendar:  new FakeCalendarClient(),
    zoom:      new FakeZoomClient(),
    scheduler: new FakeScheduler(),
    email:     new FakeEmailClient(),
  };
  const deps = { ...defaults, ...overrides };
  return new BookingService(
    deps.bookings, deps.sessions, deps.credits, deps.calendar,
    deps.zoom, deps.scheduler, deps.email,
  );
}
```

### Step 2 — In-memory repositories

```ts
// src/__tests__/fixtures/InMemoryBookingRepo.ts
export class InMemoryBookingRepo implements IBookingRepository {
  private bookings = new Map<string, BookingRecord>();
  private joinTokens = new Map<string, { eventId: string; email: string }>();
  private cancelTokens = new Map<string, BookingRecord>();
  private locks = new Set<string>();

  async createBooking(record: Omit<BookingRecord, "used">) {
    const cancelToken = `ct-${Math.random().toString(36).slice(2)}`;
    const joinToken   = `jt-${Math.random().toString(36).slice(2)}`;
    const full = { ...record, used: false };
    this.bookings.set(record.eventId, full);
    this.cancelTokens.set(cancelToken, full);
    this.joinTokens.set(joinToken, { eventId: record.eventId, email: record.email });
    return { cancelToken, joinToken };
  }

  async findByCancelToken(token: string) { return this.cancelTokens.get(token) ?? null; }
  async findByJoinToken(token: string)   { return this.joinTokens.get(token) ?? null; }

  async consumeCancelToken(token: string) {
    const rec = this.cancelTokens.get(token);
    if (!rec) return false;
    this.cancelTokens.delete(token);
    return true;
  }

  async listByUser(email: string) {
    return Array.from(this.bookings.values())
      .filter(b => b.email.toLowerCase() === email.toLowerCase() && !b.used);
  }

  async acquireSlotLock(startIso: string) {
    if (this.locks.has(startIso)) return false;
    this.locks.add(startIso);
    return true;
  }
  async releaseSlotLock(startIso: string) { this.locks.delete(startIso); }
}
```

Similar in-memory versions for the other repos. Keep them minimal — faithful enough for testing, not production-ready.

### Step 3 — Fake external clients

```ts
// src/__tests__/fixtures/FakeCalendarClient.ts
export class FakeCalendarClient implements ICalendarClient {
  public createdEvents: Array<{ startIso: string; endIso: string }> = [];
  public shouldFail = false;
  public failTimes = 0; // for retry testing

  async createEvent(params: { ... }) {
    if (this.shouldFail && this.failTimes > 0) {
      this.failTimes--;
      throw new Error("calendar down");
    }
    const eventId = `evt-${this.createdEvents.length}`;
    this.createdEvents.push({ startIso: params.startIso, endIso: params.endIso });
    return { eventId, zoomSessionName: `zs-${eventId}`, zoomPasscode: "abc123" };
  }

  async deleteEvent(eventId: string) { /* ... */ }
  async getAvailableSlots(date: string) { return []; /* override in tests */ }
}
```

### Step 4 — Integration tests

```ts
// src/__tests__/integration/booking.test.ts
import { buildTestBookingService } from "../fixtures/services";
import { InsufficientCreditsError } from "@/domain/errors";

describe("Booking flow", () => {
  it("decrements credits and creates a calendar event for a pack booking", async () => {
    const credits = buildTestCreditService();
    await credits.addCredits({
      email: "alice@example.com", name: "Alice", amount: 5,
      packLabel: "Pack 5", stripeSessionId: "pi_1",
    });

    const calendar = new FakeCalendarClient();
    const email    = new FakeEmailClient();
    const service  = buildTestBookingService({ credits, calendar, email });

    const result = await service.createBooking({
      email: "alice@example.com", name: "Alice",
      startIso: futureIso(24), endIso: futureIso(25),
      sessionType: "pack",
    });

    expect(result.eventId).toBeDefined();
    expect(result.cancelToken).toBeDefined();
    expect(result.joinToken).toBeDefined();

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(4);

    expect(calendar.createdEvents).toHaveLength(1);
    expect(email.sent).toHaveLength(2); // confirmation + admin notification
  });

  it("restores credit when calendar creation fails", async () => {
    const credits = buildTestCreditService();
    await credits.addCredits({ ...params, amount: 1, stripeSessionId: "pi_2" });

    const calendar = new FakeCalendarClient();
    calendar.shouldFail = true;
    calendar.failTimes = 10; // all retries fail

    const service = buildTestBookingService({ credits, calendar });

    await expect(service.createBooking({ ...packBookingInput }))
      .rejects.toThrow();

    const balance = await credits.getBalance("alice@example.com");
    expect(balance?.credits).toBe(1); // restored
  });

  it("throws InsufficientCreditsError when no credits", async () => {
    const service = buildTestBookingService();
    await expect(service.createBooking({ ...packBookingInput, email: "nobody@example.com" }))
      .rejects.toThrow(InsufficientCreditsError);
  });

  it("handles concurrent bookings on single credit — exactly one succeeds", async () => {
    const credits = buildTestCreditService();
    await credits.addCredits({ ...params, amount: 1, stripeSessionId: "pi_3" });

    const service = buildTestBookingService({ credits });

    const results = await Promise.allSettled([
      service.createBooking({ ...packBookingInput }),
      service.createBooking({ ...packBookingInput, startIso: futureIso(25) }),
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const failures  = results.filter(r => r.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
  });

  it("consumes reschedule token and creates new booking atomically", async () => {
    // Setup: existing booking
    // Action: createBooking with rescheduleToken
    // Assert: old booking gone, new booking exists, credit count unchanged
  });
});
```

Similar test files for payment, cancellation, reschedule flows.

### Step 5 — Jest config

```js
// jest.config.js
module.exports = {
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts",
                  "!<rootDir>/src/__tests__/integration/**"],
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts"],
      // Integration tests may be slower
      testTimeout: 10_000,
    },
  ],
  // ... existing config
};

// package.json
{
  "scripts": {
    "test":             "jest",
    "test:unit":        "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration",
    "test:ci":          "jest --selectProjects unit integration",
  }
}
```

## Acceptance Criteria

- [ ] Four integration test files exist covering the flows listed
- [ ] Fixture builders exist for all services
- [ ] In-memory repositories exist for all interfaces
- [ ] Fake external clients exist for calendar, zoom, scheduler, email
- [ ] Each test flow has at least one "success" case and one "failure/compensating-action" case
- [ ] Concurrency test for credit decrement passes
- [ ] Reschedule atomicity test passes
- [ ] `npm run test:integration` exits 0
- [ ] `npm run test:ci` runs both suites and exits 0
- [ ] CI configured to run both suites on PR
- [ ] Fix-ID comments added to test files and fixtures

## Reference

See `docs/refactor/PLAN.md` → section **10. Testing Strategy**.

## Testing

The tests themselves are the deliverable. Verify by running the full suite and checking coverage:

```bash
npm run test:ci -- --coverage
```

Target ≥ 70% coverage on the services layer (BookingService, PaymentService, CreditService, SessionService).

## Out of Scope

- E2E tests with Playwright (Task 4.7)
- Tests against a real Stripe account (tests against Stripe CLI fixtures are fine)
- Load testing

## Rollback

Tests are additive. If a test is flaky or wrong, fix it or skip it with a TODO — never delete the test file wholesale.
