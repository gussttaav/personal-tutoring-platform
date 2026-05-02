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
