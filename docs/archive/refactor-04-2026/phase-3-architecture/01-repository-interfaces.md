# Task 3.1 — Define Repository Interfaces

**Fix ID:** `ARCH-10`
**Priority:** P2
**Est. effort:** 2 hours

## Problem

Route handlers import `kv.ts` functions directly (`getCredits`, `decrementCredit`, `addOrUpdateStudent`, etc.). This coupling has two concrete costs:

1. **Untestable route handlers.** A unit test has to mock Upstash Redis itself, which means either patching module imports or running against a real Redis. Both are brittle.
2. **Hard database migration.** Swapping Redis for Supabase in Phase 4 requires finding every import of `kv.ts` and replacing it. With interfaces, we swap one line (which repository implementation is injected) and everything else stays the same.

This task defines interface contracts. It does **not** implement them — that's Task 3.2. It does **not** change any route handler — that's Tasks 3.3–3.6.

The goal is a **zero-behavior-change PR** that only adds new type files.

## Scope

**Create:**
- `src/domain/types.ts` — move shared types from `src/types/index.ts` here
- `src/domain/errors.ts` — domain error classes
- `src/domain/repositories/ICreditsRepository.ts`
- `src/domain/repositories/IBookingRepository.ts`
- `src/domain/repositories/ISessionRepository.ts`
- `src/domain/repositories/IPaymentRepository.ts`
- `src/domain/repositories/IAuditRepository.ts`

**Do not touch:**
- Any existing file. This task is purely additive.
- Any implementation file. Implementations come in 3.2.

## Approach

### Step 1 — Domain types

Create `src/domain/types.ts` with the types that services and repositories need. These mirror existing types but live in the domain layer so they have no external dependencies:

```ts
// src/domain/types.ts
export type PackSize = 5 | 10;

export type SessionType = "free15min" | "session1h" | "session2h" | "pack";

export interface CreditRecord {
  email:           string;
  name:            string;
  credits:         number;
  packLabel:       string;
  packSize:        PackSize | null;
  expiresAt:       string;       // ISO
  lastUpdated:     string;       // ISO
  stripeSessionId: string;
}

export interface BookingRecord {
  eventId:      string;
  email:        string;
  name:         string;
  sessionType:  SessionType;
  startsAt:     string;
  endsAt:       string;
  used:         boolean;
  packSize?:    number;
}

export interface ZoomSession {
  sessionId:       string;
  sessionName:     string;
  sessionPasscode: string;
  studentEmail:    string;
  startIso:        string;
  durationMinutes: number;
  sessionType:     SessionType;
}

export interface AuditEntry {
  action: string;
  ts:     string;
  [key: string]: unknown;
}
```

### Step 2 — Domain errors

Throwable types that services use to signal business-logic failures without leaking HTTP concerns:

```ts
// src/domain/errors.ts
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InsufficientCreditsError extends DomainError {
  constructor() { super("Sin créditos disponibles", "INSUFFICIENT_CREDITS"); }
}

export class SlotUnavailableError extends DomainError {
  constructor() { super("Este horario ya no está disponible", "SLOT_UNAVAILABLE"); }
}

export class BookingNotFoundError extends DomainError {
  constructor() { super("Reserva no encontrada", "BOOKING_NOT_FOUND"); }
}

export class TokenExpiredError extends DomainError {
  constructor() { super("El enlace ya no es válido", "TOKEN_EXPIRED"); }
}

export class UnauthorizedError extends DomainError {
  constructor() { super("No autorizado", "UNAUTHORIZED"); }
}
```

Route handlers map these to HTTP status codes:

```ts
// Example pattern (applied in later tasks)
try {
  return NextResponse.json(await service.doThing(...));
} catch (err) {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof SlotUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  // ... etc
}
```

### Step 3 — Repository interfaces

Each interface captures a coherent slice of data access:

```ts
// src/domain/repositories/ICreditsRepository.ts
import type { CreditRecord, PackSize } from "../types";

export interface CreditResult {
  credits:   number;
  name:      string;
  packSize:  PackSize | null;
  expiresAt?: string;
}

export interface ICreditsRepository {
  getCredits(email: string): Promise<CreditResult | null>;

  /**
   * Adds credits to the user's account. Idempotent by stripeSessionId —
   * calling twice with the same ID is a no-op.
   */
  addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void>;

  /**
   * Atomically decrements credit by 1. Returns ok=false if the user has no
   * credits, the pack is expired, or the user doesn't exist.
   */
  decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }>;

  /**
   * Restores one credit (after a cancellation). Will not exceed packSize.
   */
  restoreCredit(email: string): Promise<{ ok: boolean; credits: number }>;
}
```

