"use client";

/*
 * CHAT-AGENT-P2-01b — "this is a touch device" as a hydration-safe hook, on the
 * `useReducedMotion` pattern (useSyncExternalStore, no set-state-in-effect, false on the
 * server). `(pointer: coarse)`: the primary pointer is a finger, so phones and tablets, not a
 * laptop that also has a touch screen. The chat's dictation sends on stop there (no keyboard
 * to review a long transcript with) and leaves the text in the input everywhere else.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

/** Reads the media query now; false when there is no `matchMedia` (SSR/Node). */
export function coarsePointerSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** True when the primary pointer is a finger (phones, tablets). */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, coarsePointerSnapshot, () => false);
}
