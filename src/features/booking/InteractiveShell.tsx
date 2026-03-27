"use client";

/**
 * InteractiveShell — Emerald Nocturne reskin
 *
 * Logic: 100% IDENTICAL to original.
 * Changes: UI tokens only — inline styles updated to Emerald Nocturne palette.
 *
 * All hooks, handlers, routing logic, and overlays are preserved verbatim.
 * The only modifications are:
 *   - Color values (--bg → #131315, --green → #4edea3, etc.)
 *   - Section typography (Manrope headlines)
 *   - Skeleton pulse animation retains same timing
 */

import { useEffect } from "react";
import { useUserSession } from "@/hooks/useUserSession";
import { useBookingRouter } from "@/hooks/useBookingRouter";
import { useRescheduleIntent } from "@/hooks/useRescheduleIntent";
import PackModal from "@/components/PackModal";
import BookingModeViewComponent from "@/components/BookingModeView";
import SignInGate from "@/components/SignInGate";
import SingleSessionBooking from "@/components/SingleSessionBooking";
import Chat from "@/components/Chat";
import { PACK_SIZES, PACK_CONFIG } from "@/constants";
import SessionCard from "./SessionCard";
import PackCard from "./PackCard";
import type { PackSize } from "@/types";

// ─── Skeleton atoms ────────────────────────────────────────────────────────────

function SessionCardSkeleton() {
  return (
    <div
      style={{
        height: 80,
        borderRadius: 10,
        background: "#2a2a2c",
        marginBottom: 10,
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

function PackCardSkeleton() {
  return (
    <div
      style={{
        flex: "1 1 200px",
        height: 180,
        borderRadius: 12,
        background: "#2a2a2c",
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveShell() {
  const { googleUser, isSignedIn, isAuthLoading, packSession, updateCredits } =
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

  // Allow the Navbar to trigger pack booking without prop drilling
  useEffect(() => {
    const handler = () => router.handlePackSchedule();
    window.addEventListener("open-pack-booking", handler);
    return () => window.removeEventListener("open-pack-booking", handler);
  }, [router.handlePackSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const packStudentInfo = packSession
    ? { email: packSession.email, name: packSession.name, credits: packSession.credits }
    : googleUser?.email
      ? { email: googleUser.email, name: googleUser.name ?? "", credits: 0 }
      : null;

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
            borderBottom: "1px solid rgba(255,255,255,0.05)",
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
              aria-label="Volver"
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
                Reservar clase del pack
              </div>
              <div style={{ fontSize: 12, color: "#bbcabf" }}>Elige un día y hora disponible</div>
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
            Pack activo
          </span>
        </div>

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

      {/* ── Sessions section ── */}
      <section id="sessions" style={{ animation: "fadeUp 0.6s ease both 0.3s" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#4edea3",
            marginBottom: "10px",
          }}
        >
          Reserva una sesión
        </p>
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(1.3rem, 3.5vw, 1.8rem)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "#e5e1e4",
            marginBottom: "6px",
          }}
        >
          Elige el formato que mejor se adapta a ti
        </h2>
        <p style={{ fontSize: "13.5px", color: "#86948a", marginBottom: "24px" }}>
          Desde una sesión exploratoria gratuita hasta packs con descuento.
        </p>

        {isAuthLoading ? (
          <><SessionCardSkeleton /><SessionCardSkeleton /><SessionCardSkeleton /></>
        ) : (
          <>
            <SessionCard
              badge="Gratis"
              name="Encuentro inicial"
              duration="⏱ 15 minutos · Comentamos tu caso y definimos un plan"
              price="Sin coste"
              isFree
              onClick={() => router.handleSessionClick("free15min")}
            />
            <SessionCard
              badge="Más reservada"
              name="Sesión de 1 hora"
              duration="⏱ 60 minutos · Resolución de dudas o proyecto"
              price="€16"
              featured
              onClick={() => router.handleSessionClick("session1h")}
            />
            <SessionCard
              name="Sesión de 2 horas"
              duration="⏱ 120 minutos · Para temas que requieren profundidad"
              price="€30"
              onClick={() => router.handleSessionClick("session2h")}
            />
          </>
        )}
      </section>

      {/* ── Divider ── */}
      <div
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
          margin: "36px 0",
        }}
      />

      {/* ── Packs section ── */}
      <section style={{ animation: "fadeUp 0.6s ease both 0.5s" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#4edea3",
            marginBottom: "10px",
          }}
        >
          Packs de clases
        </p>
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(1.3rem, 3.5vw, 1.8rem)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "#e5e1e4",
            marginBottom: "6px",
          }}
        >
          Compromiso a largo plazo, precio a medida
        </h2>
        <p style={{ fontSize: "13.5px", color: "#86948a", marginBottom: "24px" }}>
          Compra horas con descuento y resérvalas a tu ritmo durante 6 meses.
        </p>

        {isAuthLoading ? (
          <div style={{ display: "flex", gap: 12 }}>
            <PackCardSkeleton /><PackCardSkeleton />
          </div>
        ) : (
          PACK_SIZES.map((size) => {
            const cfg = PACK_CONFIG[size];
            return (
              <PackCard
                key={size}
                size={size}
                price={cfg.price}
                discount={cfg.discount}
                recommended={"recommended" in cfg && cfg.recommended}
                onClick={() => router.handlePackBuy(size as PackSize)}
              />
            );
          })
        )}
      </section>

      {/* ── Chat assistant ── */}
      <Chat />
    </>
  );
}
