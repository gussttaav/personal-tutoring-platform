"use client";

/**
 * BookingProvider — the booking shell's brain, mountable on any page.
 *
 * REDESIGN-P1-06: split out of `InteractiveShell.tsx` so the booking overlays (calendar,
 * sign-in gate, wizard, pack booking) can open IN PLACE on `/` as well as on `/mentoria`,
 * without the sessions/packs sections. Everything below moved VERBATIM from the shell (its
 * `:83-231` as of P1-03) minus the reschedule hook: `useUserSession`, `useBookingRouter`, the
 * five state atoms, the five window listeners, the `?book=` consumer, the `restoredSlot` sync,
 * the buy-pack-after-OAuth reveal effect, `handleAvailabilitySlotSelected`, `packStudentInfo`.
 * Every effect, dependency array and `eslint-disable` travelled as a block — the shell's
 * «Logic: 100% IDENTICAL» promise holds across the split.
 *
 * The one genuinely new piece of state is `rescheduleGate`: `useRescheduleIntent` is the only
 * `useSearchParams()` in the booking code and must stay inside Mentoría's `Suspense` boundary
 * (or it drags a client-side-rendering bailout onto the home), so it now lives in
 * `RescheduleBridge` (mounted by the sections) and reaches the sign-in gate through this atom
 * instead of the direct `reschedule.*` reads the shell used to make.
 *
 * BOOKING-EXIT-01: the provider owns the booking's history entry (`useBookingHistory`). Any
 * booking surface on screen — the wizard, the pack screen, the availability calendar, the sign-in
 * gate, the pack purchase — counts as one: `bookingSurfaceOpen` mirrors the render conditions in
 * `BookingOverlays`, so moving from one surface to the next (availability → gate → wizard) stays
 * inside the same entry. Back, and a site link to this same page, run `closeAll`. The logo-only
 * `close-booking-overlay` listener that closed the two screens is gone: the hook handles that
 * event for every link now.
 *
 * Why a context, not events: the sections need the router (`handleSessionClick`,
 * `handlePackBuy`, `packClientSecret`, …) and the overlays need the SAME router instance — two
 * hook instances would be two sources of truth. Events remain the cross-component trigger
 * (Navbar, Footer, the heroes, `SpecializationsSection`), unchanged, but the state has one
 * owner. Mount it once per page: two providers would both hear `open-smart-book`.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { useUserSession } from "@/hooks/useUserSession";
import { useBookingRouter, type BookingRouterState } from "@/hooks/useBookingRouter";
import { useBookingHistory } from "@/hooks/useBookingHistory";
import type { PackSize, StudentInfo } from "@/domain/types";
import type { SelectedSlot } from "@/components/WeeklyCalendar";

/** What `RescheduleBridge` publishes for the sign-in gate when a reschedule link needs auth. */
export interface RescheduleGate {
  label:        string;
  callbackUrl?: string;
  clear:        () => void;
}

type UserSessionState = ReturnType<typeof useUserSession>;

export interface BookingContextValue {
  router:         BookingRouterState;
  googleUser:     UserSessionState["googleUser"];
  isSignedIn:     boolean;
  isAuthLoading:  boolean;
  packSession:    UserSessionState["packSession"];
  creditsLoading: boolean;
  updateCredits:  UserSessionState["updateCredits"];
  hasBookings:    boolean | null;

  showAvailabilityModal:    boolean;
  setShowAvailabilityModal: Dispatch<SetStateAction<boolean>>;
  pendingSlot:              SelectedSlot | null;
  setPendingSlot:           Dispatch<SetStateAction<SelectedSlot | null>>;
  packClientSecret:         string | null;
  setPackClientSecret:      Dispatch<SetStateAction<string | null>>;
  packCheckoutLoading:      PackSize | null;
  setPackCheckoutLoading:   Dispatch<SetStateAction<PackSize | null>>;
  packCheckoutInFlight:     RefObject<boolean>;
  rescheduleGate:           RescheduleGate | null;
  setRescheduleGate:        Dispatch<SetStateAction<RescheduleGate | null>>;

