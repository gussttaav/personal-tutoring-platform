"use client";

/**
 * hooks/useClientValue.ts
 *
 * Hydration-safe helpers for reading client-only values without the
 * effect + setState pattern that react-hooks/set-state-in-effect flags.
 *
 * Both use useSyncExternalStore with a no-op subscription: the server
 * snapshot is returned during SSR and the client snapshot after hydration,
 * so there is no hydration mismatch and no state set inside an effect.
 */

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Returns true only after client hydration; false during SSR. */
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Computes a client-only value after hydration, returning `serverValue`
 * during SSR. `compute` must return a referentially stable value (a
 * primitive such as a string) so the snapshot does not change identity
 * on every render.
 */
export function useClientValue<T>(compute: () => T, serverValue: T): T {
  return useSyncExternalStore(emptySubscribe, compute, () => serverValue);
}
