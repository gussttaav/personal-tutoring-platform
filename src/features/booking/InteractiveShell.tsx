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

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useUserSession } from "@/hooks/useUserSession";
import { useBookingRouter } from "@/hooks/useBookingRouter";
import { useRescheduleIntent } from "@/hooks/useRescheduleIntent";
import PackModal from "@/components/PackModal";
import BookingModeViewComponent from "@/components/BookingModeView";
import SignInGate from "@/components/SignInGate";
import SingleSessionBooking from "@/components/SingleSessionBooking";
import AvailabilityModal from "@/components/AvailabilityModal";
import Chat from "@/components/Chat";
import { PACK_SIZES, PACK_CONFIG } from "@/constants";
import SessionCard from "./SessionCard";
import PackCard from "./PackCard";
import type { PackSize } from "@/domain/types";
import type { SelectedSlot } from "@/components/WeeklyCalendar";

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
  const { googleUser, isSignedIn, isAuthLoading, packSession, creditsLoading, updateCredits, hasBookings } =
    useUserSession();

  const router     = useBookingRouter(isSignedIn, packSession?.credits ?? 0, hasBookings);
  const reschedule = useRescheduleIntent(isSignedIn);

  const [showAvailabilityModal,  setShowAvailabilityModal]  = useState(false);
  const [pendingSlot,            setPendingSlot]            = useState<SelectedSlot | null>(null);
  const [packClientSecret,       setPackClientSecret]       = useState<string | null>(null);
  const [packCheckoutLoading,    setPackCheckoutLoading]    = useState<PackSize | null>(null);
  const packCheckoutInFlight = useRef(false);

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

  // Allow the Navbar to close booking overlays (logo / Mentoría clicks)
  useEffect(() => {
    const handler = (e: Event) => {
      const { scrollTo } = ((e as CustomEvent).detail ?? {}) as { scrollTo?: string };
      router.closePackBooking();
      router.closeSession();
      if (scrollTo) {
        setTimeout(() => {
          document.querySelector(scrollTo)?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    };
    window.addEventListener("close-booking-overlay", handler);
    return () => window.removeEventListener("close-booking-overlay", handler);
  }, [router.closePackBooking, router.closeSession]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Handle ?book= deep-link intent from /area-personal navigation.
  // Runs once on mount; removes the param from the URL to keep it clean.
  useEffect(() => {
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
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        initialSlot={(pendingSlot ?? router.restoredSlot) ?? undefined}
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
          onClose={() => { router.handleSignInGateClose(); reschedule.clearPendingReschedule(); }}
        />
      )}

      {router.selectedPack && isSignedIn && googleUser?.email && (
        <PackModal
          packSize={router.selectedPack}
          userEmail={googleUser.email}
          userName={googleUser.name ?? ""}
          initialClientSecret={packClientSecret ?? undefined}
          onClose={() => { router.handleSignInGateClose(); setPackClientSecret(null); packCheckoutInFlight.current = false; }}
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
          Sesiones individuales
        </p>
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#e5e1e4",
            marginBottom: "8px",
          }}
        >
          Elige tu modalidad de sesión
        </h2>
        <p style={{ fontSize: "14px", color: "#86948a", marginBottom: "32px" }}>
          Desde una exploración inicial gratuita hasta sesiones de trabajo intensivo.
        </p>

        {isAuthLoading ? (
          <div className="sessions-grid">
            <SessionCardSkeleton /><SessionCardSkeleton /><SessionCardSkeleton />
          </div>
        ) : (
          <div className="sessions-grid">
            <SessionCard
              badge="Gratis"
              name="Encuentro inicial"
              duration="15 minutos · Comentamos tu caso y definimos un plan de trabajo"
              price="Sin coste"
              isFree
              vertical
              onClick={() => router.handleSessionClick("free15min")}
            />
            <SessionCard
              badge="Más reservada"
              name="Sesión de 1 hora"
              duration="60 minutos · Resolución de dudas, proyecto o preparación de examen"
              price="€16"
              featured
              vertical
              onClick={() => router.handleSessionClick("session1h")}
            />
            <SessionCard
              name="Sesión de 2 horas"
              duration="120 minutos · Para temas que requieren mayor profundidad"
              price="€30"
              vertical
              onClick={() => router.handleSessionClick("session2h")}
            />
          </div>
        )}
      </section>

      {/* ── Divider ── */}
      <div
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
          margin: "56px 0",
        }}
      />

      {/* ── Packs section ── */}
      <section style={{ animation: "fadeUp 0.6s ease both 0.5s" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#4edea3",
            marginBottom: "10px",
          }}
        >
          Packs de continuidad
        </p>
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#e5e1e4",
            marginBottom: "8px",
          }}
        >
          Más horas, mejor precio.
        </h2>
        <p style={{ fontSize: "14px", color: "#86948a", marginBottom: "32px" }}>
          Reserva a tu ritmo durante 6 meses y ahorra respecto a las sesiones sueltas.
        </p>

        {isAuthLoading ? (
          <div className="packs-grid">
            <PackCardSkeleton /><PackCardSkeleton />
          </div>
        ) : (
          <div className="packs-grid">
            {PACK_SIZES.map((size) => {
              const cfg = PACK_CONFIG[size];
              const hasActiveCredits = (packSession?.credits ?? 0) > 0 && packSession?.packSize === size;
              return (
                <PackCard
                  key={size}
                  size={size}
                  price={cfg.price}
                  discount={"savingsPill" in cfg ? cfg.savingsPill : ""}
                  recommended={"recommended" in cfg && cfg.recommended}
                  activeCredits={creditsLoading ? null : hasActiveCredits ? (packSession?.credits ?? null) : null}
                  creditsLoading={creditsLoading && isSignedIn}
                  checkoutLoading={packCheckoutLoading === size}
                  onClick={async () => {
                    if (!isSignedIn) {
                      // Not signed in — show sign-in gate; after OAuth the modal
                      // will open normally (without pre-fetched clientSecret).
                      router.handlePackBuy(size as PackSize);
                      return;
                    }
                    if (packCheckoutInFlight.current) return;
                    packCheckoutInFlight.current = true;
                    setPackCheckoutLoading(size as PackSize);
                    try {
                      const { clientSecret } = await api.stripe.checkout({
                        type: "pack",
                        packSize: size as PackSize,
                      });
                      setPackClientSecret(clientSecret);
                      router.handlePackBuy(size as PackSize); // open modal after secret is ready
                    } catch {
                      // Checkout pre-fetch failed — open modal normally so the
                      // user can retry via the "Comprar" button inside it.
                      packCheckoutInFlight.current = false;
                      router.handlePackBuy(size as PackSize);
                    } finally {
                      setPackCheckoutLoading(null);
                    }
                  }}
                  onSchedule={router.handlePackSchedule}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Chat assistant ── */}
      <Chat />
    </>
  );
}
