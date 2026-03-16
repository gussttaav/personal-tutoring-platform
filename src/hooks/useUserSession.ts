"use client";

/**
 * useUserSession
 *
 * Replaces the old URL-param approach with NextAuth session data.
 * On mount, if the user is signed in and has an active pack, credits
 * are fetched automatically from Google Sheets via /api/credits.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import type { UserSession } from "@/types";

export function useUserSession() {
  const { data: googleSession, status } = useSession();
  const [packSession, setPackSession] = useState<UserSession | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Auto-detect active pack credits when the user is signed in
  useEffect(() => {
    if (status !== "authenticated" || !googleSession?.user?.email) return;

    const email = googleSession.user.email;
    setCreditsLoading(true);

    api.credits
      .get()
      .then((data) => {
        if (data.credits > 0) {
          setPackSession({
            email,
            name: googleSession.user?.name ?? "",
            credits: data.credits,
            packSize: data.packSize,
          });
        } else {
          setPackSession(null);
        }
      })
      .catch(() => {
        // Silently fail — user stays in browse mode without pack
        setPackSession(null);
      })
      .finally(() => setCreditsLoading(false));
  }, [status, googleSession]);

  function updateCredits(remaining: number) {
    if (!packSession) return;
    if (remaining > 0) {
      setPackSession({ ...packSession, credits: remaining });
    } else {
      setPackSession(null);
    }
  }

  function clearPackSession() {
    setPackSession(null);
  }

  return {
    // Google identity (always available when signed in)
    googleUser: googleSession?.user ?? null,
    isSignedIn: status === "authenticated",
    isAuthLoading: status === "loading",

    // Pack credits session (only set when user has active credits)
    packSession,
    creditsLoading,
    updateCredits,
    clearPackSession,
  };
}
