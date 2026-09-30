"use client";

/**
 * UserSessionProvider — the page's ONE copy of the student's credit/session state.
 *
 * REFACTOR-R4-P2-04: `useUserSession()` used to own its state per call site, so the Navbar,
 * BookingProvider and PackBookingOverlay each fetched /api/credits and each kept their own
 * (diverging) credit count. This provider runs `useUserSessionState()` once, in the root
 * layout inside `AuthProvider` (it needs `useSession`), and every `useUserSession()` reads it.
 *
 * A client component with no server data: mounting it on every page costs nothing for
 * signed-out visitors (the state's effects early-return unless authenticated).
 */

import type { ReactNode } from "react";
import { UserSessionContext, useUserSessionState } from "@/hooks/useUserSession";

export default function UserSessionProvider({ children }: { children: ReactNode }) {
  const value = useUserSessionState();
  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}
