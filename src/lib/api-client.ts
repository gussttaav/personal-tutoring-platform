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
 * (eventId, meetLink, cancelToken, emailFailed) — the old definition had
 * { ok: true; remaining: number } which was incorrect.
 */

import type { BookResponse, CheckoutResponse, CreditsResponse, PackSize } from "@/types";
import type { BookInput } from "@/lib/schemas";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res  = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? "Error desconocido", res.status);
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
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

  stripe: {
    checkoutPack: (params: { packSize: PackSize }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body:   JSON.stringify({ type: "pack", packSize: params.packSize }),
      }),

    checkoutSingleSession: (params: {
      duration:         "1h" | "2h";
      startIso:         string;
      endIso:           string;
      rescheduleToken?: string;
    }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body:   JSON.stringify({
          type:            "single",
          duration:        params.duration,
          startIso:        params.startIso,
          endIso:          params.endIso,
          rescheduleToken: params.rescheduleToken,
        }),
      }),
  },
} as const;
