/**
 * constants/errors.ts — error utilities for the presentation layer.
 *
 * UX-03: Previously all API errors surfaced as the raw server message or a
 * generic "Error al reservar." string. Status-code-specific messages give
 * users actionable guidance instead of cryptic technical text.
 *
 * i18n note: friendlyError() is a transitional helper used while components
 * are migrated to useTranslations(). Once all callers use t('errors.http.*')
 * directly, this file can be reduced to ERROR_CODE_I18N_KEY + camelCaseCode.
 */

/** Maps HTTP status codes to Spanish user-facing messages (transitional). */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Los datos enviados no son válidos. Recarga la página e inténtalo de nuevo.",
  401: "Tu sesión ha caducado. Cierra sesión y vuelve a entrar.",
  403: "No tienes permiso para realizar esta acción.",
  409: "Este horario ya no está disponible. Por favor elige otro.",
  429: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
  500: "Error del servidor. Si el problema persiste, escribe a contacto@gustavoai.dev.",
  502: "Error al contactar con el servicio. Inténtalo de nuevo en unos segundos.",
};

/**
 * Returns a user-friendly Spanish error message.
 * Transitional: callers will migrate to t('errors.http.{status}') in Phase 3 sub-PRs B–D.
 *
 * @param status   HTTP status code from the failed response (pass 0 for network errors)
 * @param fallback Raw server value — used when no status-specific text exists
 */
export function friendlyError(status: number, fallback: string): string {
  return STATUS_MESSAGES[status] ?? fallback;
}

/**
 * Maps stable domain error codes (as returned by the API) to their i18n key
 * under the `errors.domain` namespace.
 * Usage: t(ERROR_CODE_I18N_KEY[code] ?? 'errors.domain.internalError')
 */
export const ERROR_CODE_I18N_KEY: Record<string, string> = {
  INSUFFICIENT_CREDITS:      "errors.domain.insufficientCredits",
  SLOT_UNAVAILABLE:          "errors.domain.slotUnavailable",
  BOOKING_NOT_FOUND:         "errors.domain.bookingNotFound",
  TOKEN_EXPIRED:             "errors.domain.tokenExpired",
  UNAUTHORIZED:              "errors.domain.unauthorized",
  ALREADY_SUBSCRIBED:        "errors.domain.alreadySubscribed",
  REVIEW_BOOKING_NOT_FOUND:  "errors.domain.reviewBookingNotFound",
  PERMANENT_WEBHOOK_ERROR:   "errors.domain.permanentWebhookError",
  INTERNAL_ERROR:            "errors.domain.internalError",
  INVALID_RESCHEDULE_TOKEN:  "errors.domain.invalidRescheduleToken",
  OUTSIDE_RESCHEDULE_WINDOW: "errors.domain.outsideRescheduleWindow",
  SESSION_TYPE_MISMATCH:     "errors.domain.sessionTypeMismatch",
  RESCHEDULE_TOKEN_CONSUMED: "errors.domain.rescheduleTokenConsumed",
  REQUIRES_PAYMENT:          "errors.domain.requiresPayment",
  INVALID_CANCEL_TOKEN:      "errors.domain.invalidCancelToken",
  OUTSIDE_CANCEL_WINDOW:     "errors.domain.outsideCancelWindow",
  CANCEL_TOKEN_CONSUMED:     "errors.domain.cancelTokenConsumed",
};

/** Converts a SCREAMING_SNAKE_CASE error code to camelCase for i18n key lookup. */
export function camelCaseCode(code: string): string {
  return code.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
