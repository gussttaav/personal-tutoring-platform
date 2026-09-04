"use client";

// Makes the server-fetched display prices available to the client component
// tree without prop-drilling. Fed once from the locale layout, so prices are
// present on first render (no fetch, no flicker).
import { createContext, useContext } from "react";
import type { ProductKey } from "@/domain/types";
import type { DisplayPrice, DisplayPrices } from "@/lib/pricing-display";

const PricesContext = createContext<DisplayPrices | null>(null);
// Pack validity (days) rides alongside prices — both are admin-editable at
// /admin/pricing and fed together from the layout. Separate context so existing
// price hooks keep their return types.
const PackValidityContext = createContext<number | null>(null);

export function PricesProvider({
  value,
  packValidityDays,
  children,
}: {
  value: DisplayPrices;
  packValidityDays: number;
  children: React.ReactNode;
}) {
  return (
    <PricesContext.Provider value={value}>
      <PackValidityContext.Provider value={packValidityDays}>
        {children}
      </PackValidityContext.Provider>
    </PricesContext.Provider>
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
