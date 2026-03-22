"use client";

/**
 * hooks/useRescheduleIntent.ts
 *
 * ARCH-06: Extracted from InteractiveShell.
 *
 * Responsibility: read the /?reschedule=...&token=... URL params that are
 * injected by confirmation email links, store the intent through the Google
 * OAuth round-trip (for unauthenticated users), and expose the resolved
 * reschedule state to the shell.
 *
 * Previously this was three separate useEffect blocks interleaved with
 * 8 other state variables inside InteractiveShell, making the component
 * hard to reason about and impossible to test in isolation.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { SingleSessionType } from "@/components/SingleSessionBooking";

export interface RescheduleIntent {
  /** Session type being rescheduled — "pack" | SingleSessionType */
  type: string;
  /** The cancellation token from the original booking */
  token: string | null;
  /** URL to redirect back to after Google OAuth (encodes type + token) */
  callbackUrl: string;
}

export interface RescheduleState {
  /** Non-null when a reschedule should be immediately applied (user is signed in) */
  activeReschedule: { type: string; token: string | null } | null;
  /** Non-null when we're waiting for sign-in before applying the reschedule */
  pendingReschedule: RescheduleIntent | null;
  /** The label to show in the SignInGate when a reschedule triggered it */
  signInLabel: string;
  /** Call after the pending reschedule has been applied to clear the state */
  clearPendingReschedule: () => void;
}

/**
 * Reads /?reschedule= URL params on mount, stores them, and resolves them
 * against the current auth state.
 *
 * @param isSignedIn  Current auth state from useUserSession
 */
export function useRescheduleIntent(isSignedIn: boolean): RescheduleState {
  const searchParams = useSearchParams();

  const [pendingReschedule, setPendingReschedule] = useState<RescheduleIntent | null>(null);
  const [activeReschedule,  setActiveReschedule]  = useState<{ type: string; token: string | null } | null>(null);
  const [signInLabel,       setSignInLabel]        = useState("");

  // ── Read URL params on mount ───────────────────────────────────────────────
  // Fires once. Clears params from the URL immediately so they don't survive
  // navigation or sharing.
  useEffect(() => {
    const reschedule = searchParams.get("reschedule");
    const token      = searchParams.get("token");
    if (!reschedule) return;

    // Remove params from URL regardless of auth state
    const url = new URL(window.location.href);
    url.searchParams.delete("reschedule");
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());

    if (!isSignedIn) {
      // Not signed in — store the intent and surface the sign-in gate.
      // callbackUrl encodes the reschedule params so they survive the
      // Google OAuth round-trip and are re-read on the next mount.
      const callbackUrl = token
        ? `/?reschedule=${encodeURIComponent(reschedule)}&token=${encodeURIComponent(token)}`
        : `/?reschedule=${encodeURIComponent(reschedule)}`;

      setPendingReschedule({ type: reschedule, token: token ?? null, callbackUrl });
      setSignInLabel("reprogramar tu clase");
    } else {
      // Already signed in — activate immediately
      setActiveReschedule({ type: reschedule, token: token ?? null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Activate pending reschedule once user signs in ─────────────────────────
  useEffect(() => {
    if (!isSignedIn || !pendingReschedule) return;
    setActiveReschedule({ type: pendingReschedule.type, token: pendingReschedule.token });
    setPendingReschedule(null);
    setSignInLabel("");
  }, [isSignedIn, pendingReschedule]);

  function clearPendingReschedule() {
    setPendingReschedule(null);
    setSignInLabel("");
    setActiveReschedule(null);
  }

  return { activeReschedule, pendingReschedule, signInLabel, clearPendingReschedule };
}
