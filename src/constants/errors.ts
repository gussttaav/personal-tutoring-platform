/**
 * constants/errors.ts — error utilities for the presentation layer.
 *
 * UX-03: API errors surface as error codes; the presentation layer translates
 * them via useTranslations('errors.domain.*') or useTranslations('errors.http.*').
 */

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
