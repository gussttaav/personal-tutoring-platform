// ─── Domain types ─────────────────────────────────────────────────────────────

export type PackSize = 5 | 10;

export interface StudentInfo {
  email: string;
  name: string;
  credits: number;
}

export interface CreditResult {
  credits: number;
  name: string;
  /** Which pack size the credits belong to (5 or 10), or null if not determinable */
  packSize: PackSize | null;
  expiresAt?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

/**
 * Response from POST /api/book
 *
 * QUAL-03 fix: the previous definition had { ok: true; remaining: number }
 * which did not match what the route actually returns. The route returns
 * eventId, zoomSessionName, zoomPasscode, cancelToken, and emailFailed —
 * remaining is not included (the component does a separate /api/credits
 * fetch for that).
 */
export interface BookResponse {
  ok:              true;
  eventId:         string;
  zoomSessionName: string;
  zoomPasscode:    string;
  cancelToken:     string;
  emailFailed:     boolean;
}

export interface CreditsResponse {
  credits: number;
  name: string;
  /** Which pack size the credits belong to */
  packSize: PackSize | null;
}

export interface CheckoutResponse {
  url: string;
}

/** Response from POST /api/stripe/checkout in the embedded PaymentIntent flow */
export interface PaymentIntentResponse {
  clientSecret:    string;
  paymentIntentId: string;
}

// ─── Session shape ────────────────────────────────────────────────────────────

export interface UserSession {
  email: string;
  name: string;
  credits: number;
  /** Which pack size these credits belong to */
  packSize: PackSize | null;
  creditsConfirmedAt?: string;
}
