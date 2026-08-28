// Server-only helper that turns the canonical `pricing` rows into render-ready
// display values for the customer-facing UI. All marketing-derived fields
// (hourly rate, savings amount/percentage) are COMPUTED here from the stored
// amount + original amount — never stored — so editing a price keeps them in
// sync automatically.
import "server-only";
import { unstable_cache } from "next/cache";
import { pricingService } from "@/services";
import { log } from "@/lib/logger";
import type { ProductKey } from "@/domain/types";

/** Static hours-per-pack, used to derive the per-hour rate. */
const PACK_HOURS: Record<"pack5" | "pack10", number> = { pack5: 5, pack10: 10 };

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

// Cached read so the (statically generated, SEO-critical) public pages don't hit
// the DB per request. An admin price edit calls `revalidateTag(PRICING_CACHE_TAG)`
// so it shows on public pages immediately. The time-based `revalidate` is only a
// long safety net for out-of-band DB changes — keeping it long avoids needless
// ISR-cache rewrites on every page hit. The CHARGE (PaymentService) and the admin
// panel read pricingService directly — never this cache — so they are always fresh.
export const PRICING_CACHE_TAG = "pricing-all";
const REVALIDATE_SECONDS = 3600;
const getRawPrices = unstable_cache(
  // BUILD-03b: TEMPORARY instrumentation of the exact path that aborts the
  // build. `ms` is the discriminator: a real PostgREST round trip from the
  // build container measures ~300-800ms (see the [SB-DIAG] probes), whereas a
  // replay of a poisoned entry from the restored Next fetch-cache returns in
  // ~0ms with no network at all. Remove with the rest of BUILD-03.
  async () => {
    const t0 = Date.now();
    log("info", "BUILD-DIAG pricing read start", {
      service: "build-diag", at: new Date().toISOString(),
    });
    try {
      const rows = await pricingService.getAll();
      log("info", "BUILD-DIAG pricing read OK", {
        service: "build-diag", ms: Date.now() - t0, rows: rows.length,
      });
      return rows;
    } catch (err) {
      log("error", "BUILD-DIAG pricing read FAILED", {
        service: "build-diag", ms: Date.now() - t0,
        error: (err as Error).message, detail: JSON.stringify(err),
      });
      throw err;
    }
  },
  ["pricing-all"],
  { revalidate: REVALIDATE_SECONDS, tags: [PRICING_CACHE_TAG] },
);

export async function getDisplayPrices(locale = "es"): Promise<DisplayPrices> {
  const rows = await getRawPrices();
  const out  = {} as DisplayPrices;

  // The pack strikethrough "original" is the cost of the same hours bought as
  // single 1h sessions — derived, never stored.
  const session1hCents = rows.find((r) => r.productKey === "session1h")?.amountCents ?? null;

  for (const row of rows) {
    const key = row.productKey;
    const hours = key === "pack5" || key === "pack10" ? PACK_HOURS[key] : null;

    let hourlyRate: string | null = null;
    let originalPrice: string | null = null;
    let savingsAmount: string | null = null;
    let savingsPct: number | null = null;

    if (hours) {
      hourlyRate = formatPrice(Math.round(row.amountCents / hours), row.currency, locale);

      // Derived original = 1h session price × pack hours. Only show the
      // strikethrough/savings when the pack genuinely beats buying singles.
      const originalCents = session1hCents !== null ? session1hCents * hours : null;
      if (originalCents !== null && originalCents > row.amountCents) {
        originalPrice = formatPrice(originalCents, row.currency, locale);
        savingsAmount = formatPrice(originalCents - row.amountCents, row.currency, locale);
        savingsPct    = Math.round(((originalCents - row.amountCents) / originalCents) * 100);
      }
    }

    out[key] = {
      price:      formatPrice(row.amountCents, row.currency, locale),
      priceCents: row.amountCents,
      currency:   row.currency,
      originalPrice,
      hourlyRate,
      savingsAmount,
      savingsPct,
    };
  }

  return out;
}
