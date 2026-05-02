// ARCH-13: Maps DomainErrors to HTTP responses so route handlers stay thin.
// OBS-02: Unexpected (non-domain) errors are captured to Sentry before returning 500.
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { DomainError } from "@/domain/errors";
import { log } from "@/lib/logger";

const HTTP_STATUS_MAP: Record<string, number> = {
  SLOT_UNAVAILABLE:           409,
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
};

export function mapDomainErrorToResponse(
  err: unknown,
  context: Record<string, unknown> = {}
): NextResponse {
  if (err instanceof DomainError) {
    const status = HTTP_STATUS_MAP[err.code] ?? 400;
    return NextResponse.json({ error: err.message }, { status });
  }

  // Unexpected error — capture to Sentry with full context before returning 500
  Sentry.captureException(err, { extra: context });
  log("error", "Unhandled error in route handler", {
    ...context,
    error: String(err),
  });
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
