// BOOKING-HISTORY-01: pure helpers for the booking-history read.
//
// These live outside SupabaseBookingRepository because they carry the two pieces
// of logic most likely to be got wrong — keyset cursor encoding and the "what did
// this class actually cost" derivation — and keeping them free of Supabase means
// they can be unit-tested without a live database (the repository's own tests are
// integration tests, gated on NEXT_PUBLIC_SUPABASE_URL, and skip without one).

import { InvalidCursorError } from "@/domain/errors";
import type { SessionType } from "@/domain/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PackInfo    { packSize: number; stripePaymentId: string }
export interface PaymentInfo { amountCents: number; currency: string }

/**
 * The cursor is "<startsAt ISO>_<booking uuid>".
 *
 * The id is part of the key, not decoration: the no-overlap exclusion constraint
 * is scoped `WHERE (status = 'confirmed')`, so a cancelled booking and the
 * confirmed booking that replaced it legitimately share a `starts_at`. Keying on
 * `starts_at` alone would skip rows at the page boundary.
 *
 * Splits on the LAST underscore — an ISO-8601 timestamp contains none, so this
 * stays correct even if the format ever gains one.
 */
export function parseCursor(cursor: string): { startsAt: string; id: string } {
  const sep = cursor.lastIndexOf("_");
  if (sep <= 0) throw new InvalidCursorError();

  const startsAt = cursor.slice(0, sep);
  const id       = cursor.slice(sep + 1);

  if (!UUID.test(id) || Number.isNaN(Date.parse(startsAt))) throw new InvalidCursorError();

  return { startsAt: new Date(startsAt).toISOString(), id };
}

export function buildCursor(startsAt: string, id: string): string {
  return `${new Date(startsAt).toISOString()}_${id}`;
}

/**
 * What the student actually paid for this one class.
 *
 * Derived from the recorded payment, never from the `pricing` table: prices are
 * admin-editable, so reading today's price would retroactively rewrite the cost
 * of a class bought months ago at a different rate.
 *
 *  - `free15min`            → null (never charged)
 *  - `pack`                 → the pack's charge divided across its credits
 *  - `session1h`/`session2h`→ the booking's own charge
 *
 * Returns nulls rather than throwing when no payment row exists — legacy bookings
 * predate the payments table, and a missing receipt must not break the history list.
 */
export function deriveAmount(
  sessionType:            SessionType,
  pack:                   PackInfo | undefined,
  bookingStripePaymentId: string | null,
  payments:               Map<string, PaymentInfo>,
): { amountCents: number | null; currency: string | null } {
  const none = { amountCents: null, currency: null };

  if (sessionType === "free15min") return none;

  if (sessionType === "pack") {
    if (!pack || pack.packSize <= 0) return none;
    const pay = payments.get(pack.stripePaymentId);
    if (!pay) return none;
    return { amountCents: Math.round(pay.amountCents / pack.packSize), currency: pay.currency };
  }

  if (!bookingStripePaymentId) return none;
  const pay = payments.get(bookingStripePaymentId);
  if (!pay) return none;

  return { amountCents: pay.amountCents, currency: pay.currency };
}
