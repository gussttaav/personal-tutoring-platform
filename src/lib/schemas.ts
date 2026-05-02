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

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const SubscribeSchema = z.object({
  type: z.enum(["courses", "blog"]),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;
