// PRICING-STUDENT-01: the price formatting that BOTH the server and the client
// need. Deliberately free of `server-only`, `@/services` and `next/cache` so a
// client component can import it.
//
// Why this exists: the public prices are baked into the statically prerendered
// layout, but a student's private price can only be known after the session
// resolves in the browser. So the overlay arrives as the `PublicPricing` DTO
// from GET /api/pricing and has to be turned into the same `DisplayPrices` shape
// the context already holds — on the client.
//
// Nothing here derives anything: `PublicPricing` already carries the per-class
// rate and the strikethrough/savings, computed once in PricingService. This
// module only formats them.
import type { ProductKey, PublicPricing } from "@/domain/types";

export interface DisplayPrice {
  /** Formatted charge price, e.g. "€16" or "€16,50". */
  price:         string;
  priceCents:    number;
  currency:      string;
  /** Strikethrough original price (packs with a promo), else null. */
  originalPrice: string | null;
  /** Formatted per-hour rate (packs only), else null. */
  hourlyRate:    string | null;
  /** Formatted absolute savings vs. the original price (packs only), else null. */
  savingsAmount: string | null;
  /** Whole-percent discount vs. the original price (packs only), else null. */
  savingsPct:    number | null;
}

export type DisplayPrices = Record<ProductKey, DisplayPrice>;

/** Formats integer cents into the app's "€{n}" style, with decimals only when needed. */
export function formatPrice(cents: number, currency: string, locale = "es"): string {
  const symbol = currency.toLowerCase() === "eur" ? "€" : currency.toUpperCase() + " ";
  const euros  = cents / 100;
  const body   = Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${body}`;
}

/**
 * Turns the API's numeric DTO into the render-ready shape held by PricesProvider.
 *
 * Must stay output-identical to getDisplayPrices() in pricing-display.ts for the
 * same underlying prices — defaults reach the UI through that one, overrides
 * through this one, and a student must not see a different *layout* just because
 * their price is private. pricing-format.test.ts pins the two together.
 */
export function publicPricingToDisplay(
  pricing: PublicPricing,
  locale = "es",
): DisplayPrices {
  const out = {} as DisplayPrices;

  for (const s of pricing.sessions) {
    out[s.productKey] = {
      price:         formatPrice(s.amountCents, s.currency, locale),
      priceCents:    s.amountCents,
      currency:      s.currency,
      originalPrice: null,
      hourlyRate:    null,
      savingsAmount: null,
      savingsPct:    null,
    };
  }

  for (const p of pricing.packs) {
    out[p.productKey] = {
      price:         formatPrice(p.amountCents, p.currency, locale),
      priceCents:    p.amountCents,
      currency:      p.currency,
      // All three savings fields are null together when the pack does not beat
      // buying the same hours as single classes — preserve that, don't format a
      // null into "€0".
      originalPrice: p.originalAmountCents === null
        ? null
        : formatPrice(p.originalAmountCents, p.currency, locale),
      hourlyRate:    formatPrice(p.perClassCents, p.currency, locale),
      savingsAmount: p.savingsCents === null
        ? null
        : formatPrice(p.savingsCents, p.currency, locale),
      savingsPct:    p.savingsPct,
    };
  }

  return out;
}
