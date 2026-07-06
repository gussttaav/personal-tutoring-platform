"use client";

/**
 * hooks/useBookingRouter.ts
 *
 * ARCH-06: Extracted from InteractiveShell.
 *
 * Responsibility: manage which booking view is currently active
 * (session, pack, or none) and the sign-in gate state that guards them.
 * Also exposes the handlers that InteractiveShell's click callbacks need.
 *
 * AUTH CONTINUITY — how intent survives the OAuth round-trip
 * ──────────────────────────────────────────────────────────
 * When an unauthenticated user clicks a session or pack action the hook
 * encodes their intent in the callbackUrl that is passed to Google OAuth:
 *
 *   Session click  → callbackUrl = /?intent=<sessionType>
 *   Pack buy       → callbackUrl = /?intent=buy-pack&packSize=<size>
 *   Pack schedule  → callbackUrl = /?action=schedule-pack
 *   Smart book     → callbackUrl = /?intent=smart-book[&slot…]
 *
 * After OAuth, Next.js renders the page with those params in the URL.
 * The hook reads them in a useEffect that is GATED ON isSignedIn === true,
 * NOT on bare mount. This is the critical fix: on mount isSignedIn is still
 * false (NextAuth status = "loading"), so a mount-only effect would always
 * see isSignedIn=false and discard every intent param. By depending on
 * [isSignedIn] the effect fires again once the session resolves, at which
 * point the params are still in the URL and the correct view is opened.
 *
 * A ref (intentConsumed) ensures params are only consumed once per page
 * load even if React re-renders or StrictMode double-invokes the effect.
 *
 * For the smart-book intent the consumer additionally waits for hasBookings
 * to settle (transition from null → boolean) so the routing decision has
 * both pack-credits and booking-history data available.
 */

import { useState, useEffect, useRef } from "react";
import type { PackSize, StudentInfo } from "@/domain/types";
import type { SingleSessionType } from "@/components/SingleSessionBooking";
import type { SelectedSlot } from "@/components/WeeklyCalendar";

export interface BookingRouterState {
  // ── Active views ──────────────────────────────────────────────────────────
  activeSession:   SingleSessionType | null;
  showPackBooking: boolean;
  selectedPack:    PackSize | null;
  rescheduleToken: string | null;

  // ── Sign-in gate ──────────────────────────────────────────────────────────
  /** Non-empty when the sign-in gate should be shown */
  signInGateLabel: string;
  /** The URL to pass to GoogleSignInButton — encodes the user's intent */
  signInCallbackUrl: string | undefined;

  // ── Handlers ──────────────────────────────────────────────────────────────
  handleSessionClick:    (type: SingleSessionType) => void;
  handlePackBuy:         (size: PackSize) => void;
  handlePackSchedule:    () => void;
  handleSignInGateClose: () => void;
  handleCreditsReady:    (_student: StudentInfo) => void;
  closePackBooking:      () => void;
  closeSession:          () => void;

  /**
   * Smart-routing CTA used by the landing-page hero buttons. Picks the right
   * booking surface based on the user's state:
   *
   *   - Signed-out          → SignInGate (with intent=smart-book + optional slot)
   *   - Active pack credits → pack booking flow
   *   - No prior bookings   → free 15-min flow
   *   - Has prior bookings  → paid 1h session flow
   */
  handleSmartBook: (opts?: { slot?: SelectedSlot }) => void;

  // ── Reschedule wiring ─────────────────────────────────────────────────────
  applyReschedule:          (type: string, token: string | null) => void;
  setRescheduleSignInLabel: (label: string) => void;

  // ── Availability modal sign-in gate ───────────────────────────────────────
  /** Show the sign-in gate with a fully custom label + callbackUrl.
   *  Used by the AvailabilityModal flow to encode slot params in the callbackUrl. */
  showSignInGate: (label: string, callbackUrl: string) => void;
  /** Slot restored from URL params after an OAuth round-trip from AvailabilityModal. */
  restoredSlot: SelectedSlot | null;
}

// SignInGate action labels are translation KEYS (resolved in SignInGate against
// the `booking.signInGate.actions.*` namespace), not literal strings — so the
// gate copy stays in sync with the active locale.
const SESSION_SIGNIN_LABELS: Record<SingleSessionType, string> = {
  free15min: "actions.bookFree15",
  session1h: "actions.book1h",
  session2h: "actions.book2h",
};

const VALID_SESSION_TYPES = new Set<string>(["free15min", "session1h", "session2h"]);
const VALID_PACK_SIZES    = new Set<number>([5, 10]);

