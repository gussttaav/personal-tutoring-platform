// ARCH-13: Maps DomainErrors to HTTP responses so route handlers stay thin.
// OBS-02: Unexpected (non-domain) errors are captured to Sentry before returning 500.
// REFACTOR-R4-P1-01: INVALID_SLOT (400) and FREE_SESSION_ALREADY_USED (409).
// OBS-03: Serialise non-Error thrown values (e.g. Supabase PostgrestError, a plain
// object with code/message/details/hint) so the log line carries the actual cause
// instead of "[object Object]".
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { DomainError } from "@/domain/errors";
import { log } from "@/lib/logger";

const HTTP_STATUS_MAP: Record<string, number> = {
  SLOT_UNAVAILABLE:           409,
  INVALID_SLOT:               400, // REFACTOR-R4-P1-01
  FREE_SESSION_ALREADY_USED:  409, // REFACTOR-R4-P1-01
  ALREADY_SUBSCRIBED:         409,
  INVALID_RESCHEDULE_TOKEN:   400,
  OUTSIDE_RESCHEDULE_WINDOW:  400,
  SESSION_TYPE_MISMATCH:      400,
  RESCHEDULE_TOKEN_CONSUMED:  400,
  REQUIRES_PAYMENT:           400,
  INSUFFICIENT_CREDITS:       400,
  INVALID_CANCEL_TOKEN:       400,
  OUTSIDE_CANCEL_WINDOW:      400,
  CANCEL_TOKEN_CONSUMED:      400,
  REVIEW_BOOKING_NOT_FOUND:   404,
  INVALID_CURSOR:             400, // BOOKING-HISTORY-01
  INVALID_GOOGLE_TOKEN:       401, // MOBILE-AUTH-01
  EMAIL_NOT_VERIFIED:         403, // MOBILE-AUTH-01
  // ACCOUNT-DELETE-01: the two block codes are 409 for the same reason as
  // SLOT_UNAVAILABLE -- the request is well-formed, the account state conflicts.
  DELETION_BLOCKED_ACTIVE_PACK:         409,
  DELETION_BLOCKED_CANCELLABLE_BOOKINGS: 409,
  DELETION_NOT_CONFIRMED:                400,
  USER_NOT_FOUND:                        404,
};

// OBS-03: Errors carry a message; Supabase's PostgrestError (a plain object,
// not an Error instance — @supabase/supabase-js 2.106) carries code/message
// plus optional details/hint instead. Anything else is stringified as-is.
function serializeUnexpectedError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }

  if (typeof err === "object" && err !== null && ("code" in err || "message" in err)) {
    const { code, message, details, hint } = err as Record<string, unknown>;
    let serialized = `${code ?? "UNKNOWN"}: ${message ?? "no message"}`;
    if (details) serialized += ` | details: ${details}`;
    if (hint) serialized += ` | hint: ${hint}`;
    return serialized;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function mapDomainErrorToResponse(
  err: unknown,
  context: Record<string, unknown> = {}
): NextResponse {
  if (err instanceof DomainError) {
    const status = HTTP_STATUS_MAP[err.code] ?? 400;
    return NextResponse.json({ error: err.code }, { status });
  }

  // Unexpected error — capture to Sentry with full context before returning 500
  Sentry.captureException(err, { extra: context });
  log("error", "Unhandled error in route handler", {
    ...context,
    error: serializeUnexpectedError(err),
  });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
