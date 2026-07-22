/**
 * lib/schemas.ts — all domain Zod schemas in one place
 *
 * ARCH-03: BookSchema was defined inside src/app/api/book/route.ts and the
 * checkout schemas inside src/app/api/stripe/checkout/route.ts. Keeping
 * validation schemas inside route handler files has two problems:
 *
 *   1. They cannot be imported by the typed API client (src/lib/api-client.ts)
 *      without creating an import from lib/ → app/, which breaks the
 *      conventional dependency direction.
 *   2. They cannot be reused for client-side validation or in tests without
 *      pulling in Next.js server-only code.
 *
 * Moving them here lets api-client.ts, route handlers, and tests all share
 * the same schema definitions and inferred types.
 */

import { z } from "zod";
import { SUPPORTED_TIMEZONES } from "@/lib/timezones";

// ─── Booking ──────────────────────────────────────────────────────────────────

export const BookSchema = z.object({
  startIso:        z.string().datetime(),
  endIso:          z.string().datetime(),
  sessionType:     z.enum(["free15min", "session1h", "session2h", "pack"]),
  note:            z.string().max(1000).optional(),
  timezone:        z.string().optional(),
  rescheduleToken: z.string().optional(),
});

export type BookInput = z.infer<typeof BookSchema>;

// ─── Stripe checkout ──────────────────────────────────────────────────────────

export const PackCheckoutSchema = z.object({
  type:     z.literal("pack"),
  packSize: z.union([z.literal(5), z.literal(10)]),
});

export const SingleCheckoutSchema = z.object({
  type:            z.literal("single"),
  duration:        z.enum(["1h", "2h"]),
  startIso:        z.string().datetime(),
  endIso:          z.string().datetime(),
  rescheduleToken: z.string().optional(),
});

export const CheckoutSchema = z.discriminatedUnion("type", [
  PackCheckoutSchema,
  SingleCheckoutSchema,
]);

export type PackCheckoutInput    = z.infer<typeof PackCheckoutSchema>;
export type SingleCheckoutInput  = z.infer<typeof SingleCheckoutSchema>;
export type CheckoutInput        = z.infer<typeof CheckoutSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────────

// ADMIN-01: Credit adjustment by admin — requires a reason for audit attribution.
export const AdjustCreditsSchema = z.object({
  action: z.literal("adjust_credits"),
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

export type AdjustCreditsInput = z.infer<typeof AdjustCreditsSchema>;

// Admin price update — amount in cents + reason for audit. The pack "original"
// strikethrough is derived (1h price × hours), so it isn't an input here.
export const UpdatePriceSchema = z.object({
  productKey:  z.enum(["session1h", "session2h", "pack5", "pack10"]),
  amountCents: z.number().int().positive(),
  reason:      z.string().min(1).max(500),
});

export const UpdatePricesSchema = z.array(UpdatePriceSchema).min(1).max(4);

export type UpdatePriceInput = z.infer<typeof UpdatePriceSchema>;

// Admin schedule update — working hours per day + min advance notice + timezone.
// weeklyHours is keyed by day-of-week "0".."6" (0=Sun..6=Sat); an empty/absent
// array means a non-working day. The server is the source of truth and re-checks
// that blocks within a day are ordered and non-overlapping (no adjacency either).
const TimeBlockSchema = z
  .object({
    startMinute: z.number().int().min(0).max(1439),
    endMinute:   z.number().int().min(1).max(1440),
  })
  .refine((b) => b.endMinute > b.startMinute, { message: "end must be after start" });

export const UpdateScheduleSchema = z
  .object({
    weeklyHours: z.record(
      z.enum(["0", "1", "2", "3", "4", "5", "6"]),
      z.array(TimeBlockSchema).max(6),
    ),
    timezone:       z.enum(SUPPORTED_TIMEZONES),
    minNoticeHours: z.number().int().min(0).max(168),
    reason:         z.string().min(1).max(500),
  })
  .superRefine((val, ctx) => {
    for (const [dow, blocks] of Object.entries(val.weeklyHours)) {
      if (!blocks || blocks.length < 2) continue;
      const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < sorted.length; i++) {
        // Reject overlapping AND adjacent blocks (touching blocks should be one).
        if (sorted[i]!.startMinute <= sorted[i - 1]!.endMinute) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Overlapping or adjacent blocks for day ${dow}`,
            path: ["weeklyHours", dow],
          });
          break;
        }
      }
    }
  });

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const SubscribeSchema = z.object({
  type: z.enum(["courses", "blog"]),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;

// ─── Post-class reviews ───────────────────────────────────────────────────────

export const ReviewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind:    z.literal("rating"),
    eventId: z.string().min(1),
    rating:  z.number().int().min(1).max(5),
  }),
  z.object({
    kind:    z.literal("comment"),
    eventId: z.string().min(1),
    comment: z.string().max(1000),
  }),
  z.object({
    kind:   z.literal("google"),
    action: z.enum(["accept", "decline"]),
  }),
]);

export type ReviewInput = z.infer<typeof ReviewSchema>;

// ─── Locale preference ────────────────────────────────────────────────────────

export const LocaleSchema = z.object({
  locale: z.enum(["es", "en"]),
});

export type LocaleInput = z.infer<typeof LocaleSchema>;

// ─── Mobile auth ────────────────────────────────────────────────────────────────

// MOBILE-AUTH-01: native Google Sign-In yields a Google ID token on-device, which
// the app exchanges for a bearer credential at POST /api/auth/mobile.
export const MobileAuthSchema = z.object({
  idToken: z.string().min(1),
});

export type MobileAuthInput = z.infer<typeof MobileAuthSchema>;

// ─── Booking history ──────────────────────────────────────────────────────────

// BOOKING-HISTORY-01: query params for GET /api/my-bookings/history. Unlike every
// other schema here this one models a query string, so `limit` arrives as a string
// and needs coercion. `cursor` is the opaque "<startsAt>_<id>" keyset token echoed
// back from the previous page; it is validated for shape in the repository.
export const BookingHistoryQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
});

export type BookingHistoryQuery = z.infer<typeof BookingHistoryQuerySchema>;
