"use client";

/**
 * InteractiveShell
 *
 * The only client boundary on the landing page.
 *
 * ARCH-06: Refactored from a ~280-line god component into a thin orchestrator
 * that delegates to two purpose-built hooks:
 *
 *   useBookingRouter   — which view is active, sign-in gate state, all click
 *                        handlers (was: 7 useState + 2 useEffect + all handler fns)
 *   useRescheduleIntent — URL param parsing, reschedule state machine
 *                        (was: 3 useState + 3 useEffect blocks)
 *
 * This component now only wires auth state + the two hooks together and
 * renders the appropriate overlay. Adding a new booking flow type no longer
 * requires touching this file — it goes into useBookingRouter.
 *
 * UX-01 skeleton (Week 5) is preserved: auth loading skeletons are rendered
 * while isAuthLoading is true.
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
import { CreditsPill } from "@/components/ui";
import { COLORS, PACK_SIZES } from "@/constants";
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

  const router    = useBookingRouter(isSignedIn);
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
  const packStudentInfo = packSession
    ? { email: packSession.email, name: packSession.name, credits: packSession.credits }
    : googleUser?.email
      ? { email: googleUser.email, name: googleUser.name ?? "", credits: 0 }
      : null;

  if (router.showPackBooking && packStudentInfo && googleUser?.email) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 40, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          <CreditsPill credits={packStudentInfo.credits} />
          <button
            onClick={router.closePackBooking}
            style={{ fontSize: 13, color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "color 0.2s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = COLORS.textSecondary)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = COLORS.textMuted)}
            aria-label="Volver a la página principal"
          >
            ← Volver
          </button>
        </div>
        <div style={{ flex: 1, padding: "8px 0" }}>
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
  const combinedCallbackUrl = reschedule.pendingReschedule?.callbackUrl;

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

      <AuthCorner user={googleUser} packCredits={packSession?.credits ?? null} packSize={packSession?.packSize ?? null} />
      <Chat />
    </>
  );
}
