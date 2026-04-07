"use client";

/**
 * SessionPickerContent — shared session/pack picker UI
 *
 * Extracted from AvailabilityModal so it can be reused by:
 *   - AvailabilityModal  (slot always present — shows date/time badge)
 *   - SessionPickerModal (no slot — hides date/time badge)
 */

import { useState } from "react";
import type { SelectedSlot } from "@/components/WeeklyCalendar";

// ─── Exported types ────────────────────────────────────────────────────────────

export type SessionChoice =
  | { kind: "session"; type: "free15min" | "session1h" | "session2h" }
  | { kind: "pack"; size: 5 | 10 };

// ─── Session / pack option data ────────────────────────────────────────────────

export const SESSION_OPTIONS = [
  {
    kind: "session" as const, type: "free15min" as const,
    label: "Encuentro inicial", detail: "15 min · Gratis", badge: null,
    icon: "chat_bubble",
    description: "Comentamos tu caso y definimos un plan de trabajo.",
  },
  {
    kind: "session" as const, type: "session1h" as const,
    label: "Sesión 1 hora", detail: "60 min · €16", badge: "Popular",
    icon: "timer",
    description: "Resolución de dudas, proyecto o preparación de examen.",
  },
  {
    kind: "session" as const, type: "session2h" as const,
    label: "Sesión 2 horas", detail: "120 min · €30", badge: null,
    icon: "history",
    description: "Para temas que requieren mayor profundidad.",
  },
] as const;

export const PACK_OPTIONS = [
  {
    kind: "pack" as const, size: 5 as const,
    label: "Pack Esencial", detail: "5 × 1h · €75", badge: null,
    savings: "Ahorra 5€",
    description: "Ideal para comenzar con flexibilidad.",
    hourlyRate: "€15/h",
    totalPrice: "€75",
  },
  {
    kind: "pack" as const, size: 10 as const,
    label: "Pack Intensivo", detail: "10 × 1h · €140", badge: "Recomendado",
    savings: "Ahorra 20€",
    description: "El mejor valor para un acompañamiento continuo.",
    hourlyRate: "€14/h",
    totalPrice: "€140",
  },
] as const;

// ─── Helper ───────────────────────────────────────────────────────────────────

function startTimeFromLabel(label: string): string {
  return label.split(/\s*[–\-]\s*/)[0] ?? label;
}

// ─── SessionPickerContent ─────────────────────────────────────────────────────

interface SessionPickerContentProps {
  /** When provided, shows the date/time badge at the top */
  slot?:          SelectedSlot;
  isMobile:       boolean;
  isSignedIn:     boolean;
  activePackSize: 5 | 10 | null;
  selectedChoice: SessionChoice | null;
  onSelect:       (choice: SessionChoice) => void;
  ctaLabel:       (choice: SessionChoice) => string;
  onConfirm:      () => void;
}

