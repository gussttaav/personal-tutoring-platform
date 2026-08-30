/*
 * COURSE-P9-01 — Result-list keyboard arithmetic.
 *
 * Pure and separate from the dialog so it can be tested: `pnpm test:unit` runs in the
 * `node` environment and this repo has no jsdom, so nothing that renders a component is
 * testable here. Same reason reader/scroll-spy.ts and quiz/state.ts exist.
 */

/** Keys this module knows how to move the active option with. */
export const NAVIGATION_KEYS = ["ArrowDown", "ArrowUp", "Home", "End"] as const;
export type NavigationKey = (typeof NAVIGATION_KEYS)[number];

export function isNavigationKey(key: string): key is NavigationKey {
  return (NAVIGATION_KEYS as readonly string[]).includes(key);
}

/**
 * The next active option index. Wraps at both ends — in a short result list, pressing Up
 * from the top to reach the last result is faster than holding Down, and a palette that
 * refuses to move is read as broken.
 *
 * Returns -1 when there is nothing to select, so callers can clear `aria-activedescendant`
 * rather than point it at an element that does not exist.
 */
export function nextActiveIndex(current: number, total: number, key: NavigationKey): number {
  if (total <= 0) return -1;
  switch (key) {
    case "ArrowDown": return current >= total - 1 ? 0 : current + 1;
    case "ArrowUp":   return current <= 0 ? total - 1 : current - 1;
    case "Home":      return 0;
    case "End":       return total - 1;
  }
}
