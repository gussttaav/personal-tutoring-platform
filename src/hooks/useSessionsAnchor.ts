"use client";

/*
 * COURSE-P6-03 — "Mentoría" in the Navbar and the Footer.
 *
 * `#sessions` is a SECTION of the landing page, not a page. That makes the link two different
 * things depending on where it is clicked, and both were broken in their own way:
 *
 *   - On the landing page it has always been intercepted (close any booking overlay, then
 *     smooth-scroll) so the URL never changed.
 *   - Anywhere else — and the Navbar and Footer render on /cursos too — the bare `#sessions`
 *     fragment matched nothing and the interception fired an event nobody listened for, so the
 *     click silently did NOTHING.
 *
 * Making it a real `/#sessions` link fixed the dead click but left the URL inconsistent: the
 * fragment showed when you arrived from another page and not when you clicked at home. Trying
 * to strip it afterwards was worse — `history.replaceState` behind the App Router desynced its
 * bookkeeping (navbar → Back → footer reproducibly yielded `/#sessions#sessions`), and the
 * router's own `replace` will not drop a fragment on the route it is already on.
 *
 * So the fragment is never created. The href stays `/#sessions` — correct semantics, and it
 * still works with JS disabled or on a middle-click — but the JS path intercepts it and carries
 * the intent across the navigation instead. `sessionStorage`, because the intent has to survive
 * a route change; read-once, so a navigation that never lands cannot leave it armed.
 */

import { useCallback } from "react";
import type { MouseEvent } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export const SESSIONS_ANCHOR = "#sessions";
const INTENT_KEY = "gt:scroll-intent";

/** Consume a pending scroll intent, if any. Reading it clears it. */
export function takeScrollIntent(): string | null {
  try {
    const value = sessionStorage.getItem(INTENT_KEY);
    if (value) sessionStorage.removeItem(INTENT_KEY);
    return value;
  } catch {
    // Private mode / storage disabled — the reader just lands at the top of the page.
    return null;
  }
}

/** onClick for a link pointing at `/#sessions`. Same behaviour from anywhere, no fragment. */
export function useSessionsAnchor(): (e: MouseEvent) => void {
  const pathname = usePathname();
  const router   = useRouter();

  return useCallback(
    (e: MouseEvent) => {
      // Let the browser handle new-tab / download / modified clicks natively.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as MouseEvent).button !== 0) return;
      e.preventDefault();

      if (pathname === "/") {
        // Already here: close any open booking overlay, then scroll. InteractiveShell listens.
        window.dispatchEvent(
          new CustomEvent("close-booking-overlay", { detail: { scrollTo: SESSIONS_ANCHOR } }),
        );
        return;
      }

      try {
        sessionStorage.setItem(INTENT_KEY, SESSIONS_ANCHOR);
      } catch {
        // Storage unavailable — still navigate; the reader lands at the top of the page.
      }
      router.push("/");
    },
    [pathname, router],
  );
}