export default function SessionPickerContent({
  slot,
  isMobile,
  isSignedIn,
  activePackSize,
  selectedChoice,
  onSelect,
  ctaLabel,
  onConfirm,
}: SessionPickerContentProps) {
  const isChoiceSelected = (choice: SessionChoice) => {
    if (!selectedChoice) return false;
    if (choice.kind !== selectedChoice.kind) return false;
    if (choice.kind === "session" && selectedChoice.kind === "session") {
      return choice.type === selectedChoice.type;
    }
    if (choice.kind === "pack" && selectedChoice.kind === "pack") {
      return choice.size === selectedChoice.size;
    }
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* Scrollable content */}
      <div style={{ flex: 1, padding: "24px 20px 8px" }}>

        {/* Date badge — only shown when a slot is pre-selected */}
        {slot && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          8,
              background:   "rgba(78,222,163,0.1)",
              border:       "1px solid rgba(78,222,163,0.2)",
              borderRadius: 9999,
              padding:      "8px 16px",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4edea3", lineHeight: 1 }}>
                event_available
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4edea3" }}>
                {slot.dateLabel} · {startTimeFromLabel(slot.label)}
              </span>
            </div>
          </div>
        )}

        {/* Heading */}
        <h2 style={{
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          fontSize:      isMobile ? 26 : 34,
          fontWeight:    800,
          color:         "#e5e1e4",
          letterSpacing: "-0.03em",
          textAlign:     "center",
          margin:        "0 0 8px",
          lineHeight:    1.15,
        }}>
          Selecciona tu sesión
        </h2>
        <p style={{ fontSize: 13, color: "#86948a", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Elige el tipo de sesión que mejor se adapta a lo que buscas.
        </p>

        {/* Individual sessions */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e5e1e4", marginBottom: 10 }}>
          Sesiones individuales
        </p>
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap:                 8,
          marginBottom:        10,
        }}>
          {SESSION_OPTIONS.map((opt) => {
            const choice: SessionChoice = { kind: opt.kind, type: opt.type };
            return (
              <OptionCard
                key={opt.type}
                label={opt.label}
                detail={opt.detail}
                badge={opt.badge}
                icon={opt.icon}
                description={opt.description}
                selected={isChoiceSelected(choice)}
                onClick={() => isChoiceSelected(choice) ? onConfirm() : onSelect(choice)}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0" }} />

        {/* Packs */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bbcabf", marginBottom: 10 }}>
          Packs de continuidad
        </p>
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap:                 8,
          marginBottom:        8,
        }}>
          {PACK_OPTIONS.map((opt) => {
            const choice: SessionChoice = { kind: opt.kind, size: opt.size };
            const hasPack = isSignedIn && activePackSize === opt.size;
            return (
              <PackCard
                key={opt.size}
                label={opt.label}
                savings={opt.savings}
                description={opt.description}
                hourlyRate={opt.hourlyRate}
                totalPrice={opt.totalPrice}
                badge={hasPack ? "Pack activo" : opt.badge}
                hasPack={hasPack}
                selected={isChoiceSelected(choice)}
                onClick={() => isChoiceSelected(choice) ? onConfirm() : onSelect(choice)}
              />
            );
          })}
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position:       "sticky",
        bottom:         0,
        background:     "#1c1b1d",
        borderTop:      "1px solid rgba(255,255,255,0.06)",
        padding:        "12px 20px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            12,
        flexWrap:       isMobile ? "wrap" : "nowrap",
      }}>
        {/* Security badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#86948a" aria-hidden="true">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#bbcabf", margin: 0, lineHeight: 1.3 }}>Pago seguro</p>
            <p style={{ fontSize: 10, color: "#86948a", margin: 0 }}>SSL · Stripe</p>
          </div>
        </div>

        {/* CTA button */}
        {selectedChoice && (
          <button
            onClick={onConfirm}
            style={{
              padding:      isMobile ? "13px 0" : "12px 28px",
              width:        isMobile ? "100%" : "auto",
              background:   "linear-gradient(135deg, #4edea3, #10b981)",
              border:       "none",
              borderRadius: 10,
              color:        "#003824",
              fontSize:     14,
              fontWeight:   700,
              cursor:       "pointer",
              fontFamily:   "inherit",
              transition:   "opacity 0.15s, transform 0.1s",
              whiteSpace:   "nowrap",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.9";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            {ctaLabel(selectedChoice)}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Option card (individual sessions) ────────────────────────────────────────

function OptionCard({
  label,
  detail,
  badge,
  icon,
  description,
  selected = false,
  onClick,
}: {
  label:        string;
  detail:       string;
  badge:        string | null;
  icon?:        string;
  description?: string;
  selected?:    boolean;
  onClick:      () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  const parts    = detail.split("·");
  const duration = parts[0]?.trim() ?? "";
  const price    = parts[1]?.trim() ?? detail;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:      "relative",
        textAlign:     "left",
        display:       "flex",
        flexDirection: "column",
        background:    isActive ? "#2a2a2c" : "#201f22",
        border:        selected
          ? "2px solid rgba(78,222,163,0.4)"
          : isActive
          ? "1px solid rgba(78,222,163,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius:  12,
        padding:       "14px 14px 12px",
        cursor:        "pointer",
        fontFamily:    "inherit",
        transition:    "background 0.12s, border-color 0.12s",
        width:         "100%",
      }}
    >
      {badge && (
        <span style={{
          position:      "absolute",
          top:           "-1px",
          right:         8,
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding:       "2px 7px",
          borderRadius:  "0 0 6px 6px",
          background:    selected ? "rgba(78,222,163,0.25)" : "rgba(78,222,163,0.15)",
          color:         "#4edea3",
          border:        "1px solid rgba(78,222,163,0.3)",
          borderTop:     "none",
        }}>
          {badge}
        </span>
      )}

      {/* Icon + duration row */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   10,
        marginTop:      badge ? 8 : 0,
      }}>
        {icon && (
          <span className="material-symbols-outlined" style={{
            fontSize:   20,
            color:      selected ? "#4edea3" : "#86948a",
            lineHeight: 1,
            transition: "color 0.12s",
          }}>
            {icon}
          </span>
        )}
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color:         selected ? "#e5e1e4" : "#86948a",
        }}>
          {duration}
        </span>
      </div>

      <p style={{
        fontSize:   13,
        fontWeight: 600,
        color:      selected ? "#4edea3" : "#e5e1e4",
        margin:     "0 0 4px",
        transition: "color 0.12s",
      }}>
        {label}
      </p>

      {description && (
        <p style={{ fontSize: 11, color: "#86948a", margin: "0 0 10px", lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      <p style={{ fontSize: 15, fontWeight: 700, color: "#e5e1e4", margin: "auto 0 0" }}>
        {price}
      </p>
    </button>
  );
}

// ─── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({
  label,
  savings,
  description,
  hourlyRate,
  totalPrice,
  badge,
  hasPack,
  selected,
  onClick,
}: {
  label:       string;
  savings:     string;
  description: string;
  hourlyRate:  string;
  totalPrice:  string;
  badge:       string | null;
  hasPack:     boolean;
  selected:    boolean;
  onClick:     () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:      "relative",
        textAlign:     "left",
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        background:    isActive ? "#2a2a2c" : "rgba(78,222,163,0.06)",
        border:        selected
          ? "2px solid rgba(78,222,163,0.4)"
          : isActive
          ? "1px solid rgba(78,222,163,0.3)"
          : "1px solid rgba(78,222,163,0.22)",
        borderRadius:  12,
        padding:       "14px 14px 12px",
        cursor:        "pointer",
        fontFamily:    "inherit",
        transition:    "background 0.12s, border-color 0.12s",
        width:         "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: selected ? "#4edea3" : "#e5e1e4", transition: "color 0.12s" }}>
          {label}
        </span>
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background:    "rgba(78,222,163,0.12)",
          border:        "1px solid rgba(78,222,163,0.2)",
          borderRadius:  4,
          color:         "#4edea3",
          padding:       "2px 6px",
          whiteSpace:    "nowrap",
          flexShrink:    0,
        }}>
          {savings}
        </span>
      </div>

      <p style={{ fontSize: 11, color: "#86948a", margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#bbcabf" }}>{hourlyRate}</span>
          {badge && (
            <span style={{
              display:       "inline-block",
              marginLeft:    8,
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background:    hasPack ? "rgba(78,222,163,0.25)" : "rgba(78,222,163,0.15)",
              color:         "#4edea3",
              border:        "1px solid rgba(78,222,163,0.3)",
              borderRadius:  4,
              padding:       "1px 5px",
            }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{
          fontSize:   24,
          fontWeight: 800,
          color:      "#e5e1e4",
          lineHeight: 1,
          fontFamily: "var(--font-headline, Manrope), sans-serif",
        }}>
          {totalPrice}
        </span>
      </div>
    </button>
  );
}
