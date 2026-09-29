"use client";

// Makes the server-fetched booking schedule available to the client component
// tree without prop-drilling. Fed once from CommerceProviders, so the schedule
// is present on first render (no fetch, no flicker) — mirrors PricesProvider.
//
// REFACTOR-R4-P2-03: fed by `CommerceProviders` (src/components/commerce/), which
// only the booking pages mount — no longer by the locale layout. Outside those
// pages `useScheduleConfig` throws; `useScheduleConfigOptional` is the
// non-throwing read for components rendered everywhere (the footer's policy modal).
import { createContext, useContext } from "react";
import type { ScheduleConfig } from "@/domain/types";

const ScheduleContext = createContext<ScheduleConfig | null>(null);

export function ScheduleProvider({
  value,
  children,
}: {
  value: ScheduleConfig;
  children: React.ReactNode;
}) {
  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useScheduleConfig(): ScheduleConfig {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useScheduleConfig must be used within a ScheduleProvider");
  return ctx;
}

/**
 * REFACTOR-R4-P2-03: `useScheduleConfig` for components that also render on pages
 * without CommerceProviders. `null` outside a ScheduleProvider instead of throwing.
 */
export function useScheduleConfigOptional(): ScheduleConfig | null {
  return useContext(ScheduleContext);
}
