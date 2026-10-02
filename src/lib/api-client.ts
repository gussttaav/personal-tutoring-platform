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
 *
 * BOOKING-ATTRIBUTION-01: book.post() and the single-session checkout attach the
 * browser's stored first-touch source (src/lib/attribution.ts), so no call site has to.
 */

import type { BookResponse, CreditsResponse, DeletionEligibility, PaymentIntentResponse, PublicPricing } from "@/domain/types";
import type { BookInput, CheckoutInput, ContentReportInput, ContentVoteInput } from "@/lib/schemas";
import { readStoredAttribution } from "@/lib/attribution";

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

  pricing: {
    /**
     * GET /api/pricing — the signed-in student's prices.
     *
     * PRICING-STUDENT-01: identical to the public prices unless this student has
     * an override, in which case `hasCustomPricing` is true and the amounts are
     * theirs. Identity comes from the session; there is nothing to pass.
     */
    get: () => request<PublicPricing & { hasCustomPricing: boolean }>("/api/pricing"),
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
        body:   JSON.stringify({ attribution: readStoredAttribution(), ...body }),
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

  // CONTENT-FEEDBACK-01: reader feedback on lessons and posts. Both routes always
  // answer JSON (never 204), so the shared `request` helper is safe here.
  content: {
    /** POST /api/content/vote — upserts this browser's/account's 👍/👎 (+ comment). */
    vote: (body: ContentVoteInput) =>
      request<{ ok: true }>("/api/content/vote", {
        method: "POST",
        body:   JSON.stringify(body),
      }),

    /** POST /api/content/report — files an error report on the page. */
    report: (body: ContentReportInput) =>
      request<{ ok: true }>("/api/content/report", {
        method: "POST",
        body:   JSON.stringify(body),
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
        body:   JSON.stringify(
          body.type === "single" ? { attribution: readStoredAttribution(), ...body } : body,
        ),
      }),
  },
} as const;
