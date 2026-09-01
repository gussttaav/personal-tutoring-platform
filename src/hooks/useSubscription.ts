"use client";

/*
 * COURSE-P6-02 — subscription state, shared by every surface that offers one.
 *
 * Lifted verbatim from ComingSoonModal, which was the only subscriber UI while the modal
 * was the only place to subscribe. The courses catalog and the English course landing now
 * offer it too (CourseNotifyCard), and two copies of a state machine that talks to
 * /api/subscribe would be two things to keep in step. The modal now consumes this hook.
 *
 * Behaviour worth knowing:
 * - The status GET fires ONCE, the first render after the visitor is known to be signed in.
 *   A dedicated flag (not `state === "loading"`) drives it, so the subscribe POST's own
 *   loading state cannot re-trigger it.
 * - 409 ALREADY_SUBSCRIBED counts as success: the row exists, which is what the caller asked for.
 * - Signed out, `toggle()` starts Google sign-in in a popup and falls back to a full redirect
 *   when the popup is blocked. It does NOT subscribe afterwards — the session has to settle
 *   first, and the visitor lands back on a card that now says "subscribe".
 */

import { useCallback, useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { signInWithPopup } from "@/lib/auth-popup";
import type { SubscriptionType } from "@/domain/types";

export type SubscriptionState = "idle" | "loading" | "subscribed" | "error";

export interface UseSubscriptionResult {
  state:      SubscriptionState;
  /** True while the status check or a mutation is in flight, or the session is still loading. */
  busy:       boolean;
  isSignedIn: boolean;
  /** Sign in when signed out; otherwise subscribe, or unsubscribe when already subscribed. */
  toggle:     () => Promise<void>;
  /** Clear an error back to `idle` so the surface can offer a retry. */
  reset:      () => void;
}

export function useSubscription(type: SubscriptionType): UseSubscriptionResult {
  const { data: session, status, update } = useSession();
  const [state, setState] = useState<SubscriptionState>("idle");

  const isLoaded   = status !== "loading";
  const isSignedIn = !!session?.user?.email;

  // Render-phase trigger: once the visitor is signed in, kick off the one-time status check.
  const [statusCheckStarted, setStatusCheckStarted] = useState(false);
  if (isSignedIn && !statusCheckStarted) {
    setStatusCheckStarted(true);
    setState("loading");
  }

  useEffect(() => {
    if (!statusCheckStarted) return;
    let cancelled = false;
    fetch(`/api/subscribe?type=${type}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setState(data.subscribed ? "subscribed" : "idle"); })
      .catch(() => { if (!cancelled) setState("idle"); });
    return () => { cancelled = true; };
  }, [statusCheckStarted, type]);

  const toggle = useCallback(async () => {
    if (!isSignedIn) {
      const result = await signInWithPopup("/");
      if (result.blocked) { signIn("google"); return; }
      if (result.success) await update();
      return;
    }

    const unsubscribing = state === "subscribed";
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method:  unsubscribing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type }),
      });
      // 409 = already subscribed, which is the state the caller wanted anyway.
      const ok = res.ok || res.status === 409;
      if (!ok) setState("error");
      else setState(unsubscribing ? "idle" : "subscribed");
    } catch {
      setState("error");
    }
  }, [isSignedIn, state, type, update]);

  const reset = useCallback(() => setState("idle"), []);

  return {
    state,
    busy: state === "loading" || (!isLoaded && isSignedIn),
    isSignedIn,
    toggle,
    reset,
  };
}
