"use client";

/*
 * COURSE-P2-02 — `prefers-reduced-motion` as a hydration-safe hook.
 *
 * The two animated course widgets (`gradient-descent-2d`, `loss-landscape`) use
 * this to drop their auto-play and fall back to a manual step control. Built on
 * `useSyncExternalStore` (like `useClientValue`) so there is no set-state-in-effect
 * and no SSR/client mismatch: the server assumes motion is allowed (false), and the
 * real media-query value takes over after hydration, updating live if the OS
 * setting changes. The snapshot logic is exported pure for unit testing.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Reads the media query now; false when there is no `matchMedia` (SSR/Node). */
export function reducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** True when the user has asked the OS to reduce motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedMotionSnapshot, () => false);
}
