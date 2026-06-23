"use client";

// Makes the server-fetched booking schedule available to the client component
// tree without prop-drilling. Fed once from the locale layout, so the schedule
// is present on first render (no fetch, no flicker) — mirrors PricesProvider.
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
