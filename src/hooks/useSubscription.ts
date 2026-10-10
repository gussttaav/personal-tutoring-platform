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
 *
 * BLOG-15: the blog opt-in follows areas. `areas` is what the status GET reported (`null` =
 * every area, and always `null` for courses); `toggle({ areas })` subscribes with a
 * selection, and `updateAreas` saves a changed one with a PATCH. The save is explicit, not
 * optimistic: the card edits a draft and calls it from «Actualizar suscripción», and `areas`
 * only changes once the server has accepted it. The courses card ignores all three.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { signInWithPopup } from "@/lib/auth-popup";
import type { BlogArea, SubscriptionType } from "@/domain/types";

export type SubscriptionState = "idle" | "loading" | "subscribed" | "error";

/** BLOG-15: how a save of the area selection ended. `not-subscribed` = the subscription was
 *  gone (removed in another tab); the hook has already switched back to `idle`. */
export type AreasUpdateResult = "saved" | "failed" | "not-subscribed";

export interface UseSubscriptionResult {
  state:      SubscriptionState;
  /** True while the status check or a mutation is in flight, or the session is still loading. */
  busy:       boolean;
  isSignedIn: boolean;
  /** BLOG-15: the status read has answered (signed-in only) — until then `areas` is not
   *  the reader's yet, so a surface that shows it waits for this. */
  statusKnown: boolean;
  /** BLOG-15: the saved area selection; `null` = every area (and for courses). */
  areas:      BlogArea[] | null;
  /** True while an area change is being saved. */
  savingAreas: boolean;
  /** Sign in when signed out; otherwise subscribe (with `areas`, blog only), or unsubscribe
   *  when already subscribed. */
  toggle:     (options?: { areas?: BlogArea[] }) => Promise<void>;
  /** BLOG-15: replace the blog area selection of the existing subscription. */
  updateAreas: (areas: BlogArea[]) => Promise<AreasUpdateResult>;
  /** Clear an error back to `idle` so the surface can offer a retry. */
  reset:      () => void;
}

export function useSubscription(type: SubscriptionType): UseSubscriptionResult {
  const { data: session, status, update } = useSession();
  const [state, setState] = useState<SubscriptionState>("idle");
  const [areas, setAreas] = useState<BlogArea[] | null>(null);
  const [savingAreas, setSavingAreas] = useState(false);
  const [statusKnown, setStatusKnown] = useState(false);

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
      .then((data) => {
        if (cancelled) return;
        setAreas(Array.isArray(data.areas) ? data.areas : null);
        setState(data.subscribed ? "subscribed" : "idle");
        setStatusKnown(true);
      })
      .catch(() => {
        if (cancelled) return;
        setState("idle");
        setStatusKnown(true);
      });
    return () => { cancelled = true; };
  }, [statusCheckStarted, type]);

  const toggle = useCallback(async (options?: { areas?: BlogArea[] }) => {
    if (!isSignedIn) {
      const result = await signInWithPopup("/");
      if (result.blocked) { signIn("google"); return; }
      if (result.success) await update();
      return;
    }

    const unsubscribing = state === "subscribed";
    const picked = !unsubscribing && type === "blog" ? options?.areas : undefined;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method:  unsubscribing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(picked ? { type, areas: picked } : { type }),
      });
      // 409 = already subscribed, which is the state the caller wanted anyway.
      const ok = res.ok || res.status === 409;
      if (!ok) setState("error");
      else {
        // A 409 kept whatever selection the row already had; the next status read shows it.
        if (!unsubscribing && res.ok) setAreas(picked ?? null);
        setState(unsubscribing ? "idle" : "subscribed");
      }
    } catch {
      setState("error");
    }
  }, [isSignedIn, state, type, update]);

  const updateAreas = useCallback(async (next: BlogArea[]): Promise<AreasUpdateResult> => {
    setSavingAreas(true);
    try {
      const res = await fetch("/api/subscribe", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, areas: next }),
      });
      if (res.status === 404) {
        // Unsubscribed elsewhere since this card loaded: show the invitation again.
        setAreas(null);
        setState("idle");
        return "not-subscribed";
      }
      if (!res.ok) return "failed";
      setAreas(next);
      return "saved";
    } catch {
      return "failed";
    } finally {
      setSavingAreas(false);
    }
  }, [type]);

  const reset = useCallback(() => setState("idle"), []);

  return {
    state,
    busy: state === "loading" || (!isLoaded && isSignedIn),
    isSignedIn,
    statusKnown,
    areas,
    savingAreas,
    toggle,
    updateAreas,
    reset,
  };
}
