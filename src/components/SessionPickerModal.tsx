"use client";

/**
 * SessionPickerModal — lightweight modal that shows the session/pack picker
 * without a preceding calendar step.
 *
 * Used by the "Reservar sesión ahora" CTA in HeroSection.
 * The AvailabilityModal (with full calendar) is a separate component.
 */

import { useState, useEffect } from "react";
import SessionPickerContent, { type SessionChoice } from "@/components/SessionPickerContent";

interface SessionPickerModalProps {
  onClose:           () => void;
  onSessionSelected: (choice: SessionChoice) => void;
  isSignedIn:        boolean;
  activePackSize:    5 | 10 | null;
}

export default function SessionPickerModal({
  onClose,
  onSessionSelected,
  isSignedIn,
  activePackSize,
}: SessionPickerModalProps) {
  const [selectedChoice, setSelectedChoice] = useState<SessionChoice | null>(null);
  const [isMobile,       setIsMobile]       = useState(false);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Body scroll lock + Escape key
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function ctaLabel(choice: SessionChoice): string {
    if (choice.kind === "session") return "Reservar →";
    if (isSignedIn && activePackSize === choice.size) return "Reservar →";
    return "Comprar pack →";
  }

  function handleConfirm() {
    if (!selectedChoice) return;
    onSessionSelected(selectedChoice);
    onClose();
  }

  const NAVBAR_H = 64;

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:      "relative",
        width:         "100%",
        maxHeight:     `calc(100dvh - ${NAVBAR_H}px)`,
        background:    "#1c1b1d",
        borderRadius:  "24px 24px 0 0",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availSheetUp 0.25s ease both",
      }
    : {
        position:      "relative",
        width:         "min(560px, 95vw)",
        maxHeight:     "90vh",
        background:    "#1c1b1d",
        borderRadius:  "24px",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availFadeUp 0.22s ease both",
        boxShadow:     "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
      };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:             "fixed",
          inset:                0,
          zIndex:               60,
          background:           "rgba(0,0,0,0.75)",
          backdropFilter:       "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          display:              "flex",
          alignItems:           isMobile ? "flex-end" : "center",
          justifyContent:       "center",
          padding:              isMobile ? `${NAVBAR_H}px 0 0` : "20px",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Reservar sesión"
      >
        {/* Panel */}
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "16px 20px 14px",
              borderBottom:   "1px solid rgba(255,255,255,0.05)",
              flexShrink:     0,
              gap:            12,
            }}
          >
            <span style={{
              fontSize:   14,
              fontWeight: 600,
              color:      "#e5e1e4",
              fontFamily: "var(--font-headline, Manrope), sans-serif",
            }}>
              Elige tu sesión
            </span>

            <button
              onClick={onClose}
              style={{
                display:    "flex",
                alignItems: "center",
                justifyContent: "center",
                width:      32,
                height:     32,
                background: "none",
                border:     "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                cursor:     "pointer",
                color:      "#86948a",
                padding:    0,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#86948a"; }}
              aria-label="Cerrar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <SessionPickerContent
              isMobile={isMobile}
              isSignedIn={isSignedIn}
              activePackSize={activePackSize}
              selectedChoice={selectedChoice}
              onSelect={setSelectedChoice}
              ctaLabel={ctaLabel}
              onConfirm={handleConfirm}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes availFadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes availSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .chat-fab { display: none !important; }
      `}</style>
    </>
  );
}
