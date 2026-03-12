"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useUserSession } from "@/hooks/useUserSession";
import { usePackPanel } from "@/hooks/usePackPanel";
import { useStickyButtons } from "@/hooks/useStickyButtons";
import SpeedDial from "@/components/SpeedDial";
import PackModal from "@/components/PackModal";
import PackPanel from "@/components/PackPanel";
import BookingModeView from "@/components/BookingModeView";
import { Spinner, CreditsPill } from "@/components/ui";
import { COLORS, getCalLink, PACK_SIZES } from "@/constants";
import type { PackSize, StudentInfo } from "@/types";

const CalComBooking = dynamic(() => import("@/components/CalComBooking"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: "580px" }}>
      <Spinner />
      <p className="text-sm" style={{ color: COLORS.textSecondary }}>Cargando calendario...</p>
    </div>
  ),
});

const CAL_LINK = getCalLink(process.env.NEXT_PUBLIC_CAL_URL);
const CAL_EVENT_LINK = getCalLink(
  process.env.NEXT_PUBLIC_CAL_EVENT_SLUG ??
    `${process.env.NEXT_PUBLIC_CAL_URL ?? "https://cal.com/gustavo-torres"}/pack-1-hora`
);

// ─── Page ─────────────────────────────────────────────────────────────────────

