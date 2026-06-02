// ARCH-10: Domain error classes — thrown by services, mapped to HTTP status codes
// by route handlers. Keeps business logic free of HTTP concerns.

export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InsufficientCreditsError extends DomainError {
  constructor() { super("No credits available", "INSUFFICIENT_CREDITS"); }
}

export class SlotUnavailableError extends DomainError {
  constructor() { super("Slot no longer available", "SLOT_UNAVAILABLE"); }
}

export class BookingNotFoundError extends DomainError {
  constructor() { super("Booking not found", "BOOKING_NOT_FOUND"); }
}

export class TokenExpiredError extends DomainError {
  constructor() { super("Link is no longer valid", "TOKEN_EXPIRED"); }
}

export class UnauthorizedError extends DomainError {
  constructor() { super("Unauthorized", "UNAUTHORIZED"); }
}

export class AlreadySubscribedError extends DomainError {
  constructor() { super("Already subscribed to this content", "ALREADY_SUBSCRIBED"); }
}

export class ReviewBookingNotFoundError extends DomainError {
  constructor() { super("Review booking not found", "REVIEW_BOOKING_NOT_FOUND"); }
}

// REFACTOR-P1-02: Distinguish webhook failures that should be retried by Stripe
// from those that are permanent (malformed data we can never process). Permanent
// errors return 200 so Stripe stops retrying; retryable ones return 500 so Stripe
// keeps trying for up to 3 days.
export class PermanentWebhookError extends DomainError {
  constructor(reason: string) {
    super(`Permanent webhook failure: ${reason}`, "PERMANENT_WEBHOOK_ERROR");
  }
}
