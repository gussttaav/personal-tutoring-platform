"use client";

import { useRouter } from "next/navigation";
import type { UserSession } from "@/domain/types";

interface PackStatusCardProps {
  packSession: UserSession;
}

export default function PackStatusCard({ packSession }: PackStatusCardProps) {
  const router  = useRouter();
  const { credits, packSize, name } = packSession;

  const totalCredits = packSize ?? 5;
  const usedCredits  = totalCredits - credits;
  const progress     = (credits / totalCredits) * 100;
  const packLabel    = packSize === 10 ? "Pack Intensivo 10h" : "Pack Esencial 5h";

  return (
    <div
      style={{
        background:   "#1c1b1d",
        borderRadius: 16,
        padding:      "20px 24px",
        border:       "1px solid rgba(78,222,163,0.15)",
        boxShadow:    "0 0 24px rgba(78,222,163,0.08)",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexWrap:       "wrap",
          gap:            16,
        }}
      >
        {/* Left: icon + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width:          48,
              height:         48,
              borderRadius:   12,
              background:     "rgba(78,222,163,0.10)",
              border:         "1px solid rgba(78,222,163,0.2)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 22, color: "#4edea3", fontVariationSettings: "'FILL' 1" }}
            >
              inventory_2
            </span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{
                fontFamily:    "var(--font-headline, Manrope), sans-serif",
                fontSize:      14,
                fontWeight:    700,
                color:         "#e5e1e4",
                margin:        0,
              }}>
                {packLabel}
              </p>
              <span style={{
                fontSize:      9,
                fontWeight:    700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background:    "rgba(78,222,163,0.10)",
                color:         "#4edea3",
                border:        "1px solid rgba(78,222,163,0.2)",
                borderRadius:  9999,
                padding:       "2px 8px",
              }}>
                Activo
              </span>
            </div>
            <p style={{ fontSize: 11, color: "#86948a", margin: "3px 0 0" }}>
              {usedCredits} clase{usedCredits !== 1 ? "s" : ""} utilizada{usedCredits !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Right: credits + progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#86948a", margin: 0 }}>
              Clases restantes
            </p>
            <p style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize:   24,
              fontWeight: 800,
              color:      "#4edea3",
              lineHeight: 1,
              margin:     "2px 0 0",
            }}>
              {credits}
              <span style={{ fontSize: 14, fontWeight: 600, color: "#86948a" }}>/{totalCredits}</span>
            </p>
          </div>
          <div style={{ width: 80 }}>
            <div style={{
              height:       6,
              borderRadius: 9999,
              background:   "rgba(78,222,163,0.10)",
              overflow:     "hidden",
              marginBottom: 4,
            }}>
              <div style={{
                width:        `${progress}%`,
                height:       "100%",
                borderRadius: 9999,
                background:   "linear-gradient(90deg, #4edea3, #10b981)",
                transition:   "width 0.6s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
            <p style={{ fontSize: 9, color: "#86948a", textAlign: "right", margin: 0 }}>
              {usedCredits} usada{usedCredits !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p style={{ fontSize: 13, color: "#86948a", margin: "0 0 12px" }}>
          Tienes{" "}
          <span style={{ color: "#4edea3", fontWeight: 700 }}>
            {credits} clase{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}
          </span>{" "}
          en tu pack. ¡Reserva tu próxima sesión!
        </p>
        <button
          onClick={() => router.push("/?book=pack")}
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            6,
            padding:        "9px 18px",
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
            transition:     "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
            calendar_add_on
          </span>
          Reservar sesión del pack
        </button>
      </div>
    </div>
  );
}
