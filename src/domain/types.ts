// ARCH-10/16: Domain types — shared across services, repository interfaces, and API contracts.
// These live here so the domain layer has no external dependencies.
// ARCH-16: API response types consolidated from src/types/index.ts.

export type PackSize = 5 | 10;

export type SessionType = "free15min" | "session1h" | "session2h" | "pack";

export interface CreditRecord {
  email:           string;
  name:            string;
  credits:         number;
  packLabel:       string;
  packSize:        PackSize | null;
  expiresAt:       string;       // ISO
  lastUpdated:     string;       // ISO
  stripeSessionId: string;
}

export interface BookingRecord {
  eventId:      string;
  email:        string;
  name:         string;
  sessionType:  SessionType;
  startsAt:     string;
  endsAt:       string;
  used:         boolean;
  packSize?:    number;
}

export interface ZoomSession {
  sessionId:       string;
  sessionName:     string;
  sessionPasscode: string;
  studentEmail:    string;
  startIso:        string;
  durationMinutes: number;
  sessionType:     SessionType;
}

export interface AuditEntry {
  action: string;
  ts:     string;
  [key: string]: unknown;
}

export interface TimeSlot {
  start: string;
  end:   string;
  label: string;
}

// ─── API response types (consolidated from src/types/index.ts) ────────────────

export interface StudentInfo {
  email:   string;
  name:    string;
  credits: number;
}

export interface CreditResult {
  credits:    number;
  name:       string;
  packSize:   PackSize | null;
  expiresAt?: string;
}

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
  joinToken:       string;
  emailFailed:     boolean;
}

export interface CreditsResponse {
  credits:  number;
  name:     string;
  packSize: PackSize | null;
}

export interface CheckoutResponse {
  url: string;
}

export interface PaymentIntentResponse {
  clientSecret:    string;
  paymentIntentId: string;
}

export interface UserSession {
  email:                string;
  name:                 string;
  credits:              number;
  packSize:             PackSize | null;
  creditsConfirmedAt?:  string;
}
