"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserBooking } from "./types";

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const SESSION_LABELS: Record<string, string> = {
  free15min: "Encuentro inicial · 15 min",
  session1h: "Sesión individual · 1h",
  session2h: "Sesión individual · 2h",
  pack:      "Clase de pack",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayOfWeekEs(date: Date): string {
  const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return DAYS[date.getDay()];
}

interface NextSessionCardProps {
  booking:    UserBooking;
  onCancelled: () => void;
}

export default function NextSessionCard({ booking, onCancelled }: NextSessionCardProps) {
  const router = useRouter();
  const [cancelState, setCancelState] = useState<"idle" | "confirm" | "processing" | "error">("idle");
  const [errorMsg,    setErrorMsg]    = useState("");

  const startDate = new Date(booking.startsAt);
  const label     = SESSION_LABELS[booking.sessionType] ?? "Sesión";
  const timeRange = `${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`;

  async function handleCancel() {
    setCancelState("processing");
    try {
      const res  = await fetch("/api/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: booking.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Error al cancelar la sesión.");
        setCancelState("error");
        return;
      }
      onCancelled();
    } catch {
      setErrorMsg("Error de conexión. Inténtalo de nuevo.");
      setCancelState("error");
    }
  }

  return (
    <div
      style={{
        background:   "#1c1b1d",
        borderRadius: 16,
        padding:      20,
        border:       "1px solid rgba(78,222,163,0.15)",
        boxShadow:    "0 0 24px rgba(78,222,163,0.08)",
      }}
    >
      <p style={{
        fontSize:      10,
        fontWeight:    700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color:         "#4edea3",
        margin:        "0 0 14px",
      }}>
        Próxima clase
      </p>

      {/* Session info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {/* Date badge */}
        <div style={{
          width:          48,
          height:         48,
          background:     "#111113",
          borderRadius:   12,
          border:         "1px solid rgba(255,255,255,0.07)",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#86948a", textTransform: "uppercase", lineHeight: 1 }}>
            {MONTHS_SHORT[startDate.getMonth()]}
          </span>
          <span style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize:   20,
            fontWeight: 800,
            color:      "#4edea3",
            lineHeight: 1,
          }}>
            {startDate.getDate()}
          </span>
        </div>

        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#e5e1e4", margin: 0 }}>
            {label}
          </p>
          <p style={{ fontSize: 11, color: "#86948a", margin: "2px 0 0" }}>
            {dayOfWeekEs(startDate)} · {timeRange}
          </p>
          <p style={{ fontSize: 10, color: "#86948a", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>video_call</span>
            Aula virtual Zoom
          </p>
        </div>
      </div>

      {/* Join button */}
      {cancelState === "idle" && (
        <>
          <button
            onClick={() => router.push(`/sesion/${booking.token}`)}
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            6,
              width:          "100%",
              padding:        "10px",
              background:     "#4edea3",
              border:         "none",
              borderRadius:   8,
              color:          "#003824",
              fontSize:       11,
              fontWeight:     700,
              textTransform:  "uppercase",
              letterSpacing:  "0.08em",
              cursor:         "pointer",
              fontFamily:     "inherit",
              marginBottom:   8,
              transition:     "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
              play_circle
            </span>
            Entrar al aula virtual
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton
              icon="event_repeat"
              label="Reprogramar"
              onClick={() => router.push(`/?reschedule=${booking.sessionType}&token=${booking.token}`)}
            />
            <ActionButton
              icon="cancel"
              label="Cancelar"
              danger
              onClick={() => setCancelState("confirm")}
            />
          </div>
        </>
      )}

      {/* Cancel confirm */}
      {cancelState === "confirm" && (
        <div
          style={{
            background:   "rgba(255,180,171,0.06)",
            border:       "1px solid rgba(255,180,171,0.15)",
            borderRadius: 10,
            padding:      "12px 14px",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e1e4", margin: "0 0 4px" }}>
            ¿Cancelar esta sesión?
          </p>
          <p style={{ fontSize: 11, color: "#86948a", margin: "0 0 12px" }}>
            Esta acción no se puede deshacer. Si es de pack, el crédito se devolverá automáticamente.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setCancelState("idle")}
              style={{
                flex: 1, padding: "8px", borderRadius: 7,
                background: "none", border: "1px solid rgba(255,255,255,0.1)",
                color: "#86948a", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Mantener
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: "8px", borderRadius: 7,
                background: "#ffb4ab", border: "none",
                color: "#690005", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Sí, cancelar
            </button>
          </div>
        </div>
      )}

      {/* Processing */}
      {cancelState === "processing" && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 60 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: "#86948a",
                animation: `paDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {cancelState === "error" && (
        <div style={{
          background:   "rgba(255,180,171,0.06)",
          border:       "1px solid rgba(255,180,171,0.15)",
          borderRadius: 10,
          padding:      "12px 14px",
        }}>
          <p style={{ fontSize: 11, color: "#ffb4ab", margin: "0 0 10px" }}>{errorMsg}</p>
          <button
            onClick={() => setCancelState("idle")}
            style={{
              width: "100%", padding: "8px", borderRadius: 7,
              background: "none", border: "1px solid rgba(255,255,255,0.1)",
              color: "#86948a", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      <style>{`
        @keyframes paDotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  icon, label, onClick, danger = false,
}: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const color = danger ? "#ffb4ab" : "#bbcabf";
  const hoverBg = danger ? "rgba(255,180,171,0.08)" : "rgba(255,255,255,0.05)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:           1,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            6,
        padding:        "8px",
        border:         "1px solid rgba(255,255,255,0.08)",
        borderRadius:   8,
        background:     hovered ? hoverBg : "transparent",
        color,
        fontSize:       10,
        fontWeight:     700,
        textTransform:  "uppercase",
        letterSpacing:  "0.07em",
        cursor:         "pointer",
        fontFamily:     "inherit",
        transition:     "background 0.12s, color 0.12s",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  );
}
