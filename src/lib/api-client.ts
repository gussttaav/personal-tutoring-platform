/**
 * Typed API client for all server interactions.
 * Cookies (including the NextAuth session cookie) are sent automatically
 * with every fetch — no manual Authorization header needed.
 */

import type {
  BookResponse,
  CheckoutResponse,
  CreditsResponse,
  PackSize,
} from "@/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error ?? "Error desconocido", res.status);
  }

  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const api = {
  credits: {
    get: () => request<CreditsResponse>('/api/credits'),
  },

  book: {
    post: (email: string) =>
      request<BookResponse>("/api/book", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  },

  stripe: {
    /** Purchase a pack of 5 or 10 classes */
    checkoutPack: (params: { packSize: PackSize }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ type: "pack", packSize: params.packSize }),
      }),

    /** Pay for a single 1h or 2h session */
    checkoutSingleSession: (params: { duration: "1h" | "2h" }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ type: "single", duration: params.duration }),
      }),
  },
} as const;
