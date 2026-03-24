"use client";

/**
 * InteractiveShell
 *
 * The only client boundary on the landing page.
 *
 * ARCH-06: Refactored from a ~280-line god component into a thin orchestrator
 * that delegates to two purpose-built hooks:
 *
 *   useBookingRouter    — which view is active, sign-in gate state, handlers
 *   useRescheduleIntent — URL param parsing, reschedule state machine
 *
 * Changes in this version:
 *
 * 1. Passes packSession?.credits to useBookingRouter so it can correctly
 *    route the post-login buy-pack intent (booking view vs. purchase modal).
 *
 * 2. Passes router.signInCallbackUrl to SignInGate so the user's intent
 *    (encoded as ?intent=... or ?action=...) survives the Google OAuth round-
 *    trip and the correct view is opened on return.
 *
 * 3. Pack booking overlay: BookingModeView uses position:fixed which covers
 *    the whole screen including any parent-level back button. The back button
 *    is therefore rendered INSIDE the fixed overlay by InteractiveShell,
 *    pinned at the top via a sticky bar with z-index above the inner content.
 *    BookingModeView is always rendered with hideTopBar=true so its internal
 *    FullScreenShell header (which also has a back button) stays hidden and
 *    only our outer header is shown — on EVERY phase including the success
 *    and "book another" screens.
 */

import { useEffect } from "react";
import { useUserSession } from "@/hooks/useUserSession";
import { useBookingRouter } from "@/hooks/useBookingRouter";
import { useRescheduleIntent } from "@/hooks/useRescheduleIntent";
import PackModal from "@/components/PackModal";
import BookingModeViewComponent from "@/components/BookingModeView";
import SignInGate from "@/components/SignInGate";
import SingleSessionBooking from "@/components/SingleSessionBooking";
import AuthCorner from "@/components/AuthCorner";
import Chat from "@/components/Chat";
import { PACK_SIZES } from "@/constants";
import SessionCard from "./SessionCard";
import PackCard from "./PackCard";
import type { PackSize } from "@/types";

// ─── Skeleton atoms (UX-01) ───────────────────────────────────────────────────

function SessionCardSkeleton() {
  return (
    <div
      style={{ height: 72, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 10, animation: "skeletonPulse 1.4s ease-in-out infinite" }}
      aria-hidden="true"
    />
  );
}

