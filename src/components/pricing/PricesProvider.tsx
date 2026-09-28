"use client";

// Makes the server-fetched display prices available to the client component
// tree without prop-drilling. Fed once from the locale layout, so prices are
// present on first render (no fetch, no flicker).
//
// PRICING-STUDENT-01: those layout-fed prices are the PUBLIC ones, and they must
// stay that way — `/` and `/mentoria` are statically prerendered and shared by
// every visitor (SEO-01), and this provider is mounted above AuthProvider, so at
// the point it renders there is no notion of who is viewing.
//
// A student with a private price therefore arrives as an *overlay*: UserPricingSync
// (mounted inside AuthProvider, where the session is knowable) fetches it and
// applies it here. Consumers are unaffected — usePrices() and friends keep their
// signatures and simply start returning the student's prices instead.
import { createContext, useContext, useMemo, useState } from "react";
import type { ProductKey } from "@/domain/types";
import type { DisplayPrice, DisplayPrices } from "@/lib/pricing-format";

const PricesContext = createContext<DisplayPrices | null>(null);
// Pack validity (days) rides alongside prices — both are admin-editable at
// /admin/pricing and fed together from the layout. Separate context so existing
// price hooks keep their return types.
const PackValidityContext = createContext<number | null>(null);

// PRICING-STUDENT-01: write side of the overlay, kept separate from the read
// contexts so applying an override doesn't change any existing hook's return
// type. Only UserPricingSync uses this.
interface PricesOverlayApi {
  apply: (prices: DisplayPrices) => void;
  clear: () => void;
}
const PricesOverlayContext = createContext<PricesOverlayApi | null>(null);

// Owned by UserPricingSync, not by PricesProvider: it is derived from the session
// status, which is only knowable inside AuthProvider. Defaults to false so a tree
// without UserPricingSync renders prices normally rather than hanging on a
// skeleton forever.
const PricesSyncingContext = createContext<boolean>(false);

export function PricesProvider({
  value,
  packValidityDays,
  children,
}: {
  value: DisplayPrices;
  packValidityDays: number;
  children: React.ReactNode;
}) {
  // `value` holds the public prices; `overrides` holds this student's, if any.
  const [overrides, setOverrides] = useState<DisplayPrices | null>(null);
  const prices = overrides ?? value;

  // Named handlers in a stable object rather than inline closures:
  // react-hooks/refs flags render-time handler factories under the React Compiler.
  const overlay = useMemo<PricesOverlayApi>(
    () => ({
      apply: (next: DisplayPrices) => setOverrides(next),
      clear: () => setOverrides(null),
    }),
    [],
  );

  return (
    <PricesContext.Provider value={prices}>
      <PackValidityContext.Provider value={packValidityDays}>
        <PricesOverlayContext.Provider value={overlay}>
          {children}
        </PricesOverlayContext.Provider>
      </PackValidityContext.Provider>
    </PricesContext.Provider>
  );
}

/** PRICING-STUDENT-01: rendered by UserPricingSync, which derives the flag. */
export function PricesSyncingProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <PricesSyncingContext.Provider value={value}>{children}</PricesSyncingContext.Provider>
  );
}

export function usePrices(): DisplayPrices {
  const ctx = useContext(PricesContext);
  if (!ctx) throw new Error("usePrices must be used within a PricesProvider");
  return ctx;
}

export function useProductPrice(key: ProductKey): DisplayPrice {
  return usePrices()[key];
}

/** How many days a purchased pack stays redeemable (admin-editable). */
export function usePackValidityDays(): number {
  const ctx = useContext(PackValidityContext);
  if (ctx === null) throw new Error("usePackValidityDays must be used within a PricesProvider");
  return ctx;
}

/**
 * PRICING-STUDENT-01: true while a signed-in viewer's own prices are still in
 * flight. Components that already gate prices behind a skeleton fold this in, so
 * a student on a private price never sees the public one flash first.
 *
 * Always false for anonymous viewers, so the static pages and Googlebot are
 * unaffected.
 */
export function usePricesSyncing(): boolean {
  return useContext(PricesSyncingContext);
}

/** PRICING-STUDENT-01: internal — UserPricingSync only. */
export function usePricesOverlay(): PricesOverlayApi {
  const ctx = useContext(PricesOverlayContext);
  if (!ctx) throw new Error("usePricesOverlay must be used within a PricesProvider");
  return ctx;
}

/**
 * Price label for a session type. `free15min` is free (not a priced product),
 * so it returns null — callers fall back to their localized "free" copy.
 */
export function useSessionPriceLabel(
  sessionType: "free15min" | "session1h" | "session2h",
): string | null {
  const prices = usePrices();
  if (sessionType === "free15min") return null;
  return prices[sessionType].price;
}