function HomeContent() {
  const { session, startSession, updateCredits, clearSession } = useUserSession();
  const {
    dialOpen, activePanel,
    toggleDial, closeDial,
    togglePanel, closePanel,
    btn5Ref, btn10Ref,
  } = usePackPanel();
  const { cardRef, isSticky, fixedRight, fixedTop } = useStickyButtons(0);
  const [selectedPack, setSelectedPack] = useState<PackSize | null>(null);
  const [calAtRoot, setCalAtRoot] = useState(true);
  const [calKey, setCalKey] = useState(0);

  const dialContainerRef = useRef<HTMLDivElement>(null);
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  const itemRefs: Record<PackSize, React.RefObject<HTMLButtonElement>> = {
    5:  btn5Ref  as React.RefObject<HTMLButtonElement>,
    10: btn10Ref as React.RefObject<HTMLButtonElement>,
  };

  // Outside-click handler for speed dial
  useEffect(() => {
    if (!dialOpen) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideDial  = dialContainerRef.current?.contains(target) ?? false;
      const insidePanel = activePanelRef.current?.contains(target) ?? false;
      if (!insideDial && !insidePanel) closeDial();
    }
    window.addEventListener("click", onOutside);
    return () => window.removeEventListener("click", onOutside);
  }, [dialOpen, closeDial]);

  useEffect(() => {
    if (!calAtRoot) closeDial();
  }, [calAtRoot, closeDial]);

  function handleBackToRoot() {
    setCalAtRoot(true);
    setCalKey((k) => k + 1);
  }

  function handleCreditsReady(student: StudentInfo) {
    closeDial();
    setSelectedPack(null);
    startSession(student);
  }

  // Speed dial floats in the top-bar area.
  // When sticky (page scrolled) it goes fixed at the same right-edge position.
  const dialContainerStyle: React.CSSProperties = isSticky
    ? { position: "fixed", top: fixedTop + 12, right: fixedRight, zIndex: 50 }
    : { position: "absolute", top: "117px", right: "25px", zIndex: 20 };

  const calDimmed = dialOpen || !!activePanel;
  const showDial  = !session && calAtRoot;

  return (
    // Full-viewport background, no padding — card is flush
    <main className="min-h-screen" style={{ backgroundColor: COLORS.background }}>

      {/* ── Card — full width, flush on mobile, centred+rounded on ≥md ── */}
      <div className="md:max-w-3xl md:mx-auto md:py-8 md:px-4">
        <div
          ref={cardRef}
          className="relative overflow-visible rounded-none md:rounded-2xl"
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            minHeight: "100dvh",
          }}
        >

          {/* ── Unified top bar ── */}
          <div
            className="px-4 sm:px-5 border-b"
            style={{ borderColor: COLORS.border }}
          >
            {session ? (
              <>
                {/*
                  SESSION MODE
                  ─────────────────────────────────────────────────────────────
                  Mobile  (< sm): two rows
                    Row 1 — logo left · ← Volver al inicio right
                    Row 2 — user name left · CreditsPill right

                  Desktop (≥ sm): single row
                    logo · PlanetaG · separator · user name  ←→  pill · back
                */}

                {/* Mobile row 1 / Desktop single row — logo + back */}
                <div className="flex items-center justify-between py-3">
                  {/* Logo */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Image
                      src="/logo.svg"
                      alt="PlanetaG logo"
                      width={28}
                      height={28}
                      priority
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight truncate">
                        PlanetaG
                      </p>
                      {/* Subtitle visible on desktop only — row 2 handles mobile */}
                      <p className="hidden sm:block text-xs leading-tight truncate" style={{ color: COLORS.textSecondary }}>
                        {session.name}
                      </p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Pill visible on desktop inline; on mobile it's in row 2 */}
                    <span className="hidden sm:block">
                      <CreditsPill credits={session.credits} />
                    </span>
                    <button
                      onClick={clearSession}
                      className="text-xs transition-colors"
                      style={{ color: COLORS.textMuted }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textSecondary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
                    >
                      ← Volver al inicio
                    </button>
                  </div>
                </div>

                {/* Mobile row 2 — user name left · pill right */}
                <div
                  className="flex items-center justify-between pb-2.5 sm:hidden"
                >
                  <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
                    {session.name}
                  </p>
                  <CreditsPill credits={session.credits} />
                </div>
              </>
            ) : (
              <>
                {/*
                  BROWSE / BOOKER MODE
                  Single row in all cases — only one action at most on the right.
                */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Image
                      src="/logo.svg"
                      alt="PlanetaG logo"
                      width={28}
                      height={28}
                      priority
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight truncate">
                        PlanetaG
                      </p>
                      <p className="text-xs leading-tight truncate" style={{ color: COLORS.textSecondary }}>
                        Gustavo Torres Guerrero
                      </p>
                    </div>
                  </div>

                  {!calAtRoot && (
                    <button
                      onClick={handleBackToRoot}
                      className="text-xs transition-colors flex-shrink-0"
                      style={{ color: COLORS.textMuted }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textSecondary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
                    >
                      ← Volver al inicio
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Browse mode ── */}
          {!session && (
            <>
              {/* Speed dial — overlays the top-right of the card */}
              {showDial && (
                <SpeedDial
                  containerRef={dialContainerRef}
                  isOpen={dialOpen}
                  activePanel={activePanel}
                  itemRefs={itemRefs}
                  onToggleDial={toggleDial}
                  onTogglePanel={togglePanel}
                  onClose={closeDial}
                  containerStyle={dialContainerStyle}
                />
              )}

              {/* Calendar */}
              <div style={{
                opacity: calDimmed ? 0.3 : 1,
                transition: "opacity 0.3s ease",
                pointerEvents: calDimmed ? "none" : "auto",
              }}>
                <CalComBooking
                  key={calKey}
                  calLink={CAL_LINK}
                  theme="dark"
                  brandColor={COLORS.brand}
                  onAtRoot={setCalAtRoot}
                />
              </div>

              {/* Pack detail panels */}
              {PACK_SIZES.map((size) => (
                <PackPanel
                  key={size}
                  size={size}
                  isOpen={activePanel === size}
                  anchorRef={itemRefs[size]}
                  onClose={closePanel}
                  onPanelRef={(el) => { activePanelRef.current = el; }}
                  onBuy={() => {
                    setSelectedPack(size);
                    setTimeout(closeDial, 0);
                  }}
                />
              ))}
            </>
          )}

          {/* ── Booking mode ── */}
          {session && (
            // BookingModeView has its own top bar (credits + exit) — we hide
            // that inner bar since the unified top bar above now handles it.
            <BookingModeView
              student={session}
              calLink={CAL_EVENT_LINK}
              onCreditsUpdated={updateCredits}
              onExit={clearSession}
              hideTopBar
            />
          )}
        </div>
      </div>

      {/* Pack purchase modal */}
      {selectedPack && (
        <PackModal
          packSize={selectedPack}
          onClose={() => setSelectedPack(null)}
          onCreditsReady={handleCreditsReady}
        />
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.background }}>
          <Spinner />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
