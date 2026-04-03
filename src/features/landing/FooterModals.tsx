"use client";

/**
 * FooterModals — Emerald Nocturne reskin
 *
 * Behaviour: IDENTICAL to original — opens policy modals on click.
 * Change: link styling updated to new design tokens.
 * The modal overlay itself is also reskinned to use surface-container-highest + backdrop-blur.
 *
 * Used by: Footer.tsx (new), and still works standalone if needed.
 */

import { useState } from "react";
import {
  CancelacionContent,
  TerminosContent,
  PrivacidadContent,
} from "@/components/policy/PolicyContent";

type ModalKey = "cancelacion" | "terminos" | "privacidad" | null;

const LINK_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  color: "#86948a",
  textDecoration: "none",
  transition: "color 0.15s",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  padding: 0,
  marginBottom: "14px",
};

export default function FooterModals() {
  const [open, setOpen] = useState<ModalKey>(null);

  function close() {
    setOpen(null);
    document.body.style.overflow = "";
  }

  function openModal(key: ModalKey) {
    setOpen(key);
    document.body.style.overflow = "hidden";
  }

  const hoverGreen = (e: React.MouseEvent) =>
    ((e.currentTarget as HTMLElement).style.color = "#4edea3");
  const unhover = (e: React.MouseEvent) =>
    ((e.currentTarget as HTMLElement).style.color = "#86948a");

  return (
    <>
      {/* ── Links ── */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li>
          <button
            onClick={() => openModal("cancelacion")}
            style={LINK_STYLE}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            Política de cancelación
          </button>
        </li>
        <li>
          <button
            onClick={() => openModal("terminos")}
            style={LINK_STYLE}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            Términos de servicio
          </button>
        </li>
        <li>
          <button
            onClick={() => openModal("privacidad")}
            style={{ ...LINK_STYLE, marginBottom: 0 }}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            Política de privacidad
          </button>
        </li>
      </ul>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && close()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "80vh",
              borderRadius: "16px",
              background: "rgba(53,52,55,0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-headline, Manrope), sans-serif",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#e5e1e4",
                  margin: 0,
                }}
              >
                {open === "cancelacion" && "Política de cancelación"}
                {open === "terminos" && "Términos de servicio"}
                {open === "privacidad" && "Política de privacidad"}
              </h2>
              <button
                onClick={close}
                aria-label="Cerrar"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#86948a",
                  display: "flex",
                  padding: "4px",
                  borderRadius: "6px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e5e1e4")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#86948a")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div
              className="policy-body"
              style={{
                overflowY: "auto",
                padding: "24px",
                flex: 1,
              }}
            >
              {open === "cancelacion" && <CancelacionContent />}
              {open === "terminos" && <TerminosContent />}
              {open === "privacidad" && <PrivacidadContent />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