function encodeSlotParams(params: URLSearchParams, slot: SelectedSlot) {
  params.set("slotStart",     slot.startIso);
  params.set("slotEnd",       slot.endIso);
  params.set("slotLabel",     slot.label);
  params.set("slotDateLabel", slot.dateLabel);
  if (slot.timezone) params.set("slotTz", slot.timezone);
}

export function useBookingRouter(
  isSignedIn: boolean,
  /** Current pack credits — used to route the buy-pack post-login intent */
  packCredits: number,
  /** Whether the user has ever booked. null = still loading. Required for smart-book routing. */
  hasBookings: boolean | null,
): BookingRouterState {
  const [activeSession,     setActiveSession]     = useState<SingleSessionType | null>(null);
  const [showPackBooking,   setShowPackBooking]   = useState(false);
  const [selectedPack,      setSelectedPack]      = useState<PackSize | null>(null);
  const [signInGateLabel,   setSignInGateLabel]   = useState("");
  const [signInCallbackUrl, setSignInCallbackUrl] = useState<string | undefined>(undefined);
  const [pendingSession,    setPendingSession]    = useState<SingleSessionType | null>(null);
  const [rescheduleToken,   setRescheduleToken]   = useState<string | null>(null);
  const [restoredSlot,      setRestoredSlot]      = useState<SelectedSlot | null>(null);

  // Prevents double-consuming intent params if the effect fires more than once
  const intentConsumed = useRef(false);
  // For the smart-book intent we may need to wait for hasBookings to settle;
  // this ref preserves the parsed slot between effect runs.
  const pendingSmartBook = useRef<{ slot: SelectedSlot | null } | null>(null);

  // ── Read URL intent params once the user is confirmed signed-in ───────────
  //
  // Depends on [isSignedIn, hasBookings] so it re-runs when NextAuth resolves
  // the session AND when the booking-history flag settles (required by the
  // smart-book branch). On the initial render after an OAuth redirect
  // isSignedIn is false; when it flips to true the ?intent / ?action params
  // are still in the URL.
  useEffect(() => {
    if (!isSignedIn) return;

    // Resume a previously-parked smart-book intent once hasBookings resolves.
    // Only used by the OAuth-restore path; the in-page smart-book caller
    // already has the slot wired through InteractiveShell's pendingSlot.
    if (pendingSmartBook.current) {
      if (hasBookings === null) return;
      const { slot } = pendingSmartBook.current;
      pendingSmartBook.current = null;
      if (slot) setRestoredSlot(slot);
      routeSmartBookSignedIn();
      return;
    }

    if (intentConsumed.current) return;

    const url           = new URL(window.location.href);
    const intent        = url.searchParams.get("intent");
    const action        = url.searchParams.get("action");
    const sizeStr       = url.searchParams.get("packSize");
    // Slot params encoded by the AvailabilityModal unauthenticated flow
    const slotStart     = url.searchParams.get("slotStart");
    const slotEnd       = url.searchParams.get("slotEnd");
    const slotLabel     = url.searchParams.get("slotLabel");
    const slotDateLabel = url.searchParams.get("slotDateLabel");
    const slotTz        = url.searchParams.get("slotTz");

    if (!intent && !action) return; // no intent params — nothing to do

    // Consume once and clean URL (including any slot params)
    intentConsumed.current = true;
    url.searchParams.delete("intent");
    url.searchParams.delete("action");
    url.searchParams.delete("packSize");
    url.searchParams.delete("slotStart");
    url.searchParams.delete("slotEnd");
    url.searchParams.delete("slotLabel");
    url.searchParams.delete("slotDateLabel");
    url.searchParams.delete("slotTz");
    window.history.replaceState({}, "", url.toString());

    const parsedSlot: SelectedSlot | null =
      slotStart && slotEnd && slotLabel && slotDateLabel
        ? {
            startIso:  slotStart,
            endIso:    slotEnd,
            label:     slotLabel,
            dateLabel: slotDateLabel,
            timezone:  slotTz ?? undefined,
          }
        : null;

    // intent=smart-book — landing CTA after OAuth.
    // Defer routing until hasBookings has resolved, because the choice
    // between free15min and session1h depends on it.
    if (intent === "smart-book") {
      if (hasBookings === null) {
        pendingSmartBook.current = { slot: parsedSlot };
        return;
      }
      if (parsedSlot) setRestoredSlot(parsedSlot);
      routeSmartBookSignedIn();
      return;
    }

    // Restore the pre-selected slot so InteractiveShell can wire it as pendingSlot
    if (parsedSlot) setRestoredSlot(parsedSlot);

    // action=schedule-pack — from pago-exitoso after a pack purchase
    if (action === "schedule-pack") {
      setShowPackBooking(true);
      return;
    }

    // intent=<sessionType> — session card clicked before login
    if (intent && VALID_SESSION_TYPES.has(intent)) {
      setActiveSession(intent as SingleSessionType);
      return;
    }

    // intent=buy-pack — pack buy button clicked before login
    if (intent === "buy-pack") {
      if (packCredits > 0) {
        // User already has credits — skip purchase modal, go to booking
        setShowPackBooking(true);
      } else {
        const size = parseInt(sizeStr ?? "", 10);
        if (VALID_PACK_SIZES.has(size)) {
          setSelectedPack(size as PackSize);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, hasBookings]); // packCredits intentionally omitted — only needed at the moment of consumption

  // ── Auto-open after in-page sign-in (SignInGate overlay, no page reload) ──
  // Render-phase "adjust state on input change": fires when isSignedIn flips to
  // true (pendingSession is only ever set while signed out, then consumed here).
  const [prevSignedIn, setPrevSignedIn] = useState(isSignedIn);
  if (isSignedIn !== prevSignedIn) {
    setPrevSignedIn(isSignedIn);
    if (isSignedIn && pendingSession && !activeSession) {
      setActiveSession(pendingSession);
      setPendingSession(null);
      setSignInGateLabel("");
      setSignInCallbackUrl(undefined);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSessionClick(type: SingleSessionType) {
    if (!isSignedIn) {
      setPendingSession(type);
      setSignInGateLabel(SESSION_SIGNIN_LABELS[type]);
      setSignInCallbackUrl(`/?intent=${encodeURIComponent(type)}`);
      return;
    }
    setActiveSession(type);
  }

  function handlePackBuy(size: PackSize) {
    if (!isSignedIn) {
      setSignInGateLabel("actions.buyPack");
      setSignInCallbackUrl(`/?intent=buy-pack&packSize=${size}`);
      setSelectedPack(size);
      return;
    }
    setSelectedPack(size);
  }

  function handlePackSchedule() {
    if (!isSignedIn) {
      setSignInGateLabel("actions.schedulePackClass");
      setSignInCallbackUrl("/?action=schedule-pack");
      return;
    }
    setShowPackBooking(true);
  }

  /**
   * Internal: open the booking view that matches the current user state.
   * Caller is responsible for ensuring the user is signed in and hasBookings
   * has resolved before invoking.
   */
  function routeSmartBookSignedIn() {
    if (packCredits > 0) {
      setShowPackBooking(true);
      return;
    }
    setActiveSession(hasBookings ? "session1h" : "free15min");
  }

  function handleSmartBook(opts?: { slot?: SelectedSlot }) {
    const slot = opts?.slot;

    if (!isSignedIn) {
      const params = new URLSearchParams({ intent: "smart-book" });
      if (slot) encodeSlotParams(params, slot);
      setSignInGateLabel(slot ? "actions.bookChosenTime" : "actions.bookSession");
      setSignInCallbackUrl(`/?${params.toString()}`);
      return;
    }

    // Signed in but booking history still loading — park and resume in the
    // intent-consumer effect once hasBookings settles. Slot threading for
    // the in-page path is handled by InteractiveShell's pendingSlot state.
    if (hasBookings === null) {
      pendingSmartBook.current = { slot: null };
      return;
    }

    routeSmartBookSignedIn();
  }

  function handleSignInGateClose() {
    setPendingSession(null);
    setSignInGateLabel("");
    setSignInCallbackUrl(undefined);
    setSelectedPack(null);
  }

  function handleCreditsReady(_student: StudentInfo) {
    setSelectedPack(null);
  }

  function closePackBooking() {
    setShowPackBooking(false);
    setRescheduleToken(null);
  }

  function closeSession() {
    setActiveSession(null);
    setRescheduleToken(null);
  }

  // ── Reschedule wiring ──────────────────────────────────────────────────────

  function applyReschedule(type: string, token: string | null) {
    if (token) setRescheduleToken(token);
    if (type === "pack") {
      setShowPackBooking(true);
    } else if (VALID_SESSION_TYPES.has(type)) {
      setActiveSession(type as SingleSessionType);
    }
  }

  function setRescheduleSignInLabel(label: string) {
    setSignInGateLabel(label);
  }

  function showSignInGate(label: string, callbackUrl: string) {
    setSignInGateLabel(label);
    setSignInCallbackUrl(callbackUrl);
  }

  return {
    activeSession,
    showPackBooking,
    selectedPack,
    rescheduleToken,
    signInGateLabel,
    signInCallbackUrl,
    handleSessionClick,
    handlePackBuy,
    handlePackSchedule,
    handleSignInGateClose,
    handleCreditsReady,
    closePackBooking,
    closeSession,
    handleSmartBook,
    applyReschedule,
    setRescheduleSignInLabel,
    showSignInGate,
    restoredSlot,
  };
}
