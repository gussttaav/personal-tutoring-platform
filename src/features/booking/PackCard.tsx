"use client";

import type { PackSize } from "@/domain/types";
import { PACK_CONFIG } from "@/constants";

interface PackCardProps {
  size: PackSize;
  price: string;
  discount: string;
  recommended?: boolean;
  activeCredits: number | null;
  creditsLoading: boolean;
  /** True while the parent is pre-fetching the PaymentIntent for this card */
  checkoutLoading?: boolean;
  onClick: () => void;
  onSchedule: () => void;
}

export default function PackCard({
  size,
  recommended = false,
  activeCredits,
  creditsLoading,
  checkoutLoading = false,
  onClick,
  onSchedule,
}: PackCardProps) {
  const cfg = PACK_CONFIG[size];
  const hasCredits = !creditsLoading && activeCredits !== null && activeCredits > 0;
  const isPrimary = recommended || hasCredits;

  const benefits = [
    `${cfg.hours} sesiones de 1 hora`,
    "Reserva flexible — tú decides cuándo",
    "Vigencia de 180 días",
  ];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        padding: "28px",
        background: hasCredits
          ? "rgba(78,222,163,0.07)"
          : recommended
          ? "rgba(78,222,163,0.05)"
          : "#201f22",
        border: isPrimary
          ? "1px solid rgba(78,222,163,0.35)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = isPrimary
          ? "rgba(78,222,163,0.55)"
          : "rgba(78,222,163,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = isPrimary
          ? "rgba(78,222,163,0.35)"
          : "rgba(255,255,255,0.06)";
      }}
    >

      {/* Top-right badge */}
      {(hasCredits || recommended) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            padding: "5px 12px",
            background: "#4edea3",
            color: "#003824",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            borderBottomLeftRadius: "10px",
          }}
        >
          {hasCredits ? "Pack activo" : "Recomendado"}
        </div>
      )}

      {/* ── Pack name ── */}
      <div
        style={{
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "#e5e1e4",
          letterSpacing: "-0.01em",
          marginBottom: "16px",
          paddingRight: isPrimary ? "90px" : "0",
        }}
      >
        {cfg.label}
      </div>

      {/* ── Active credits state ── */}
      {creditsLoading ? (
        <div
          style={{
            height: "16px",
            width: "140px",
            borderRadius: "4px",
            background: "#2a2a2c",
            marginBottom: "20px",
            animation: "skeletonPulse 1.4s ease-in-out infinite",
          }}
        />
      ) : hasCredits ? (
        <div style={{ marginBottom: "20px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "4px 10px",
              borderRadius: "100px",
              background: "rgba(78,222,163,0.1)",
              border: "1px solid rgba(78,222,163,0.25)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#4edea3",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#4edea3",
                flexShrink: 0,
                animation: "blink 1.4s ease-in-out infinite",
              }}
            />
            {activeCredits} clase{activeCredits !== 1 ? "s" : ""} disponible{activeCredits !== 1 ? "s" : ""}
          </span>
          <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
        </div>
      ) : (
        <>
          {/* ── Price row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontSize: "2rem",
                fontWeight: 800,
                color: "#4edea3",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {cfg.price}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "#86948a",
                textDecoration: "line-through",
                lineHeight: 1,
              }}
            >
              {cfg.originalPrice}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                background: "rgba(78,222,163,0.1)",
                border: "1px solid rgba(78,222,163,0.2)",
                borderRadius: "100px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#4edea3",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {cfg.savingsPill}
            </span>
          </div>

          {/* ── Per-hour rate ── */}
          <div style={{ fontSize: "13px", color: "#86948a", marginBottom: "20px", lineHeight: 1 }}>
            <span style={{ color: "#4edea3", fontWeight: 600 }}>{cfg.hourlyRate} / hora</span>
            {" · vs €16 en sesión suelta"}
          </div>
        </>
      )}

      {/* ── Benefits list ── */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 24px 0",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
        }}
      >
        {benefits.map((benefit) => (
          <li
            key={benefit}
            style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#bbcabf" }}
          >
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(78,222,163,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            {benefit}
          </li>
        ))}
      </ul>

      {/* ── CTA button ── */}
      <button
        onClick={hasCredits ? onSchedule : onClick}
        disabled={checkoutLoading}
        style={{
          display: "block",
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: isPrimary
            ? "none"
            : "1px solid rgba(78,222,163,0.25)",
          background: isPrimary
            ? "linear-gradient(135deg, #4edea3, #10b981)"
            : "rgba(78,222,163,0.06)",
          color: isPrimary ? "#003824" : "#bbcabf",
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "14px",
          fontWeight: 700,
          cursor: checkoutLoading ? "not-allowed" : "pointer",
          opacity: checkoutLoading ? 0.7 : 1,
          transition: "filter 0.15s, background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => {
          if (checkoutLoading) return;
          const btn = e.currentTarget as HTMLButtonElement;
          if (isPrimary) {
            btn.style.filter = "brightness(1.08)";
          } else {
            btn.style.background = "rgba(78,222,163,0.12)";
            btn.style.borderColor = "rgba(78,222,163,0.4)";
            btn.style.color = "#4edea3";
          }
        }}
        onMouseLeave={(e) => {
          if (checkoutLoading) return;
          const btn = e.currentTarget as HTMLButtonElement;
          if (isPrimary) {
            btn.style.filter = "brightness(1)";
          } else {
            btn.style.background = "rgba(78,222,163,0.06)";
            btn.style.borderColor = "rgba(78,222,163,0.25)";
            btn.style.color = "#bbcabf";
          }
        }}
      >
        {checkoutLoading ? "Preparando pago..." : hasCredits ? "Reservar clase" : `Comprar pack · ${cfg.price}`}
      </button>

    </div>
  );
}