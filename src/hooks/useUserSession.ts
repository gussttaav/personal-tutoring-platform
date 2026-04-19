"use client";

/**
 * useUserSession
 *
 * Fetches credits exactly once when the user first authenticates.
 * Also re-fetches silently when the browser tab regains visibility —
 * this handles the case where the user cancels a class via the email
 * link (possibly in another tab or device) and then returns to the
 * site: they will see their restored credit without a manual refresh.
 *
 * QUAL-06: Added a 30-second cooldown to the visibility-change refetch.
 * Previously every tab focus triggered a KV GET unconditionally, meaning
 * rapidly switching between tabs would hammer the Upstash REST API and
 * consume rate-limit budget unnecessarily.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import type { UserSession } from "@/domain/types";

// Minimum milliseconds between visibility-triggered credit re-fetches.
// 30 seconds is long enough to avoid hammering the API on rapid tab
// switching, but short enough that a cancellation made in another tab
// is reflected quickly when the user returns.
const VISIBILITY_REFETCH_COOLDOWN_MS = 30_000;

export function useUserSession() {
  const { data: googleSession, status } = useSession();
  const [packSession,    setPackSession]    = useState<UserSession | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Track the email we last fetched for — prevents duplicate fetches
  // caused by NextAuth returning a new session object reference on every
  // render cycle even when the underlying data has not changed.
  const fetchedForEmail  = useRef<string | null>(null);

  // Timestamp of the last visibility-triggered fetch (0 = never).
  // QUAL-06: used to enforce the cooldown between tab-focus refetches.
  const lastVisibilityFetch = useRef<number>(0);

  // ── Core fetch function ────────────────────────────────────────────────────

  const fetchCredits = useCallback(
    async (email: string, name: string) => {
      setCreditsLoading(true);
      try {
        const data = await api.credits.get();
        if (data.credits > 0) {
          setPackSession({ email, name, credits: data.credits, packSize: data.packSize });
        } else {
          setPackSession(null);
        }
      } catch {
        // Silently fail — user stays in browse mode without pack
        setPackSession(null);
      } finally {
        setCreditsLoading(false);
      }
    },
    []
  );

  // ── Initial fetch on authentication ───────────────────────────────────────
  // Fires exactly once per login session. Depends on the email string
  // (a stable primitive) rather than the session object reference
  // (unstable — NextAuth reconstructs it on every render cycle).

  useEffect(() => {
    const email = googleSession?.user?.email;
    const name  = googleSession?.user?.name ?? "";

    if (status !== "authenticated" || !email) return;
    if (fetchedForEmail.current === email) return;

    fetchedForEmail.current = email;
    fetchCredits(email, name);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, googleSession?.user?.email]);

  // ── Reset on sign-out ─────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") {
      fetchedForEmail.current = null;
      lastVisibilityFetch.current = 0;
      setPackSession(null);
    }
  }, [status]);

  // ── Visibility-based refresh ───────────────────────────────────────────────
  // When the user returns to this tab after being away (e.g. they clicked
  // the cancellation link in their email, which restored a credit server-side),
  // silently re-fetch credits so the UI reflects the change without a manual
  // page refresh.
  //
  // QUAL-06: guarded by a 30-second cooldown so rapidly toggling between tabs
  // does not create a burst of Upstash GET requests.
  // Cost: at most 1 Upstash GET per 30 seconds per tab, only when authenticated.

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      const email = googleSession?.user?.email;
      const name  = googleSession?.user?.name ?? "";
      if (status !== "authenticated" || !email) return;

      // QUAL-06: enforce cooldown
      const now = Date.now();
      if (now - lastVisibilityFetch.current < VISIBILITY_REFETCH_COOLDOWN_MS) return;

      lastVisibilityFetch.current = now;
      fetchCredits(email, name);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, googleSession?.user?.email, googleSession?.user?.name, fetchCredits]);

  // ── Imperative update (used after booking a class) ────────────────────────

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
    googleUser:    googleSession?.user ?? null,
    isSignedIn:    status === "authenticated",
    isAuthLoading: status === "loading",

    // Pack credits session (only set when user has active credits)
    packSession,
    creditsLoading,
    updateCredits,
    clearPackSession,
  };
}
