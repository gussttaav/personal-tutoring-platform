"use client";

/**
 * SingleSessionBooking — free 15-min, paid 1h, paid 2h
 *
 * Layout: topbar / sidebar (session info) / weekly calendar + confirm panel
 * Logic: unchanged — free sessions → POST /api/book, paid → Stripe redirect
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Alert } from "@/components/ui";
import { COLORS } from "@/constants";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import {
  FullScreenShell,
  ConfirmPanel,
  TutorRow,
  InfoRow,
  MetaRows,
  SESSION_CONFIGS,
  primaryBtnStyle,
  secondaryBtnStyle,
} from "@/components/BookingModeView";

export type SingleSessionType = "free15min" | "session1h" | "session2h";

interface SingleSessionBookingProps {
  sessionType: SingleSessionType;
  userName:    string;
  userEmail:   string;
  onBack:      () => void;
}

type Phase = "picking" | "booking" | "redirecting" | "success" | "error";

export default function SingleSessionBooking({
  sessionType,
  userName,
  userEmail,
  onBack,
}: SingleSessionBookingProps) {
  const router = useRouter();
  const cfg = SESSION_CONFIGS[sessionType];

  const [phase,      setPhase]      = useState<Phase>("picking");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [meetLink,   setMeetLink]   = useState("");
  const [selected,   setSelected]   = useState<SelectedSlot | null>(null);

  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected) return;

    if (sessionType === "free15min") {
      setPhase("booking");
      try {
        const res  = await fetch("/api/book", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            startIso:    selected.startIso,
            endIso:      selected.endIso,
            sessionType: "free15min",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new ApiError(data.error ?? "Error al reservar", res.status);
        setMeetLink(data.meetLink ?? "");
        setPhase("success");
      } catch (err) {
        setErrorMsg(err instanceof ApiError ? err.message : "Error al reservar.");
        setPhase("error");
      }
      return;
    }

    // Paid session → Stripe
    setPhase("redirecting");
    try {
      const duration = sessionType === "session1h" ? "1h" : "2h";
      const data = await api.stripe.checkoutSingleSession({
        duration,
        startIso: selected.startIso,
        endIso:   selected.endIso,
      });
      window.location.href = data.url;
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Error al iniciar el pago.");
      setPhase("error");
    }
  }, [selected, sessionType]);

  const badgeType  = sessionType === "free15min" ? "free" : "paid";
  const badgeLabel = cfg.label;
  const title      = sessionType === "free15min" ? "Reservar sesión" : "Reservar sesión";

  // ── Success (free session only) ────────────────────────────────────────────
  if (phase === "success") {
    return (
      <FullScreenShell onBack={onBack} badgeType={badgeType} badgeLabel={badgeLabel} title={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
              background: "rgba(61,220,132,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, color: "var(--green)",
            }}>✓</div>

            <h2 style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
              ¡Encuentro reservado!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
              {selected?.dateLabel} · {selected?.label}
            </p>

            {meetLink && (
              <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 22px", borderRadius: 8,
                background: "var(--green)", color: "#0d0f10",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
                marginBottom: 20,
              }}>
                Abrir Google Meet →
              </a>
            )}

            <p style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>
              Recibirás un email de confirmación con el enlace de Google Meet
              y la opción de cancelar si lo necesitas.
            </p>

            <button onClick={onBack} style={secondaryBtnStyle}>Volver al inicio</button>
          </div>
        </div>
      </FullScreenShell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <FullScreenShell onBack={onBack} badgeType={badgeType} badgeLabel={badgeLabel} title={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
              background: COLORS.errorBg, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: COLORS.error,
            }}>✕</div>
            <Alert variant="error">{errorMsg}</Alert>
            <button onClick={() => setPhase("picking")} style={{ ...primaryBtnStyle, marginTop: 16 }}>
              Intentar de nuevo
            </button>
          </div>
        </div>
      </FullScreenShell>
    );
  }

  // ── Main booking UI ────────────────────────────────────────────────────────
  return (
    <FullScreenShell onBack={onBack} badgeType={badgeType} badgeLabel={badgeLabel} title={title}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        flex: 1, minHeight: 0,
      }} className="booking-split">

        {/* ── Sidebar ── */}
        <div style={{
          borderRight: "1px solid var(--border)",
          padding: "28px 24px",
          display: "flex", flexDirection: "column", gap: 20,
          overflowY: "auto",
        }}>
          <TutorRow />

          {/* Session info card */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 18,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontFamily: "var(--font-serif), serif", fontSize: 20, color: "var(--text)", lineHeight: 1.2 }}>
              {sessionType === "free15min" && <>Encuentro gratuito<br />de 15 min</>}
              {sessionType === "session1h" && <>Sesión de<br />1 hora</>}
              {sessionType === "session2h" && <>Sesión de<br />2 horas</>}
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <InfoRow icon="clock">{cfg.duration}</InfoRow>
            <InfoRow icon="phone">Google Meet</InfoRow>
            <div style={{ height: 1, background: "var(--border)" }} />
            {cfg.price === null ? (
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--green)" }}>Sin coste</span>
            ) : (
              <span style={{ fontFamily: "var(--font-serif), serif", fontSize: 28, color: "var(--text)" }}>
                {cfg.price}
              </span>
            )}
          </div>

          <MetaRows />
        </div>

        {/* ── Calendar area ── */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          {phase === "booking" || phase === "redirecting" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12 }}>
              <Spinner />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {phase === "redirecting" ? "Redirigiendo al pago…" : `Reservando ${selected?.dateLabel} a las ${selected?.label}…`}
              </p>
            </div>
          ) : (
            <>
              <WeeklyCalendar
                durationMinutes={cfg.durationMinutes}
                onSlotSelected={handleSlotSelected}
                selectedSlot={selected}
              />

              {selected && (
                <ConfirmPanel
                  slot={selected}
                  onConfirm={handleConfirm}
                  sessionDuration={cfg.duration}
                />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .booking-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </FullScreenShell>
  );
}
