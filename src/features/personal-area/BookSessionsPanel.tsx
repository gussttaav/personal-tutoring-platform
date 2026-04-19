"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserSession } from "@/domain/types";

interface BookSessionsPanelProps {
  hasActivePack: boolean;
  packSession:   UserSession | null;
}

interface SessionOption {
  icon:  string;
  label: string;
  sub:   string;
  price: string;
  book:  string;
}

const SINGLE_SESSIONS: SessionOption[] = [
  {
    icon:  "chat_bubble",
    label: "Encuentro Inicial",
    sub:   "15 min · Presentación",
    price: "Gratis",
    book:  "free15min",
  },
  {
    icon:  "timer",
    label: "Sesión de 1 hora",
    sub:   "60 min · Individual",
    price: "€16",
    book:  "session1h",
  },
  {
    icon:  "history",
    label: "Sesión de 2 horas",
    sub:   "120 min · Individual",
    price: "€30",
    book:  "session2h",
  },
];

const PACK_OPTIONS: SessionOption[] = [
  {
    icon:  "inventory_2",
    label: "Pack Esencial 5h",
    sub:   "Ahorra €5 · 6% dto.",
    price: "€75",
    book:  "pack5",
  },
  {
    icon:  "inventory_2",
    label: "Pack Intensivo 10h",
    sub:   "Ahorra €20 · 12% dto.",
    price: "€140",
    book:  "pack10",
  },
];

export default function BookSessionsPanel({ hasActivePack, packSession }: BookSessionsPanelProps) {
  const router = useRouter();

  return (
    <div
      style={{
        background:   "#1c1b1d",
        borderRadius: 16,
        padding:      20,
        border:       "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3 style={{
        fontFamily:    "var(--font-headline, Manrope), sans-serif",
        fontSize:      16,
        fontWeight:    700,
        color:         "#e5e1e4",
        letterSpacing: "-0.01em",
        margin:        "0 0 16px",
      }}>
        Reservar una sesión
      </h3>

      {/* Pack sessions CTA — only shown if user has active pack */}
      {hasActivePack && packSession && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => router.push("/?book=pack")}
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              width:          "100%",
              padding:        "12px 14px",
              background:     "rgba(78,222,163,0.08)",
              border:         "1px solid rgba(78,222,163,0.18)",
              borderRadius:   10,
              cursor:         "pointer",
              fontFamily:     "inherit",
              textAlign:      "left",
              transition:     "background 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.08)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width:          32,
                height:         32,
                borderRadius:   8,
                background:     "rgba(78,222,163,0.12)",
                border:         "1px solid rgba(78,222,163,0.2)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>
                  calendar_add_on
                </span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#4edea3", margin: 0 }}>
                  Usar crédito del pack
                </p>
                <p style={{ fontSize: 10, color: "#86948a", margin: "1px 0 0" }}>
                  {packSession.credits} clase{packSession.credits !== 1 ? "s" : ""} disponible{packSession.credits !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#4edea3" }}>
              chevron_right
            </span>
          </button>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "16px 0 14px" }} />
        </div>
      )}

      {/* Single sessions */}
      <p style={{
        fontSize:      9,
        fontWeight:    700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color:         "#4edea3",
        margin:        "0 0 8px",
      }}>
        Sesiones individuales
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {SINGLE_SESSIONS.map((opt) => (
          <SessionRow
            key={opt.book}
            option={opt}
            onClick={() => router.push(`/?book=${opt.book}`)}
          />
        ))}
      </div>

      {/* Pack purchase */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 14px" }} />
      <p style={{
        fontSize:      9,
        fontWeight:    700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color:         "#4edea3",
        margin:        "0 0 8px",
      }}>
        Packs de continuidad
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PACK_OPTIONS.map((opt) => (
          <SessionRow
            key={opt.book}
            option={opt}
            onClick={() => router.push(`/?book=${opt.book}`)}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({ option, onClick }: { option: SessionOption; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        width:          "100%",
        padding:        "10px 12px",
        background:     hovered ? "rgba(78,222,163,0.05)" : "#111113",
        border:         `1px solid ${hovered ? "rgba(78,222,163,0.2)" : "rgba(255,255,255,0.04)"}`,
        borderRadius:   10,
        cursor:         "pointer",
        fontFamily:     "inherit",
        textAlign:      "left",
        transition:     "background 0.12s, border-color 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width:          28,
          height:         28,
          borderRadius:   7,
          background:     "rgba(78,222,163,0.08)",
          border:         "1px solid rgba(78,222,163,0.12)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#4edea3" }}>
            {option.icon}
          </span>
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e1e4", margin: 0 }}>{option.label}</p>
          <p style={{ fontSize: 10, color: "#86948a", margin: "1px 0 0" }}>{option.sub}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#4edea3", flexShrink: 0 }}>
        {option.price}
      </span>
    </button>
  );
}