  handleAvailabilitySlotSelected: (slot: SelectedSlot) => void;
  packStudentInfo:                StudentInfo | null;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking() must be used inside <BookingProvider>");
  return ctx;
}

export function BookingProvider({ children }: { children?: ReactNode }) {
  const { googleUser, isSignedIn, isAuthLoading, packSession, creditsLoading, updateCredits, hasBookings } =
    useUserSession();

  const router = useBookingRouter(isSignedIn, packSession?.credits ?? 0, hasBookings);

  const [showAvailabilityModal,  setShowAvailabilityModal]  = useState(false);
  const [pendingSlot,            setPendingSlot]            = useState<SelectedSlot | null>(null);
  const [packClientSecret,       setPackClientSecret]       = useState<string | null>(null);
  const [packCheckoutLoading,    setPackCheckoutLoading]    = useState<PackSize | null>(null);
  const packCheckoutInFlight = useRef(false);
  const [rescheduleGate,         setRescheduleGate]         = useState<RescheduleGate | null>(null);

  // Allow the Navbar to trigger pack booking without prop drilling
  useEffect(() => {
    const handler = () => router.handlePackSchedule();
    window.addEventListener("open-pack-booking", handler);
    return () => window.removeEventListener("open-pack-booking", handler);
  }, [router.handlePackSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the unauthenticated availability modal (dispatched by HeroSection)
  useEffect(() => {
    const handler = () => setShowAvailabilityModal(true);
    window.addEventListener("open-availability-modal", handler);
    return () => window.removeEventListener("open-availability-modal", handler);
  }, []);

  // "Reservar sesión ahora" CTA — smart-routes to the right surface based on
  // auth + active pack + booking history.
  useEffect(() => {
    const handler = () => router.handleSmartBook();
    window.addEventListener("open-smart-book", handler);
    return () => window.removeEventListener("open-smart-book", handler);
  }, [router.handleSmartBook]); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct shortcut to the free 15-min booking (e.g. from SpecializationsSection)
  useEffect(() => {
    const handler = () => router.handleSessionClick("free15min");
    window.addEventListener("book-free-session", handler);
    return () => window.removeEventListener("book-free-session", handler);
  }, [router.handleSessionClick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ?book= deep-link intent from another page — today the course reader's `LessonCta`
  // (`smart`); /area-personal used to be the main producer and now opens the booking in place
  // (it mounts `BookingOverlays` itself — `features/personal-area/useBookingActions.ts` maps the
  // same intents to the same handlers as the switch below).
  // Removes the param from the URL to keep it clean; re-runs are no-ops because the
  // param is gone by the time the switch below has fired once.
  //
  // COURSE-P10-01: gated on auth having SETTLED, not on mount. NextAuth reports
  // `loading` on the first client render, so the old `[]` version consumed the param
  // while `isSignedIn` was still false. The session cases survived that — the gate
  // parks in `pendingSession` and self-heals when `isSignedIn` flips — but
  // `handleSmartBook` and `handlePackSchedule` have no such resume: they only set a
  // gate label, and the gate is suppressed at render once the user turns out to be
  // signed in, leaving nothing open at all. Only bit on a HARD load; a client-side
  // push carries an already-resolved SessionProvider from the shared layout.
  useEffect(() => {
    if (isAuthLoading) return;

    const params = new URLSearchParams(window.location.search);
    const book   = params.get("book");
    if (!book) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("book");
    window.history.replaceState({}, "", url.toString());

    switch (book) {
      case "free15min":  router.handleSessionClick("free15min"); break;
      case "session1h":  router.handleSessionClick("session1h"); break;
      case "session2h":  router.handleSessionClick("session2h"); break;
      case "pack":       router.handlePackSchedule(); break;
      case "pack5":      router.handlePackBuy(5); break;
      case "pack10":     router.handlePackBuy(10); break;
      // COURSE-P10-01: the landing hero's own CTA, reachable from another page.
      // Same handler the "open-smart-book" listener above calls.
      case "smart":      router.handleSmartBook(); break;
      // REDESIGN-P1-01: the home hero's «Ver disponibilidad», reachable from /. Same state
      // the "open-availability-modal" listener above sets.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the URL param once, after auth settles; not a derived-state cascade.
      case "availability": setShowAvailabilityModal(true); break;
    }
  }, [isAuthLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync restoredSlot (from URL params after OAuth) into pendingSlot.
  // Render-phase "adjust state on input change": restoredSlot flips from null to
  // a slot once, after the OAuth round-trip.
  const [prevRestoredSlot, setPrevRestoredSlot] = useState(router.restoredSlot);
  if (router.restoredSlot !== prevRestoredSlot) {
    setPrevRestoredSlot(router.restoredSlot);
    if (router.restoredSlot) setPendingSlot(router.restoredSlot);
  }

  // When a buy-pack OAuth intent sets selectedPack (because packCredits was 0
  // during intent consumption), but credits data loads and reveals an active pack,
  // dismiss the PackModal and open pack booking instead.
  // Guard: router.restoredSlot ensures this only fires for OAuth restores, not
  // regular authenticated "buy pack" clicks.
  useEffect(() => {
    if (creditsLoading) return;
    if (!router.selectedPack || !router.restoredSlot) return;
    if ((packSession?.credits ?? 0) <= 0) return;
    router.handleSignInGateClose();
    router.handlePackSchedule();
  }, [creditsLoading, packSession?.credits, router.selectedPack, router.restoredSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle a slot selected in AvailabilityModal — smart-routes to the right
  // surface (free trial / paid 1h / pack) based on user state, with the slot
  // threaded through pendingSlot for in-page flows and via callbackUrl for
  // the OAuth-restore flow.
  function handleAvailabilitySlotSelected(slot: SelectedSlot) {
    setShowAvailabilityModal(false);
    if (isSignedIn && googleUser?.email) {
      setPendingSlot(slot);
    }
    router.handleSmartBook({ slot });
  }

  const packStudentInfo = packSession
    ? { email: packSession.email, name: packSession.name, credits: packSession.credits }
    : googleUser?.email
      ? { email: googleUser.email, name: googleUser.name ?? "", credits: 0 }
      : null;

  // BOOKING-EXIT-01: one history entry while any booking surface is on screen. Each term is the
  // render condition of that surface in `BookingOverlays` (pack screen, wizard, availability
  // calendar, sign-in gate, pack purchase), so the entry exists exactly when something shows.
  const email = googleUser?.email;
  const bookingSurfaceOpen =
    (router.showPackBooking && !!packStudentInfo && !!email) ||
    (!!router.activeSession && !!email) ||
    showAvailabilityModal ||
    (!!(router.signInGateLabel || rescheduleGate?.label) && !isSignedIn) ||
    (!!router.selectedPack && isSignedIn && !!email);

  function closeAll() {
    router.closeSession();
    router.closePackBooking();
    router.handleSignInGateClose();
    rescheduleGate?.clear();
    setShowAvailabilityModal(false);
    setPendingSlot(null);
    setPackClientSecret(null);
    packCheckoutInFlight.current = false;
  }

  useBookingHistory(bookingSurfaceOpen, closeAll);

  const value: BookingContextValue = {
    router,
    googleUser,
    isSignedIn,
    isAuthLoading,
    packSession,
    creditsLoading,
    updateCredits,
    hasBookings,
    showAvailabilityModal,
    setShowAvailabilityModal,
    pendingSlot,
    setPendingSlot,
    packClientSecret,
    setPackClientSecret,
    packCheckoutLoading,
    setPackCheckoutLoading,
    packCheckoutInFlight,
    rescheduleGate,
    setRescheduleGate,
    handleAvailabilitySlotSelected,
    packStudentInfo,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}
