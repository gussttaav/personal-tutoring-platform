"use client";

/**
 * BookingOverlays — the booking screens, mountable on any page.
 *
 * REDESIGN-P1-06: `<BookingProvider>` + the three overlay renders that used to live at the top
 * of `InteractiveShell.tsx` (the pack-booking full screen, `SingleSessionBooking`, and the
 * availability modal / sign-in gate / pack modal trio), moved verbatim. Mounted on `/`, on
 * `/mentoria` and on `/area-personal`; on Mentoría the sessions/packs sections
 * (`InteractiveShell`) are its children, on the personal area the dashboard is (its CTAs call
 * the router through `useBooking()` — see `features/personal-area/useBookingActions.ts`).
 *
 * The heavy overlays come in through `next/dynamic` with `ssr: false`: the home is a marketing
 * page and its first-load JS should not carry the weekly calendar, the three-step wizard and
 * the pack booking view for a click most visitors never make. They are state-gated and never
 * in the server HTML, so `ssr: false` changes nothing visible; the `loading` spinner covers the
 * OAuth-return case where an overlay opens on first paint. `SignInGate` stays static (small,
 * and the first thing a signed-out visitor sees after a CTA).
 *
 * The sign-in gate reads the router's label/callbackUrl OR the reschedule bridge's
 * (`rescheduleGate`), exactly the `router.* || reschedule.*` merge the shell did — see
 * `RescheduleBridge.tsx` for why the reschedule hook can't sit next to the router any more.
 *
 * Do not render `<Chat />` from here: the sections render it on `/mentoria`, and P1-04 mounts
 * it on `/` separately — one FAB per page.
 *
 * The pack booking screen is `BookingModeView` on its own: it renders `BookingLayout`, which is
 * the whole screen (fixed to the viewport, its own Navbar, the sidebar + calendar, the bottom
 * «Cambiar tipo de sesión» exit) — exactly like the single-session wizard. It used to be wrapped
 * in a `position: fixed; inset: 0; z-index: 40` div that drew a sticky top bar (back button,
 * title, «Pack activo» badge) at y=0 — a relic of the pre-`BookingLayout` screen, which had no
 * navbar or sidebar. The page Navbar is `fixed z-50` over the whole z-40 overlay, so that bar sat
 * under the navbar: invisible, and its back button unreachable (`elementFromPoint` returned the
 * navbar's logo, which closes the overlay AND navigates to `/`). Everything the bar said or did
 * the layout already covers (sidebar, calendar header, bottom exit), so it is gone rather than
 * moved; the overlay keeps the z-index 40 contract that `HomeChat` / `InteractiveShell` rely on.
 */

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Spinner } from "@/components/ui";
import SignInGate from "@/components/SignInGate";
import { BookingProvider, useBooking } from "./BookingProvider";

// ─── Lazy overlays ─────────────────────────────────────────────────────────────
// Module scope, as `next/dynamic` with `ssr: false` requires.

function OverlayLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(19,19,21,0.6)",
      }}
    >
      <Spinner />
    </div>
  );
}

const SingleSessionBooking = dynamic(
  () => import("@/components/SingleSessionBooking"),
  { ssr: false, loading: OverlayLoading },
);
const BookingModeViewComponent = dynamic(
  () => import("@/components/BookingModeView"),
  { ssr: false, loading: OverlayLoading },
);
const AvailabilityModal = dynamic(
  () => import("@/components/AvailabilityModal"),
  { ssr: false, loading: OverlayLoading },
);
const PackModal = dynamic(
  () => import("@/components/PackModal"),
  { ssr: false, loading: OverlayLoading },
);

// ─── Overlays ──────────────────────────────────────────────────────────────────

