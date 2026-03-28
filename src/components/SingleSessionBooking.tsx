"use client";

/**
 * SingleSessionBooking — free 15-min, paid 1h, paid 2h
 * Emerald Nocturne · booking.html layout
 *
 * ALL LOGIC IS IDENTICAL TO ORIGINAL (UX-02, UX-03, UX-05).
 * Layout replaced to match booking.html:
 *   - BookingLayout (full-page overlay with real Navbar + Footer)
 *   - WizardProgress (3-step indicator)
 *   - lg:grid-cols-12 with BookingSidebar (col-span-3) + calendar (col-span-9)
 *   - Calendar container with actions bar at bottom
 */

import { useState, useCallback, useEffect } from "react";
import { Spinner, Alert } from "@/components/ui";
import { COLORS } from "@/constants";
import { friendlyError } from "@/constants/errors";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import BookingLayout from "@/components/booking/BookingLayout";
import WizardProgress from "@/components/booking/WizardProgress";
import BookingSidebar from "@/components/booking/BookingSidebar";
import {
  ConfirmPanel,
  SESSION_CONFIGS,
  primaryBtnStyle,
  secondaryBtnStyle,
} from "@/components/BookingModeView";

export type SingleSessionType = "free15min" | "session1h" | "session2h";

interface SingleSessionBookingProps {
  sessionType:      SingleSessionType;
  userName:         string;
  userEmail:        string;
  rescheduleToken?: string | null;
  onBack:           () => void;
}

// UX-02: "selected" is new — slot chosen but not yet confirmed
type Phase = "picking" | "selected" | "booking" | "redirecting" | "success" | "error";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

