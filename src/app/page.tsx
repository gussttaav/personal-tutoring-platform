"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useUserSession } from "@/hooks/useUserSession";
import { usePackPanel } from "@/hooks/usePackPanel";
import { useStickyButtons } from "@/hooks/useStickyButtons";
import SpeedDial from "@/components/SpeedDial";
import PackModal from "@/components/PackModal";
import PackPanel from "@/components/PackPanel";
import BookingModeView from "@/components/BookingModeView";
import { Spinner } from "@/components/ui";
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
  const { cardRef, isSticky, fixedRight, fixedTop } = useStickyButtons(16);
  const [selectedPack, setSelectedPack] = useState<PackSize | null>(null);

  // true = user is on the root event-listing view; false = inside the booker
  const [calAtRoot, setCalAtRoot] = useState(true);
  // Incrementing this key remounts CalComBooking, resetting it to the root view
  const [calKey, setCalKey] = useState(0);

  const dialContainerRef = useRef<HTMLDivElement>(null);
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  const itemRefs: Record<PackSize, React.RefObject<HTMLButtonElement>> = {
    5:  btn5Ref  as React.RefObject<HTMLButtonElement>,
    10: btn10Ref as React.RefObject<HTMLButtonElement>,
  };

  // Single outside-click handler — uses 'click' (fires after onClick)
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

  // When the user enters the booker, close the dial cleanly
  useEffect(() => {
    if (!calAtRoot) closeDial();
  }, [calAtRoot, closeDial]);

  function handleBackToRoot() {
    setCalAtRoot(true);
    setCalKey((k) => k + 1); // remount CalComBooking → returns to event listing
  }

  function handleCreditsReady(student: StudentInfo) {
    closeDial();
    setSelectedPack(null);
    startSession(student);
  }

  const dialContainerStyle: React.CSSProperties = isSticky
    ? { position: "fixed", top: fixedTop, right: fixedRight, zIndex: 50 }
    : { position: "absolute", top: "67px", right: "25px", zIndex: 20 };

  const calDimmed = dialOpen || !!activePanel;
  const showDial = !session && calAtRoot;

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.background }}>

      {/* ── Header ── */}
      <header
        className="border-b py-4 sm:py-5 px-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
              Gustavo Torres Guerrero
            </h1>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              Profesor y consultor independiente
            </p>
          </div>
          {session && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs truncate max-w-[120px] sm:max-w-none" style={{ color: COLORS.textSecondary }}>
                Hola, {session.name}
              </p>
              <p className="text-lg font-bold" style={{ color: COLORS.brand }}>
                {session.credits} clase{session.credits !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto py-6 sm:py-8">
        <div
          ref={cardRef}
          className="rounded-none sm:rounded-2xl overflow-visible relative border-0 sm:border"
          style={{
            backgroundColor: COLORS.surface,
            borderColor: COLORS.border,
            minHeight: "580px",
          }}
        >
          {!session && (
            <>
              {/* Back bar — shown once user enters the booker */}
              {!calAtRoot && (
                <div
                  className="flex items-center px-4 sm:px-5 py-3 border-b"
                  style={{ borderColor: COLORS.border }}
                >
                  <button
                    onClick={handleBackToRoot}
                    className="text-xs transition-colors"
                    style={{ color: COLORS.textMuted }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textSecondary)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
                  >
                    ← Volver al inicio
                  </button>
                </div>
              )}

              {/* Speed dial — only on root view */}
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

          {session && (
            <BookingModeView
              student={session}
              calLink={CAL_EVENT_LINK}
              onCreditsUpdated={updateCredits}
              onExit={clearSession}
            />
          )}
        </div>
      </div>

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
