// ARCH-10/16: Domain types — shared across services, repository interfaces, and API contracts.
// These live here so the domain layer has no external dependencies.
// ARCH-16: API response types consolidated from src/types/index.ts.

export type PackSize = 5 | 10;

export type SessionType = "free15min" | "session1h" | "session2h" | "pack";

/** Products whose price is stored in the `pricing` table and is admin-editable. */
export type ProductKey = "session1h" | "session2h" | "pack5" | "pack10";

export interface PriceRecord {
  productKey:  ProductKey;
  amountCents: number;
  currency:    string;
  updatedAt:   string;
  updatedBy:   string | null;
}

// ─── Public pricing DTO (consumed by the mobile app via GET /api/pricing) ─────
// Numeric, serializable, no admin metadata (updatedBy/updatedAt). Clients format
// the currency on-device.

export interface PublicSessionPrice {
  productKey:  "session1h" | "session2h";
  amountCents: number;
  currency:    string;
}

export interface PublicPackPrice {
  productKey:          "pack5" | "pack10";
  amountCents:         number;
  currency:            string;
  hours:               number;
  perClassCents:       number;
  // Derived = 1h session price × hours, present only when it beats the pack price.
  originalAmountCents: number | null;
  savingsCents:        number | null;
  savingsPct:          number | null;
}

export interface PublicPricing {
  currency: string;
  sessions: PublicSessionPrice[];
  packs:    PublicPackPrice[];
}

export interface BookingRecord {
  eventId:          string;
  email:            string;
  name:             string;
  sessionType:      SessionType;
  startsAt:         string;
  endsAt:           string;
  used:             boolean;
  packSize?:        number;
  stripePaymentId?: string;
}

export interface ZoomSession {
  sessionId:        string;
  sessionName:      string;
  sessionPasscode:  string;
  studentEmail:     string;
  startIso:         string;
  durationMinutes:  number;
  sessionType:      SessionType;
  studentJoinedAt?: string | null;
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
  credits:     number;
  name:        string;
  packSize:    PackSize | null;
  hasBookings: boolean;
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

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionType = "courses" | "blog";

export interface SubscriptionRecord {
  id:        string;
  email:     string;
  type:      SubscriptionType;
  createdAt: string;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

/** Decision returned after a rating is captured: whether the post-class flow
 *  should show the Google-review CTA instead of the comment textarea. */
export interface ReviewDecision {
  showGoogleReview: boolean;
}

/** Per-user Google-review prompt gating state (one row per user). */
export interface GoogleReviewPromptState {
  shownCount:              number;
  skippedCount:            number;
  dismissed:               boolean;
  lastShownCompletedCount: number | null;
  acceptedAt:              string | null;
}
