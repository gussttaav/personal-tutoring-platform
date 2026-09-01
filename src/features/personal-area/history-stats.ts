/**
 * Pure derivations over the /api/my-bookings/history payload.
 *
 * The three stat cards in the History tab (completed · average rating you gave ·
 * time with Gustavo) are computed here rather than served by an endpoint: every
 * input is already in `BookingHistoryEntry` (`status`, `startsAt`/`endsAt`,
 * `review.rating`), so an aggregate route would only re-derive what the client
 * already holds. The caller must page the endpoint to exhaustion first —
 * see usePersonalAreaData — or the totals describe only the loaded slice.
 *
 * Kept free of React and next-intl so it can be unit-tested directly (this repo
 * has no jsdom, so component-level tests are not an option).
 */

import type { BookingHistoryEntry } from "@/domain/types";
import { formatCurrency, formatDate } from "@/lib/formatting";

type Locale = "es" | "en";

export interface HistoryStats {
  /** Classes that actually happened. Excludes cancelled and no-show. */
  completed:     number;
  /** Mean of the ratings this student gave, or null when they have rated nothing. */
  averageRating: number | null;
  ratedCount:    number;
  /** Summed duration of completed classes. */
  totalMinutes:  number;
}

export function computeHistoryStats(entries: readonly BookingHistoryEntry[]): HistoryStats {
  let completed = 0;
  let totalMinutes = 0;
  let ratingSum = 0;
  let ratedCount = 0;

  for (const e of entries) {
    if (e.status === "completed") {
      completed += 1;
      const ms = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();
      // Guard against malformed rows: a negative or NaN span must not poison the sum.
      if (Number.isFinite(ms) && ms > 0) totalMinutes += ms / 60_000;
    }
    // A review can exist on any row that has one — the average describes what the
    // student rated, not which statuses we counted above.
    if (e.review) {
      ratingSum += e.review.rating;
      ratedCount += 1;
    }
  }

  return {
    completed,
    averageRating: ratedCount > 0 ? ratingSum / ratedCount : null,
    ratedCount,
    totalMinutes: Math.round(totalMinutes),
  };
}

// ─── Month grouping ───────────────────────────────────────────────────────────

export interface HistoryMonth {
  /** "2026-06" — stable React key, independent of the display language. */
  key:     string;
  /** "Junio 2026" / "June 2026" */
  label:   string;
  entries: BookingHistoryEntry[];
}

/**
 * Groups entries into months, preserving the endpoint's descending order both
 * between months and inside them. Keys are built from the calendar month in the
 * viewer's timezone so a class at 23:30 on the 31st does not jump months for
 * someone reading from a different offset than the label is rendered in.
 */
export function groupByMonth(
  entries: readonly BookingHistoryEntry[],
  locale: Locale,
  timeZone?: string,
): HistoryMonth[] {
  const months: HistoryMonth[] = [];
  const byKey = new Map<string, HistoryMonth>();

  for (const e of entries) {
    const d = new Date(e.startsAt);
    const key = monthKey(d, timeZone);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: formatDate(d, locale, {
          year:  "numeric",
          month: "long",
          day:   undefined,
          ...(timeZone ? { timeZone } : {}),
        }),
        entries: [],
      };
      byKey.set(key, bucket);
      months.push(bucket);
    }
    bucket.entries.push(e);
  }

  return months;
}

function monthKey(date: Date, timeZone?: string): string {
  // en-CA yields ISO-ordered "YYYY-MM-DD", which slices cleanly to a month key.
  const iso = new Intl.DateTimeFormat("en-CA", {
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
  return iso.slice(0, 7);
}

// ─── Payment label ────────────────────────────────────────────────────────────

/** The i18n keys `paymentLabel` can ask for, under `areaPersonal.history`. */
export type PaymentLabel =
  | { key: "payCreditRefunded" }
  | { key: "payCredit" }
  | { key: "payCard"; amount: string }
  | { key: "payFree" };

/**
 * What the student actually paid, as a translation instruction rather than a
 * string — the component owns the dictionary lookup.
 *
 * Order matters. A cancelled pack class had its credit restored
 * (BookingService.cancelByToken), so it reads "crédito devuelto", not "1 crédito".
 * `packSize` is the credit-vs-card discriminator: the history endpoint has no
 * explicit payment-method field, but only pack classes carry a pack size.
 */
export function paymentLabel(entry: BookingHistoryEntry, locale: Locale): PaymentLabel {
  const paidWithCredit = entry.packSize != null;

  if (paidWithCredit) {
    return entry.status === "cancelled"
      ? { key: "payCreditRefunded" }
      : { key: "payCredit" };
  }

  if (entry.amountCents != null) {
    return {
      key:    "payCard",
      amount: formatCurrency(entry.amountCents / 100, locale, entry.currency ?? "EUR"),
    };
  }

  return { key: "payFree" };
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Whether this past class can still be rated. */
export function canReview(entry: BookingHistoryEntry): boolean {
  // POST /api/reviews is keyed by eventId; rows with no calendar event (eventId "")
  // have nothing to key against, so they are permanently unratable.
  return entry.status === "completed" && entry.review === null && entry.eventId !== "";
}

/** Duration in whole minutes — used for the "· 1 h" suffix in list rows. */
export function durationMinutes(entry: BookingHistoryEntry): number {
  const ms = new Date(entry.endsAt).getTime() - new Date(entry.startsAt).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60_000) : 0;
}
