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

// BOOKING-HISTORY-01: the pagination cursor was not a well-formed
// "<startsAt>_<id>" token. Rejected rather than ignored — silently falling back
// to the first page would make a paging client loop forever. Mapped to 400.
export class InvalidCursorError extends DomainError {
  constructor() { super("Malformed pagination cursor", "INVALID_CURSOR"); }
}

// MOBILE-AUTH-01: The supplied Google ID token failed verification — bad
// signature, wrong/missing audience, expired, malformed, or the verifier could
// not be configured (fail-closed). Mapped to 401.
export class InvalidGoogleTokenError extends DomainError {
  constructor() { super("Invalid Google ID token", "INVALID_GOOGLE_TOKEN"); }
}

// MOBILE-AUTH-01: The Google account's email is not verified — we refuse to
// mint a session for an unverified email to prevent account takeover. Mapped to 403.
export class EmailNotVerifiedError extends DomainError {
  constructor() { super("Google email is not verified", "EMAIL_NOT_VERIFIED"); }
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

// ACCOUNT-DELETE-01: The account still holds redeemable credits in a non-expired
// pack, so self-service deletion is refused -- erasing the account would silently
// burn classes the student already paid for. Also raised when every upcoming class
// the student can still cancel is a pack class: cancelling those returns the
// credits to the pack, landing in this same state, so we send them straight to the
// refund-by-email path instead of down a dead end. Mapped to 409.
export class AccountDeletionBlockedByPackError extends DomainError {
  constructor() { super("Account has active pack credits", "DELETION_BLOCKED_ACTIVE_PACK"); }
}

// ACCOUNT-DELETE-01: The account has upcoming classes the student can still cancel
// himself (outside the cancellation window). He must cancel them first -- that way
// any refund follows the normal cancellation policy instead of being forfeited by
// the deletion. Mapped to 409.
export class AccountDeletionBlockedByBookingsError extends DomainError {
  constructor() { super("Account has cancellable upcoming bookings", "DELETION_BLOCKED_CANCELLABLE_BOOKINGS"); }
}

// ACCOUNT-DELETE-01: The caller did not echo back its own email address. The
// confirmation is what separates an accidental request from a deliberate one on an
// irreversible endpoint. Mapped to 400.
export class DeletionNotConfirmedError extends DomainError {
  constructor() { super("Deletion confirmation does not match the account email", "DELETION_NOT_CONFIRMED"); }
}

// ACCOUNT-DELETE-01: A valid credential resolved to an email with no users row.
// Reachable because both the session cookie and the mobile bearer are stateless --
// see the credential note in src/app/api/account/route.ts. Mapped to 404.
export class UserNotFoundError extends DomainError {
  constructor() { super("User not found", "USER_NOT_FOUND"); }
}
