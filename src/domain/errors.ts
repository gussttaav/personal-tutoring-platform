// ARCH-10: Domain error classes — thrown by services, mapped to HTTP status codes
// by route handlers. Keeps business logic free of HTTP concerns.

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

export class AlreadySubscribedError extends DomainError {
  constructor() { super("Ya estás suscrito a este contenido", "ALREADY_SUBSCRIBED"); }
}

export class ReviewBookingNotFoundError extends DomainError {
  constructor() { super("No se encontró la clase a valorar", "REVIEW_BOOKING_NOT_FOUND"); }
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
