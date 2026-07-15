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
  // BOOKING-PACKLINK-01: the credit pack this booking drew a credit from (pack
  // sessions only). Persisted to bookings.credit_pack_id; the join that surfaces
  // packSize in the my-bookings surfaces depends on it being set.
  creditPackId?:    string;
}

// Lifecycle of a booking row. Every booking is created 'confirmed'; the daily
// session-cleanup cron settles it to 'completed' (student joined the Zoom
// session) or 'no_show' (they didn't). 'cancelled' is set by the cancel flow.
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";

// BOOKING-HISTORY-01: one past booking, enriched for the history surface.
// `amountCents` is the price actually paid (derived from the payments row, not
// from the admin-editable `pricing` table, so past bookings stay accurate when
// prices change). It is null for free15min and for rows with no payment record.
export interface BookingHistoryEntry {
  id:          string;         // bookings.id — stable display reference
  eventId:     string;         // may be "" when no calendar event was created
  sessionType: SessionType;
  status:      BookingStatus;
  startsAt:    string;
  endsAt:      string;
  packSize?:   number;
  note:        string | null;
  amountCents: number | null;
  currency:    string | null;  // null whenever amountCents is null
  review:      { rating: number; comment: string | null } | null;
}

// Keyset page. `nextCursor` is an opaque "<startsAt>_<id>" token; null on the
// last page. The id is part of the key because bookings can share a startsAt —
// the no-overlap constraint only applies to 'confirmed' rows, so a cancelled
// booking and its replacement legitimately occupy the same slot.
export interface BookingHistoryPage {
  entries:    BookingHistoryEntry[];
  nextCursor: string | null;
}

// SINGLE-SESSION-CONFIRM-01: async-confirmation surface for single-session payments.
// Detail returned for a confirmed single-session booking (polling + broadcast payload).
export interface SingleSessionBookingDetail {
  eventId:     string;
  startIso:    string;
  endIso:      string;
  sessionType: SessionType;
  joinToken:   string;
}

// Terminal/transitional state of a single-session payment, keyed by PaymentIntent id.
export type SingleSessionStatus = "pending" | "confirmed" | "slot_taken" | "failed";

// Realtime broadcast payload (event: "resolved") emitted on the per-PaymentIntent
// channel. Discriminated by `status` so a single client handler is total.
export type SingleSessionResolved =
  | (SingleSessionBookingDetail & { status: "confirmed"; emailFailed: boolean })
  | { status: "slot_taken" }
  | { status: "failed" };

// Polling result for GET /api/payment-confirmation/channel (single-session branch).
// `booking` is present only when status === "confirmed".
export interface SingleSessionStatusResult {
  status:   SingleSessionStatus;
  booking?: SingleSessionBookingDetail;
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

// ─── Booking schedule (admin-editable) ────────────────────────────────────────
// Replaces the values that used to be hardcoded in src/lib/booking-config.ts.

/** A single working-hours block within a day, in minutes since midnight. */
export interface TimeBlock {
  startMinute: number;
  endMinute:   number;
}

/**
 * Working hours keyed by day-of-week (0=Sun..6=Sat). Each value is an ordered,
 * non-overlapping list of blocks. An empty array means a non-working day.
 */
export type WeeklyHours = Record<number, TimeBlock[]>;

/** The full booking schedule configuration consumed across server + client. */
export interface ScheduleConfig {
  weeklyHours:        WeeklyHours;
  timezone:           string;
  minNoticeHours:     number;
  /** How many weeks ahead bookings are allowed. Static for now (not editable). */
  bookingWindowWeeks: number;
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
