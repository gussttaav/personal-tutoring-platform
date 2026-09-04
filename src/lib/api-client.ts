/**
 * lib/api-client.ts — typed client for all server interactions
 *
 * ARCH-04 fix: book.post() previously had the wrong signature — it accepted
 * only an email string and sent { email } in the body, which the server
 * ignores (it reads identity from the auth session). All actual booking
 * fields (startIso, endIso, sessionType, etc.) were missing, so callers
 * in BookingModeView and SingleSessionBooking bypassed this entirely and
 * called fetch("/api/book", ...) directly, duplicating the fetch logic.
 *
 * book.post() now accepts the full BookInput shape (imported from the shared
 * schemas module) so callers can use the typed client consistently.
 *
 * QUAL-03 fix: BookResponse now reflects what /api/book actually returns
 * (eventId, zoomSessionName, zoomPasscode, cancelToken, emailFailed) — the old
 * definition had { ok: true; remaining: number } which was incorrect.
 */

import type { BookResponse, CreditsResponse, DeletionEligibility, PaymentIntentResponse } from "@/domain/types";
import type { BookInput, CheckoutInput } from "@/lib/schemas";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res  = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) {
    const code = typeof data.error === "string" ? data.error : "";
    throw new ApiError(code, res.status, code);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  credits: {
    get: () => request<CreditsResponse>("/api/credits"),
  },

  book: {
    /**
     * POST /api/book
     * Identity (email, name) is read server-side from the auth session —
     * only the booking payload needs to be sent from the client.
     */
    post: (body: BookInput) =>
      request<BookResponse>("/api/book", {
        method: "POST",
        body:   JSON.stringify(body),
      }),
  },

  locale: {
    /**
     * POST /api/locale
     * Persists a logged-in user's language choice to users.locale. Cookie is
     * already set by next-intl on switch; this keeps the DB in sync.
     */
    set: (locale: "es" | "en") =>
      request<{ ok: true }>("/api/locale", {
        method: "POST",
        body:   JSON.stringify({ locale }),
      }),
  },

  // ACCOUNT-DELETE-01
  account: {
    /**
     * GET /api/account — may this account be deleted, and if not, why?
     * Advisory: the DELETE re-checks server-side.
     */
    eligibility: () => request<DeletionEligibility>("/api/account"),

    /**
     * DELETE /api/account — IRREVERSIBLE. `confirmEmail` must be the signed-in
     * user's own address. On success the caller must sign out immediately: the
     * session cookie outlives the account and would recreate an empty user row.
     */
    delete: (confirmEmail: string) =>
      request<{ ok: true }>("/api/account", {
        method: "DELETE",
        body:   JSON.stringify({ confirmEmail }),
      }),
  },

  stripe: {
    /**
     * POST /api/stripe/checkout
     * Creates a PaymentIntent and returns clientSecret + paymentIntentId
     * for the embedded PaymentElement flow.
     */
    checkout: (body: CheckoutInput) =>
      request<PaymentIntentResponse>("/api/stripe/checkout", {
        method: "POST",
        body:   JSON.stringify(body),
      }),
  },
} as const;
