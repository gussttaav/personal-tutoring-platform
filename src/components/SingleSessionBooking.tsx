"use client";

/**
 * SingleSessionBooking — free 15-min, paid 1h, paid 2h
 *
 * Week 5 UX improvements (same set as BookingModeView):
 *
 * UX-02 — Two-phase slot confirmation:
 *   Slot selection no longer fires the API immediately. For free sessions and
 *   reschedules (which go directly to /api/book), selecting a slot shows a
 *   ConfirmPanel first. The student presses "Confirmar reserva" to proceed.
 *   Paid sessions (Stripe redirect) still redirect on slot selection because
 *   the confirmation happens on Stripe's own checkout page.
 *
 * UX-03 — User-friendly error messages via friendlyError().
 *
 * UX-05 — Cancel link on success screen.
 *   The cancelToken from the /api/book response is stored and shown as a
 *   direct /cancelar?token=... link on the success screen.
 */

import { useState, useCallback, useEffect } from "react";
import { Spinner, Alert } from "@/components/ui";
import { COLORS } from "@/constants";
import { friendlyError } from "@/constants/errors";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import {
  FullScreenShell,
  TutorRow,
  InfoRow,
  MetaRows,
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
  const [cancelToken, setCancelToken] = useState(""); // UX-05
  const [emailFailed, setEmailFailed] = useState(false);
  const [userTz,      setUserTz]      = useState<string>("");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const gmt = `GMT${offset >= 0 ? '+' : ''}${offset}`;
      setUserTz(`${tz} (${gmt})`);
    } catch { /* ignore */ }
  }, []);

  // UX-02: Step 1 — slot selected
  //   - For paid sessions without a rescheduleToken → redirect to Stripe immediately
  //     (confirmation happens on Stripe's checkout page — no need for an extra step)
  //   - For free sessions and reschedules → show confirm panel first
  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);

    const needsStripe = (sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken;
    if (needsStripe) {
      // Stripe redirect — go immediately, no confirm step needed
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
      setCancelToken(data.cancelToken); // UX-05
      setEmailFailed(data.emailFailed);
      setPhase("success");
    } catch (err) {
      // UX-03: status-specific friendly message
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

  const badgeType  = sessionType === "free15min" ? "free" : "paid";
  const badgeLabel = cfg.label;
  const title      = "Reservar sesión";

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <FullScreenShell onBack={onBack} badgeType={badgeType} badgeLabel={badgeLabel} title={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px", background: "rgba(61,220,132,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "var(--green)" }}>✓</div>

            <h2 style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>¡Encuentro reservado!</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>{selected?.dateLabel} · {selected?.label}</p>

            {emailFailed ? (
              <div style={{ background: "rgba(61,220,132,0.08)", border: "1px solid rgba(61,220,132,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--green)", marginBottom: 8 }}>⚠️ No pudimos enviarte el email de confirmación</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Tu encuentro está reservado. Guarda el enlace de Google Meet ahora:</p>
                <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", wordBreak: "break-all", fontSize: 13, color: "var(--green)", textDecoration: "underline", marginBottom: 8 }}>
                  {meetLink}
                </a>
                {/* UX-05: cancel link even when email failed */}
                {cancelUrl && (
                  <a href={cancelUrl} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Cancelar esta reserva
                  </a>
                )}
                <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "8px 0 0" }}>
                  Si necesitas ayuda escribe a contacto@gustavoai.dev
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 }}>
                  Recibirás el enlace de Google Meet y la confirmación por email.
                </p>
                {/* UX-05: direct cancel link */}
                {cancelUrl && (
                  <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
                    También puedes{" "}
                    <a href={cancelUrl} style={{ color: "var(--text-muted)", textDecoration: "underline" }}>
                      cancelar esta reserva
                    </a>
                    {" "}directamente.
                  </p>
                )}
              </>
            )}

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
            <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: COLORS.errorBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: COLORS.error }}>✕</div>
            <Alert variant="error">{errorMsg}</Alert>
            <button onClick={() => setPhase("picking")} style={{ ...primaryBtnStyle, marginTop: 16 }}>Intentar de nuevo</button>
          </div>
        </div>
      </FullScreenShell>
    );
  }

  // ── Main booking UI ────────────────────────────────────────────────────────
  return (
    <FullScreenShell onBack={onBack} badgeType={badgeType} badgeLabel={badgeLabel} title={title}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, minHeight: 0 }} className="booking-split">

        {/* ── Sidebar ── */}
        <div style={{ borderRight: "1px solid var(--border)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <TutorRow />
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-serif), serif", fontSize: 20, color: "var(--text)", lineHeight: 1.2 }}>
              {sessionType === "free15min" && <>Encuentro gratuito<br />de 15 min</>}
              {sessionType === "session1h"  && <>Sesión de<br />1 hora</>}
              {sessionType === "session2h"  && <>Sesión de<br />2 horas</>}
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <InfoRow icon="clock">{cfg.duration}</InfoRow>
            <InfoRow icon="phone">Google Meet</InfoRow>
            {userTz && <InfoRow icon="globe">Tu zona horaria: {userTz}</InfoRow>}
            <div style={{ height: 1, background: "var(--border)" }} />
            {cfg.price === null
              ? <span style={{ fontSize: 15, fontWeight: 500, color: "var(--green)" }}>Sin coste</span>
              : <span style={{ fontFamily: "var(--font-serif), serif", fontSize: 28, color: "var(--text)" }}>{cfg.price}</span>
            }
          </div>
          <MetaRows />
        </div>

        {/* ── Calendar / confirm / spinner area ── */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          {phase === "booking" || phase === "redirecting" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12 }}>
              <Spinner />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {phase === "redirecting" ? "Redirigiendo al pago…" : `Reservando ${selected?.dateLabel} a las ${selected?.label}…`}
              </p>
            </div>
          ) : phase === "selected" && selected ? (
            // UX-02: confirm panel for free / reschedule flows
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: 480 }}>
                <ConfirmPanel
                  slot={selected}
                  onConfirm={handleConfirm}
                  onCancel={() => setPhase("picking")}
                  sessionDuration={cfg.duration}
                  isReschedule={!!rescheduleToken}
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
      </div>

      <style>{`
        @media (max-width: 720px) { .booking-split { grid-template-columns: 1fr !important; } }
      `}</style>
    </FullScreenShell>
  );
}