```ts
// src/domain/repositories/IBookingRepository.ts
import type { BookingRecord } from "../types";

export interface IBookingRepository {
  /**
   * Stores a new booking and returns the tokens needed to join + cancel it.
   */
  createBooking(record: Omit<BookingRecord, "used">): Promise<{
    cancelToken: string;
    joinToken:   string;
  }>;

  /**
   * Looks up a booking by its cancel token. Returns null if not found,
   * expired, or already consumed.
   */
  findByCancelToken(token: string): Promise<BookingRecord | null>;

  /**
   * Looks up a booking by its join token.
   */
  findByJoinToken(token: string): Promise<{ eventId: string; email: string } | null>;

  /**
   * Marks a cancel token as consumed. Atomic — returns false if already
   * consumed by a concurrent caller.
   */
  consumeCancelToken(token: string): Promise<boolean>;

  /**
   * Returns all active bookings for a user, ordered by start time ascending.
   */
  listByUser(email: string): Promise<BookingRecord[]>;

  /**
   * Acquires an exclusive lock on a time slot. Returns false if already locked.
   */
  acquireSlotLock(startIso: string, durationMinutes: number): Promise<boolean>;

  /**
   * Releases a previously acquired slot lock.
   */
  releaseSlotLock(startIso: string): Promise<void>;
}
```

```ts
// src/domain/repositories/ISessionRepository.ts
import type { ZoomSession } from "../types";

export interface ISessionRepository {
  createSession(eventId: string, session: ZoomSession): Promise<void>;
  findByEventId(eventId: string): Promise<ZoomSession | null>;
  deleteByEventId(eventId: string): Promise<void>;

  /**
   * Session chat — used by the in-session chat feature.
   * Returns the new message count after append.
   */
  appendChatMessage(eventId: string, message: string): Promise<number>;
  listChatMessages(eventId: string, from: number, to: number): Promise<string[]>;
  countChatMessages(eventId: string): Promise<number>;
}
```

```ts
// src/domain/repositories/IPaymentRepository.ts
export interface FailedBookingEntry {
  stripeSessionId: string;
  email:           string;
  startIso:        string;
  failedAt:        string;
  error:           string;
}

export interface IPaymentRepository {
  /**
   * Idempotency marker. Returns true if already processed.
   */
  isProcessed(idempotencyKey: string): Promise<boolean>;
  markProcessed(idempotencyKey: string): Promise<void>;

  /**
   * Dead-letter pattern for failed bookings.
   */
  recordFailedBooking(entry: FailedBookingEntry): Promise<void>;
  listFailedBookings(): Promise<FailedBookingEntry[]>;
  clearFailedBooking(stripeSessionId: string): Promise<void>;
}
```

```ts
// src/domain/repositories/IAuditRepository.ts
import type { AuditEntry } from "../types";

export interface IAuditRepository {
  append(email: string, entry: Omit<AuditEntry, "ts">): Promise<void>;
  list(email: string, limit?: number): Promise<AuditEntry[]>;
}
```

## Acceptance Criteria

- [ ] `src/domain/types.ts` exists with all shared types
- [ ] `src/domain/errors.ts` exists with domain error classes
- [ ] All five repository interfaces exist under `src/domain/repositories/`
- [ ] Every interface method has a JSDoc comment explaining expected behavior, especially around atomicity, idempotency, and null-return cases
- [ ] No file outside `src/domain/` is modified
- [ ] No existing code is removed or changed
- [ ] `npm run build` passes (new files just add to the type graph)

## Reference

See `docs/refactor/PLAN.md` → section **3. Suggested Folder Structure** and **5. Migration Plan → Step 1: Repository Interfaces**.

## Testing

No tests in this task — interfaces have no behavior to test. Tests come in 3.2 (for implementations) and 3.3–3.6 (for services that use them via mocks).

## Out of Scope

- Moving `src/types/index.ts` content (do this in 3.7 — folder reorg)
- Deleting any existing code
- Implementing any interface
- Touching any service or route handler

## Rollback

Trivial. Delete the new `src/domain/` directory. Nothing else depends on it yet.