function Overlays() {
  const navigation = useRouter();
  const pathname = usePathname();
  const {
    router,
    googleUser,
    isSignedIn,
    packSession,
    updateCredits,
    showAvailabilityModal,
    setShowAvailabilityModal,
    pendingSlot,
    setPendingSlot,
    packClientSecret,
    setPackClientSecret,
    packCheckoutInFlight: packCheckoutInFlightRef,
    rescheduleGate,
    handleAvailabilitySlotSelected,
    packStudentInfo,
  } = useBooking();

  // ── Pack booking overlay ──────────────────────────────────────────────────
  if (router.showPackBooking && packStudentInfo && googleUser?.email) {
    return (
      <BookingModeViewComponent
        student={packStudentInfo}
        rescheduleToken={router.rescheduleToken}
        onCreditsUpdated={updateCredits}
        onExit={() => { router.closePackBooking(); setPendingSlot(null); }}
        packTotal={packSession?.packSize ?? undefined}
        initialSlot={(pendingSlot ?? router.restoredSlot) ?? undefined}
      />
    );
  }

  // ── Single session booking overlay ────────────────────────────────────────
  if (router.activeSession && googleUser?.email) {
    return (
      <SingleSessionBooking
        sessionType={router.activeSession}
        userName={googleUser.name ?? ""}
        userEmail={googleUser.email}
        rescheduleToken={router.rescheduleToken}
        onBack={() => { router.closeSession(); setPendingSlot(null); }}
        // «Cambiar tipo de sesión» leads to the session types: on /mentoria they are right under
        // the wizard, so closing it is enough; from any other page (`/`) there is nothing to
        // change to, so it navigates to /mentoria. Not `#sessions`: the sections render
        // client-side inside Mentoría's Suspense boundary, after Next has already applied the hash.
        onChangeSessionType={() => {
          router.closeSession();
          setPendingSlot(null);
          if (pathname !== "/mentoria") navigation.push("/mentoria");
        }}
        // The success screen's «Ir a mi área personal» navigates there — except on the personal
        // area itself, where the page is right under the wizard: closing it is the whole trip
        // (`PersonalArea` revalidates its list on that close).
        onGoToPersonalArea={
          pathname === "/area-personal"
            ? () => { router.closeSession(); setPendingSlot(null); }
            : undefined
        }
        initialSlot={(pendingSlot ?? router.restoredSlot) ?? undefined}
      />
    );
  }

  // ── Normal landing layer ──────────────────────────────────────────────────
  const combinedSignInLabel = router.signInGateLabel || rescheduleGate?.label;
  const combinedCallbackUrl = router.signInCallbackUrl ?? rescheduleGate?.callbackUrl;

  return (
    <>
      {showAvailabilityModal && (
        <AvailabilityModal
          onClose={() => setShowAvailabilityModal(false)}
          onSlotSelected={handleAvailabilitySlotSelected}
        />
      )}

      {combinedSignInLabel && !isSignedIn && (
        <SignInGate
          actionLabel={combinedSignInLabel}
          callbackUrl={combinedCallbackUrl}
          onClose={() => { router.handleSignInGateClose(); rescheduleGate?.clear(); }}
        />
      )}

      {router.selectedPack && isSignedIn && googleUser?.email && (
        <PackModal
          packSize={router.selectedPack}
          userEmail={googleUser.email}
          userName={googleUser.name ?? ""}
          initialClientSecret={packClientSecret ?? undefined}
          onClose={() => { router.handleSignInGateClose(); setPackClientSecret(null); packCheckoutInFlightRef.current = false; }}
        />
      )}
    </>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

/**
 * `<BookingOverlays><HomeChat /></BookingOverlays>` on `/` (P1-04: the chat FAB is its only
 * child there, gated on the overlays like the sections are);
 * `<BookingOverlays><InteractiveShell /></BookingOverlays>` on `/mentoria`;
 * `<BookingOverlays><PersonalArea /></BookingOverlays>` on `/area-personal`. One per page.
 */
export default function BookingOverlays({ children }: { children?: ReactNode }) {
  return (
    <BookingProvider>
      <Overlays />
      {children}
    </BookingProvider>
  );
}