function PackCardSkeleton() {
  return (
    <div
      style={{ flex: "1 1 200px", height: 160, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", animation: "skeletonPulse 1.4s ease-in-out infinite" }}
      aria-hidden="true"
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveShell() {
  const { googleUser, isSignedIn, isAuthLoading, packSession, creditsLoading, updateCredits } =
    useUserSession();

  const router     = useBookingRouter(isSignedIn, packSession?.credits ?? 0);
  const reschedule = useRescheduleIntent(isSignedIn);

  // Wire reschedule intent into the router once it resolves
  useEffect(() => {
    if (!reschedule.activeReschedule) return;
    const { type, token } = reschedule.activeReschedule;
    router.applyReschedule(type, token);
    reschedule.clearPendingReschedule();
  }, [reschedule.activeReschedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge the reschedule sign-in label into the router's gate state
  useEffect(() => {
    if (reschedule.signInLabel) {
      router.setRescheduleSignInLabel(reschedule.signInLabel);
    }
  }, [reschedule.signInLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pack booking overlay ──────────────────────────────────────────────────
  //
  // BookingModeView renders a position:fixed full-screen overlay internally
  // (via FullScreenShell). Any DOM rendered before it in the tree is covered.
  // We therefore render the back button INSIDE the fixed overlay using a
  // sticky bar that sits above the BookingModeView content (z-index: 50).
  // hideTopBar=true suppresses the duplicate back button inside BookingModeView.
  // This sticky bar persists across ALL phases (idle, selected, confirming,
  // success, error, "book another") because showPackBooking never changes
  // while the user is in the pack booking flow.
  const packStudentInfo = packSession
    ? { email: packSession.email, name: packSession.name, credits: packSession.credits }
    : googleUser?.email
      ? { email: googleUser.email, name: googleUser.name ?? "", credits: 0 }
      : null;

  if (router.showPackBooking && packStudentInfo && googleUser?.email) {
    return (
      // This div is position:fixed via BookingModeView's FullScreenShell —
      // we wrap it in a fragment and layer our sticky bar on top via z-index.
      <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column" }}>
        {/* Sticky top bar — always visible, sits above BookingModeView content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(13,15,16,0.85)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 100,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={router.closePackBooking}
              aria-label="Volver"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Reservar clase del pack</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Elige un día y hora disponible</div>
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
              fontWeight: 500,
              background: "rgba(99,179,237,0.1)",
              border: "1px solid rgba(99,179,237,0.25)",
              color: "#63b3ed",
            }}
          >
            Pack activo
          </span>
        </div>

        {/* BookingModeView fills the remaining space; its own top bar is hidden */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <BookingModeViewComponent
            student={packStudentInfo}
            rescheduleToken={router.rescheduleToken}
            onCreditsUpdated={updateCredits}
            onExit={router.closePackBooking}
            hideTopBar
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
        onBack={router.closeSession}
      />
    );
  }

  // ── Normal landing layer ──────────────────────────────────────────────────
  const combinedSignInLabel = router.signInGateLabel || reschedule.signInLabel;
  // Prefer the router's intent-encoded callbackUrl; fall back to the reschedule
  // callbackUrl if the sign-in was triggered by a reschedule link.
  const combinedCallbackUrl = router.signInCallbackUrl ?? reschedule.pendingReschedule?.callbackUrl;

  return (
    <>
      <style>{`
        @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>

      {combinedSignInLabel && !isSignedIn && (
        <SignInGate
          actionLabel={combinedSignInLabel}
          callbackUrl={combinedCallbackUrl}
          onClose={() => { router.handleSignInGateClose(); reschedule.clearPendingReschedule(); }}
        />
      )}

      {router.selectedPack && isSignedIn && googleUser?.email && (
        <PackModal
          packSize={router.selectedPack}
          userEmail={googleUser.email}
          userName={googleUser.name ?? ""}
          onClose={() => router.handleSignInGateClose()}
          onCreditsReady={router.handleCreditsReady}
        />
      )}

      {/* Sessions section */}
      <section id="sessions" style={{ animation: "fadeUp 0.6s ease both 0.45s" }}>
        <h2 style={{ fontFamily: "var(--font-serif), 'DM Serif Display', serif", fontSize: "clamp(22px, 4vw, 28px)", color: "var(--text)", marginBottom: 6 }}>
          Reserva una sesión
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Elige el formato que mejor se adapta a lo que necesitas.
        </p>

        {isAuthLoading ? (
          <><SessionCardSkeleton /><SessionCardSkeleton /><SessionCardSkeleton /></>
        ) : (
          <>
            <SessionCard badge="Gratis" name="Encuentro inicial" duration="⏱ 15 minutos · Comentamos tu caso y definimos un plan" price="Sin coste" isFree onClick={() => router.handleSessionClick("free15min")} />
            <SessionCard badge="Más reservada" name="Sesión de 1 hora" duration="⏱ 60 minutos · Resolución de dudas o proyecto" price="€16" featured onClick={() => router.handleSessionClick("session1h")} />
            <SessionCard name="Sesión de 2 horas" duration="⏱ 120 minutos · Para temas que requieren profundidad" price="€30" onClick={() => router.handleSessionClick("session2h")} />
          </>
        )}
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border), transparent)", margin: "32px 0" }} />

      {/* Packs section */}
      <section id="packs" style={{ animation: "fadeUp 0.6s ease both 0.55s" }}>
        <h2 style={{ fontFamily: "var(--font-serif), 'DM Serif Display', serif", fontSize: "clamp(22px, 4vw, 28px)", color: "var(--text)", marginBottom: 6 }}>
          Packs de horas
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Reserva por adelantado y ahorra. Válidos 6 meses desde la compra.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {isAuthLoading ? (
            <><PackCardSkeleton /><PackCardSkeleton /></>
          ) : (
            PACK_SIZES.map((size: PackSize) => (
              <PackCard
                key={size}
                size={size}
                activeCredits={creditsLoading ? null : (packSession?.credits ?? 0) > 0 && packSession?.packSize === size ? (packSession?.credits ?? null) : null}
                creditsLoading={creditsLoading && isSignedIn}
                onBuy={router.handlePackBuy}
                onSchedule={router.handlePackSchedule}
              />
            ))
          )}
        </div>
      </section>

      <AuthCorner 
        user={googleUser} 
        packCredits={packSession?.credits ?? null} 
        packSize={packSession?.packSize ?? null} 
        onSchedulePack={router.handlePackSchedule} 
      />
      <Chat />
    </>
  );
}
