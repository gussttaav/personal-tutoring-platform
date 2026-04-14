"use client";

/**
 * PersonalArea — root client component for /area-personal
 *
 * Fetches the student's bookings and pack status, then renders the
 * appropriate state:
 *   1. Has bookings → calendar + pack card (if pack) + right panel
 *   2. Has pack but no bookings → pack card + CTA to book + right panel
 *   3. Neither → empty CTA + right panel
 */

import { useState, useEffect, useCallback } from "react";
import { useUserSession } from "@/hooks/useUserSession";
import type { UserBooking, BookingsState } from "./types";
import PersonalAreaCalendar from "./PersonalAreaCalendar";
import PackStatusCard from "./PackStatusCard";
import NextSessionCard from "./NextSessionCard";
import BookSessionsPanel from "./BookSessionsPanel";
import { useRouter } from "next/navigation";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow:     "hidden",
        border:       "1px solid rgba(255,255,255,0.06)",
        background:   "#1c1b1d",
        height:       420,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width:        8,
              height:       8,
              borderRadius: "50%",
              background:   "#86948a",
              animation:    `paDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes paDotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

// ─── CTA: no sessions, no pack ────────────────────────────────────────────────

function EmptyCTA() {
  const router = useRouter();
  return (
    <div
      style={{
        borderRadius: 16,
        padding:      "48px 32px",
        background:   "linear-gradient(135deg, rgba(78,222,163,0.06) 0%, rgba(78,222,163,0.02) 100%)",
        border:       "1px solid rgba(78,222,163,0.12)",
        textAlign:    "center",
      }}
    >
      <div
        style={{
          width:          64,
          height:         64,
          borderRadius:   16,
          background:     "rgba(78,222,163,0.08)",
          border:         "1px solid rgba(78,222,163,0.2)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 20px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: "#4edea3" }}
        >
          school
        </span>
      </div>
      <h3
        style={{
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          fontSize:      20,
          fontWeight:    800,
          color:         "#e5e1e4",
          margin:        "0 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        ¿Listo para empezar?
      </h3>
      <p style={{ fontSize: 14, color: "#86948a", margin: "0 auto 24px", maxWidth: 340 }}>
        Reserva tu primera sesión y da el primer paso hacia tus objetivos.
      </p>
      <button
        onClick={() => router.push("/?book=free15min")}
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            8,
          padding:        "12px 24px",
          background:     "#4edea3",
          border:         "none",
          borderRadius:   8,
          color:          "#003824",
          fontSize:       12,
          fontWeight:     700,
          textTransform:  "uppercase",
          letterSpacing:  "0.08em",
          cursor:         "pointer",
          fontFamily:     "inherit",
          boxShadow:      "0 0 20px rgba(78,222,163,0.25)",
          transition:     "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          calendar_add_on
        </span>
        Reservar una sesión
      </button>
    </div>
  );
}

// ─── CTA: has pack but no sessions ────────────────────────────────────────────

function PackCTA({ credits }: { credits: number }) {
  const router = useRouter();
  return (
    <div
      style={{
        borderRadius: 16,
        padding:      "48px 32px",
        background:   "linear-gradient(135deg, rgba(78,222,163,0.06) 0%, rgba(78,222,163,0.02) 100%)",
        border:       "1px solid rgba(78,222,163,0.15)",
        textAlign:    "center",
      }}
    >
      <div
        style={{
          width:          64,
          height:         64,
          borderRadius:   16,
          background:     "rgba(78,222,163,0.10)",
          border:         "1px solid rgba(78,222,163,0.2)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 20px",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: "#4edea3", fontVariationSettings: "'FILL' 1" }}
        >
          calendar_add_on
        </span>
      </div>
      <h3
        style={{
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          fontSize:      20,
          fontWeight:    800,
          color:         "#e5e1e4",
          margin:        "0 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        ¡Tienes clases disponibles!
      </h3>
      <p style={{ fontSize: 14, color: "#86948a", margin: "0 auto 24px", maxWidth: 360 }}>
        Tienes{" "}
        <span style={{ color: "#4edea3", fontWeight: 700 }}>
          {credits} clase{credits !== 1 ? "s" : ""}
        </span>{" "}
        pendiente{credits !== 1 ? "s" : ""} en tu pack. ¿Cuándo quieres practicar?
      </p>
      <button
        onClick={() => router.push("/?book=pack")}
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            8,
          padding:        "12px 24px",
          background:     "#4edea3",
          border:         "none",
          borderRadius:   8,
          color:          "#003824",
          fontSize:       12,
          fontWeight:     700,
          textTransform:  "uppercase",
          letterSpacing:  "0.08em",
          cursor:         "pointer",
          fontFamily:     "inherit",
          boxShadow:      "0 0 20px rgba(78,222,163,0.25)",
          transition:     "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          calendar_add_on
        </span>
        Reservar mi próxima clase
      </button>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding:      "40px 32px",
        background:   "#1c1b1d",
        border:       "1px solid rgba(255,255,255,0.06)",
        textAlign:    "center",
      }}
    >
      <p style={{ color: "#86948a", fontSize: 14, marginBottom: 16 }}>
        No se pudieron cargar tus sesiones.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding:    "8px 20px",
          borderRadius: 8,
          border:     "1px solid rgba(78,222,163,0.3)",
          background: "transparent",
          color:      "#4edea3",
          fontSize:   13,
          cursor:     "pointer",
          fontFamily: "inherit",
        }}
      >
        Reintentar
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PersonalArea() {
  const { packSession, isAuthLoading } = useUserSession();
  const [bookingsState, setBookingsState] = useState<BookingsState>("loading");
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchBookings = useCallback(async () => {
    setBookingsState("loading");
    try {
      const res = await fetch("/api/my-bookings");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setBookingsState(data.bookings as UserBooking[]);
    } catch {
      setBookingsState("error");
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading) fetchBookings();
  }, [isAuthLoading, fetchBookings]);

  const hasActivePack = !!packSession && packSession.credits > 0;
  const bookings      = Array.isArray(bookingsState) ? bookingsState : [];
  const now           = new Date();
  const upcoming      = bookings.filter((b) => new Date(b.endsAt) > now);
  const hasBookings   = upcoming.length > 0;

  // Soonest upcoming session
  const nextSession = upcoming.length > 0
    ? upcoming.reduce((a, b) =>
        new Date(a.startsAt) < new Date(b.startsAt) ? a : b
      )
    : null;

  return (
    <div
      style={{
        maxWidth: 1280,
        margin:   "0 auto",
        padding:  isMobile ? "24px 16px 48px" : "32px 32px 64px",
      }}
    >
      {/* ── Page header (above two-column layout) ── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily:    "var(--font-headline, Manrope), sans-serif",
            fontSize:      "clamp(1.5rem, 3vw, 2rem)",
            fontWeight:    800,
            color:         "#e5e1e4",
            letterSpacing: "-0.02em",
            margin:        0,
            lineHeight:    1.2,
          }}
        >
          Área Personal
        </h1>
        {packSession && (
          <p style={{ fontSize: 14, color: "#86948a", marginTop: 4 }}>
            Bienvenido de vuelta,{" "}
            <span style={{ color: "#e5e1e4", fontWeight: 600 }}>
              {packSession.name.split(" ")[0]}
            </span>
          </p>
        )}
      </div>

      {/* ── Two-column flex row ── */}
      <div
        style={{
          display:    isMobile ? "block" : "flex",
          gap:        32,
          alignItems: "flex-start",
        }}
      >
        {/* ── Left column ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Pack status card */}
          {hasActivePack && (
            <div style={{ marginBottom: 20 }}>
              <PackStatusCard packSession={packSession!} />
            </div>
          )}

          {/* Main content area */}
          {bookingsState === "loading" ? (
            <CalendarSkeleton />
          ) : bookingsState === "error" ? (
            <ErrorState onRetry={fetchBookings} />
          ) : !hasBookings && !hasActivePack ? (
            <EmptyCTA />
          ) : !hasBookings && hasActivePack ? (
            <PackCTA credits={packSession!.credits} />
          ) : (
            <PersonalAreaCalendar
              bookings={bookings}
              onBookingCancelled={fetchBookings}
            />
          )}
        </div>

        {/* ── Right column ── */}
        <div
          style={{
            width:      isMobile ? "100%" : 360,
            flexShrink: 0,
            marginTop:  isMobile ? 24 : 0,
          }}
        >
          {nextSession && (
            <div style={{ marginBottom: 16 }}>
              <NextSessionCard
                booking={nextSession}
                onCancelled={fetchBookings}
              />
            </div>
          )}
          <BookSessionsPanel hasActivePack={hasActivePack} packSession={packSession} />
        </div>
      </div>
    </div>
  );
}
