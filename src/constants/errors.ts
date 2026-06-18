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
  INVALID_REQUEST:           "errors.validation.invalidRequest",
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
  INVALID_GOOGLE_TOKEN:      "errors.domain.invalidGoogleToken",
  EMAIL_NOT_VERIFIED:        "errors.domain.emailNotVerified",
};

/** Converts a SCREAMING_SNAKE_CASE error code to camelCase for i18n key lookup. */
export function camelCaseCode(code: string): string {
  return code.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Resolves an API error code to a translation key *relative to the `errors`
 * namespace* — for use with `useTranslations('errors')`. Known codes resolve via
 * ERROR_CODE_I18N_KEY (e.g. `domain.insufficientCredits`,
 * `validation.invalidRequest`); unknown/empty codes fall back to the HTTP-status
 * key (`http.<status>`, defaulting to 500). This keeps validation, domain, and
 * transport errors translated through a single boundary.
 */
export function errorCodeToKey(code: string | undefined, status: number): string {
  const full = code ? ERROR_CODE_I18N_KEY[code] : undefined;
  return full ? full.replace(/^errors\./, "") : `http.${status || 500}`;
}