export default function SingleSessionBooking({
  sessionType,
  userName,
  userEmail,
  rescheduleToken,
  onBack,
}: SingleSessionBookingProps) {
  const cfg = SESSION_CONFIGS[sessionType];

  const [phase,       setPhase]       = useState<Phase>("picking");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [selected,    setSelected]    = useState<SelectedSlot | null>(null);
  const [meetLink,    setMeetLink]    = useState("");
  const [cancelToken, setCancelToken] = useState("");
  const [emailFailed, setEmailFailed] = useState(false);
  const [userTz,      setUserTz]      = useState<string>("");

  useEffect(() => {
    try {
      const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const gmt    = `GMT${offset >= 0 ? "+" : ""}${offset}`;
      setUserTz(`${tz} (${gmt})`);
    } catch { /* ignore */ }
  }, []);

  // UX-02: Step 1 — slot selected
  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
    const needsStripe = (sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken;
    if (needsStripe) {
      void handleStripeRedirect(slot);
    } else {
      setPhase("selected");
    }
  }, [sessionType, rescheduleToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // UX-02: Step 2 — "Confirmar reserva" pressed for free/reschedule flows
  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setPhase("booking");
    try {
      const data = await api.book.post({
        startIso:        selected.startIso,
        endIso:          selected.endIso,
        sessionType:     sessionType === "free15min" ? "free15min" : sessionType,
        note:            selected.note,
        timezone:        selected.timezone,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      setMeetLink(data.meetLink);
      setCancelToken(data.cancelToken);
      setEmailFailed(data.emailFailed);
      setPhase("success");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const raw    = err instanceof ApiError ? err.message : "Error al reservar.";
      setErrorMsg(friendlyError(status, raw));
      setPhase("error");
    }
  }, [selected, sessionType, rescheduleToken]);

  async function handleStripeRedirect(slot: SelectedSlot) {
    setPhase("redirecting");
    try {
      const duration = sessionType === "session1h" ? "1h" : "2h";
      const data = await api.stripe.checkoutSingleSession({
        duration,
        startIso:        slot.startIso,
        endIso:          slot.endIso,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      window.location.href = data.url;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const raw    = err instanceof ApiError ? err.message : "Error al iniciar el pago.";
      setErrorMsg(friendlyError(status, raw));
      setPhase("error");
    }
  }

  // UX-05: direct cancel link
  const cancelUrl = cancelToken ? `${BASE_URL}/cancelar?token=${cancelToken}` : null;

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <BookingLayout>
        <WizardProgress currentStep={3} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px", background: "rgba(78,222,163,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#4edea3" }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: "#e5e1e4", marginBottom: 6, fontFamily: "var(--font-headline, Manrope), sans-serif" }}>¡Encuentro reservado!</h2>
            <p style={{ fontSize: 14, color: "#bbcabf", marginBottom: 16 }}>{selected?.dateLabel} · {selected?.label}</p>

            {emailFailed ? (
              <div style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#4edea3", marginBottom: 8 }}>⚠️ No pudimos enviarte el email de confirmación</p>
                <p style={{ fontSize: 12, color: "#bbcabf", marginBottom: 12 }}>Tu encuentro está reservado. Guarda el enlace de Google Meet ahora:</p>
                <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", wordBreak: "break-all", fontSize: 13, color: "#4edea3", textDecoration: "underline", marginBottom: 8 }}>{meetLink}</a>
                {cancelUrl && (
                  <a href={cancelUrl} style={{ display: "block", fontSize: 12, color: "#bbcabf", marginTop: 4 }}>Cancelar esta reserva</a>
                )}
                <p style={{ fontSize: 11, color: "#86948a", margin: "8px 0 0" }}>
                  Si necesitas ayuda escribe a contacto@gustavoai.dev
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#bbcabf", marginBottom: 8 }}>Recibirás el enlace de Google Meet y la confirmación por email.</p>
                {cancelUrl && (
                  <p style={{ fontSize: 12, color: "#86948a", marginBottom: 20 }}>
                    También puedes{" "}
                    <a href={cancelUrl} style={{ color: "#bbcabf", textDecoration: "underline" }}>cancelar esta reserva</a>
                    {" "}directamente.
                  </p>
                )}
              </>
            )}

            <button onClick={onBack} style={secondaryBtnStyle}>Volver al inicio</button>
          </div>
        </div>
      </BookingLayout>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <BookingLayout>
        <WizardProgress currentStep={2} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: COLORS.errorBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: COLORS.error }}>✕</div>
            <Alert variant="error">{errorMsg}</Alert>
            <button onClick={() => setPhase("picking")} style={{ ...primaryBtnStyle, marginTop: 16 }}>Intentar de nuevo</button>
          </div>
        </div>
      </BookingLayout>
    );
  }

  // ── Main booking UI ────────────────────────────────────────────────────────
  const wizardStep: 1 | 2 | 3 = phase === "selected" ? 3 : 2;
  const isReschedule = !!rescheduleToken;

  return (
    <BookingLayout>
      <WizardProgress currentStep={wizardStep} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Sidebar ── */}
        <BookingSidebar
          mode="single"
          sessionName={cfg.label}
          duration={cfg.duration}
          price={cfg.price}
          isReschedule={isReschedule}
          userTz={userTz}
        />

        {/* ── Calendar / confirm / spinner area ── */}
        <div
          className="lg:col-span-9 rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "#1c1b1d",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {/* Calendar content */}
          <div className="flex-1">
            {phase === "booking" || phase === "redirecting" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 12 }}>
                <Spinner />
                <p style={{ fontSize: 13, color: "#bbcabf" }}>
                  {phase === "redirecting" ? "Redirigiendo al pago…" : `Reservando ${selected?.dateLabel} a las ${selected?.label}…`}
                </p>
              </div>
            ) : phase === "selected" && selected ? (
              // UX-02: confirm panel for free / reschedule flows
              <div className="p-8">
                <div style={{ maxWidth: 520, margin: "0 auto" }}>
                  <ConfirmPanel
                    slot={selected}
                    onConfirm={handleConfirm}
                    onCancel={() => setPhase("picking")}
                    sessionDuration={cfg.duration}
                    isReschedule={isReschedule}
                  />
                </div>
              </div>
            ) : (
              <WeeklyCalendar
                durationMinutes={cfg.durationMinutes}
                onSlotSelected={handleSlotSelected}
                selectedSlot={selected}
              />
            )}
          </div>

          {/* ── Actions bar ── */}
          <div
            className="p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#1c1b1d" }}
          >
            <button
              onClick={onBack}
              className="flex items-center gap-2 font-semibold transition-colors group"
              style={{ color: "#bbcabf", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="group-hover:-translate-x-1 transition-transform"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Cambiar tipo de sesión</span>
            </button>

            {phase === "selected" && selected && (
              <button
                onClick={handleConfirm}
                className="w-full md:w-auto font-headline font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all"
                style={{
                  background: "linear-gradient(135deg, #4edea3, #10b981)",
                  color: "#003824",
                  padding: "16px 48px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(78,222,163,0.4)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                Confirmar reserva
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {phase === "picking" && (
              <div
                className="hidden md:flex items-center gap-2 text-xs"
                style={{ color: "#86948a" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Selecciona un horario para continuar
              </div>
            )}
          </div>
        </div>
      </div>
    </BookingLayout>
  );
}
