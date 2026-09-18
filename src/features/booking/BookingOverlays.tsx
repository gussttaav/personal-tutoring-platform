"use client";

/**
 * BookingOverlays — the booking screens, mountable on any page.
 *
 * REDESIGN-P1-06: `<BookingProvider>` + the three overlay renders that used to live at the top
 * of `InteractiveShell.tsx` (the pack-booking full screen, `SingleSessionBooking`, and the
 * availability modal / sign-in gate / pack modal trio), moved verbatim. Mounted on `/` and on
 * `/mentoria`; on Mentoría the sessions/packs sections (`InteractiveShell`) are its children.
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
 */

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("booking.shell");
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
      <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column" }}>
        {/* Sticky top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            background: "rgba(19,19,21,0.90)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            position: "sticky",
            top: 0,
            zIndex: 100,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={router.closePackBooking}
              aria-label={t("back")}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#201f22",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#bbcabf",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                (e.currentTarget as HTMLElement).style.color = "#e5e1e4";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#bbcabf";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e1e4", fontFamily: "var(--font-headline, Manrope), sans-serif" }}>
                {t("bookPackClass")}
              </div>
              <div style={{ fontSize: 12, color: "#bbcabf" }}>{t("pickSlot")}</div>
            </div>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 100,
              fontSize: 11.5,
              fontWeight: 600,
              background: "rgba(99,179,237,0.1)",
              border: "1px solid rgba(99,179,237,0.25)",
              color: "#63b3ed",
            }}
          >
            {t("activePack")}
          </span>
        </div>

        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <BookingModeViewComponent
            student={packStudentInfo}
            rescheduleToken={router.rescheduleToken}
            onCreditsUpdated={updateCredits}
            onExit={() => { router.closePackBooking(); setPendingSlot(null); }}
            hideTopBar
            packTotal={packSession?.packSize ?? undefined}
            initialSlot={(pendingSlot ?? router.restoredSlot) ?? undefined}
          />
        </div>
      </div>
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
 * `<BookingOverlays>` alone on `/` (P1-04); `<BookingOverlays><InteractiveShell /></BookingOverlays>`
 * on `/mentoria`. One per page.
 */
export default function BookingOverlays({ children }: { children?: ReactNode }) {
  return (
    <BookingProvider>
      <Overlays />
      {children}
    </BookingProvider>
  );
}
