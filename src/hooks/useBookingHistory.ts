"use client";

/**
 * hooks/useBookingHistory.ts
 *
 * BOOKING-EXIT-01: the booking screens answer the back button and the site links.
 *
 * The booking surfaces (calendar wizard, pack booking, availability calendar, sign-in gate, pack
 * purchase) are React state over the page, not routes. Opening one used to add nothing to the
 * history, so browser / Android back left the PAGE — or did nothing at all when the page was the
 * first entry (LANDING-01 lands a returning student straight on `/area-personal`; the PWA starts
 * standalone). The contract here:
 *
 *   - Open  → ONE same-URL history entry, marked `__bookingOverlay`. Next 16 patches
 *             `pushState` and copies its own router state into the entry, so Next's popstate
 *             handler treats the way back as a no-op restore of the same page.
 *   - Back  → the marker leaves the top → `close()`. The page underneath is exactly where the
 *             visitor left it (the overlay is fixed; the page never scrolled).
 *   - Closed from the UI (exit button, a modal's ✕, …) → the effect sees `open` flip to false
 *             and pops the entry with `history.back()`, so the stack is what it was before.
 *             Only the effect BODY does this, never a cleanup: on unmount (a route change) the
 *             cleanup would race Next's own push.
 *   - Reopened while that pop is still in flight (availability modal → wizard while the
 *             booking history loads) → the push waits for the popstate, or it would land on the
 *             entry the pop is about to leave.
 *   - Site links (`requestBookingExit`, lib/booking-exit.ts) → canceled and handled here: the
 *             current page → `close()`; another page → `router.replace`, which overwrites the
 *             booking's entry so back from there returns to this page in one press.
 *
 * Never close the overlay AND navigate in the same handler: the close's `history.back()` would
 * race the navigation. Leaving for another page is a navigation only (the page unmounts the
 * overlay with it) — `replace` while the entry is on top, see `isBookingEntryOnTop`.
 */

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { CLOSE_BOOKING_EVENT, type CloseBookingDetail } from "@/lib/booking-exit";

const MARKER = "__bookingOverlay";

/** True while the current history entry is the one a booking screen pushed. */
export function isBookingEntryOnTop(): boolean {
  if (typeof window === "undefined") return false;
  const state = window.history.state as Record<string, unknown> | null;
  return state?.[MARKER] === true;
}

function pushBookingEntry(): void {
  window.history.pushState({ [MARKER]: true }, "");
}

/**
 * @param open   Whether a booking surface is on screen — the same condition its render uses.
 * @param close  Closes every booking surface (state only; this hook owns the history side).
 */
export function useBookingHistory(open: boolean, close: () => void): void {
  const navigation = useRouter();
  const pathname   = usePathname();

  const openRef = useRef(open);
  const wasOpen = useRef(false);
  const popping = useRef(false);

  const onBack = useEffectEvent(() => close());

  const onLinkExit = useEffectEvent((href: string) => {
    if (href === pathname) {
      close();
      return;
    }
    if (isBookingEntryOnTop()) navigation.replace(href);
    else navigation.push(href);
  });

  // One popstate listener for the hook's lifetime: it must also hear the popstate of a pop the
  // effect below started after `open` went false.
  useEffect(() => {
    const onPopState = () => {
      if (popping.current) {
        popping.current = false;
        if (openRef.current && !isBookingEntryOnTop()) pushBookingEntry();
        return;
      }
      if (openRef.current && !isBookingEntryOnTop()) onBack();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      wasOpen.current = true;
      if (!popping.current && !isBookingEntryOnTop()) pushBookingEntry();
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (!popping.current && isBookingEntryOnTop()) {
      popping.current = true;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onCloseRequest = (event: Event) => {
      const href = (event as CustomEvent<CloseBookingDetail>).detail?.href;
      if (!href) return;
      event.preventDefault();
      onLinkExit(href);
    };
    window.addEventListener(CLOSE_BOOKING_EVENT, onCloseRequest);
    return () => window.removeEventListener(CLOSE_BOOKING_EVENT, onCloseRequest);
  }, [open]);
}
