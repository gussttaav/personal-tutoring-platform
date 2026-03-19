/**
 * Typed API client for all server interactions.
 */

import type { BookResponse, CheckoutResponse, CreditsResponse, PackSize } from "@/types";

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
    post: (email: string) =>
      request<BookResponse>("/api/book", {
        method: "POST",
        body:   JSON.stringify({ email }),
      }),
  },

  stripe: {
    checkoutPack: (params: { packSize: PackSize }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body:   JSON.stringify({ type: "pack", packSize: params.packSize }),
      }),

    checkoutSingleSession: (params: {
      duration: "1h" | "2h";
      startIso: string;
      endIso:   string;
    }) =>
      request<CheckoutResponse>("/api/stripe/checkout", {
        method: "POST",
        body:   JSON.stringify({
          type:     "single",
          duration: params.duration,
          startIso: params.startIso,
          endIso:   params.endIso,
        }),
      }),
  },
} as const;
