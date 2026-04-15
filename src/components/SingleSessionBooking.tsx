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
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Spinner, Alert } from "@/components/ui";
import { COLORS } from "@/constants";
import { friendlyError } from "@/constants/errors";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import BookingLayout from "@/components/booking/BookingLayout";
import WizardProgress from "@/components/booking/WizardProgress";
import BookingSidebar from "@/components/booking/BookingSidebar";
import PaymentForm from "@/components/PaymentForm";
import {
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
  /** Pre-selected slot from AvailabilityModal. Only applied for session1h
   *  (exact duration match). 15min and 2h start in "picking" phase. */
  initialSlot?:     SelectedSlot;
}

// "review" = slot chosen, waiting for user to confirm before payment/booking
// "paying" = embedded PaymentElement shown inside the booking layout
type Phase = "picking" | "review" | "booking" | "paying" | "success" | "error";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

export default function SingleSessionBooking({
  sessionType,
  userName,
  userEmail,
  rescheduleToken,
  onBack,
  initialSlot,
}: SingleSessionBookingProps) {
  const router = useRouter();
  const cfg = SESSION_CONFIGS[sessionType];

  // 1h: start in "review" phase with the slot pre-filled (exact match).
  // 15min/2h: start in "picking" phase but pre-focus the slot in the calendar
  //           so it appears as if the user already clicked it.
  const supportsPreSelect = !!initialSlot;

  // Initial week offset — navigate the calendar to the week containing the
  // pre-selected slot so the user sees it immediately.
  const initialWeekOffset = (() => {
    if (!initialSlot) return 0;
    const slotDate = new Date(initialSlot.startIso);
    slotDate.setHours(0, 0, 0, 0);
    const slotMonday = new Date(slotDate);
    slotMonday.setDate(slotDate.getDate() - ((slotDate.getDay() + 6) % 7));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Math.max(0, Math.round(
      (slotMonday.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    ));
  })();

  const [phase,          setPhase]          = useState<Phase>(supportsPreSelect ? "review" : "picking");
  const [errorMsg,       setErrorMsg]       = useState("");
  const [selected,       setSelected]       = useState<SelectedSlot | null>(supportsPreSelect ? initialSlot! : null);
  const [focusedSlot,    setFocusedSlot]    = useState<SelectedSlot | null>(null);
  const [note,           setNote]           = useState("");
  const [sessionUrl,     setSessionUrl]     = useState("");
  const [cancelToken,    setCancelToken]    = useState("");
  const [emailFailed,    setEmailFailed]    = useState(false);
  const [userTz,         setUserTz]         = useState<string>("");
  const [clientSecret,   setClientSecret]   = useState<string | null>(null);

  useEffect(() => {
    try {
      const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const gmt    = `GMT${offset >= 0 ? "+" : ""}${offset}`;
      setUserTz(`${tz} (${gmt})`);
    } catch { /* ignore */ }
  }, []);

  // Slot selected → always show review step first
  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
    setFocusedSlot(null);
    setPhase("review");
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setPhase("booking");
    try {
      const data = await api.book.post({
        startIso:        selected.startIso,
        endIso:          selected.endIso,
        sessionType:     sessionType === "free15min" ? "free15min" : sessionType,
        note:            note || undefined,
        timezone:        selected.timezone,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      setSessionUrl(data.cancelToken ? `${BASE_URL}/sesion/${data.cancelToken}` : "");
      setCancelToken(data.cancelToken);
      setEmailFailed(data.emailFailed);
      setPhase("success");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const raw    = err instanceof ApiError ? err.message : "Error al reservar.";
      setErrorMsg(friendlyError(status, raw));
      setPhase("error");
    }
  }, [selected, sessionType, rescheduleToken, note]);

  async function handleStartPayment() {
    if (!selected) return;
    setPhase("booking"); // show spinner while fetching the PI
    try {
      const duration = sessionType === "session1h" ? "1h" : "2h";
      const { clientSecret } = await api.stripe.checkout({
        type:            "single",
        duration,
        startIso:        selected.startIso,
        endIso:          selected.endIso,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      setClientSecret(clientSecret);
      setPhase("paying");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const raw    = err instanceof ApiError ? err.message : "Error al iniciar el pago.";
      setErrorMsg(friendlyError(status, raw));
      setPhase("error");
    }
  }

  // UX-05: direct cancel link
  const cancelUrl = cancelToken ? `${BASE_URL}/cancelar?token=${cancelToken}` : null;

  const needsPaymentStep = (sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken;

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <BookingLayout>
        <WizardProgress currentStep={3} showPaymentStep={needsPaymentStep} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px", background: "rgba(78,222,163,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#4edea3" }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: "#e5e1e4", marginBottom: 6, fontFamily: "var(--font-headline, Manrope), sans-serif" }}>¡Encuentro reservado!</h2>
            <p style={{ fontSize: 14, color: "#bbcabf", marginBottom: 16 }}>{selected?.dateLabel} · {selected?.label}</p>

            {emailFailed ? (
              <div style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#4edea3", marginBottom: 8 }}>⚠️ No pudimos enviarte el email de confirmación</p>
                <p style={{ fontSize: 12, color: "#bbcabf", marginBottom: 12 }}>Tu encuentro está reservado. Accede a tu sesión aquí:</p>
                <a href={sessionUrl} style={{ display: "block", fontSize: 13, color: "#4edea3", textDecoration: "underline", marginBottom: 8 }}>Unirse a la sesión →</a>
                {cancelUrl && (
                  <a href={cancelUrl} style={{ display: "block", fontSize: 12, color: "#bbcabf", marginTop: 4 }}>Cancelar esta reserva</a>
                )}
                <p style={{ fontSize: 11, color: "#86948a", margin: "8px 0 0" }}>
                  Si necesitas ayuda escribe a contacto@gustavoai.dev
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#bbcabf", marginBottom: 8 }}>Recibirás el enlace de la sesión y la confirmación por email.</p>
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
        <WizardProgress currentStep={2} showPaymentStep={needsPaymentStep} />
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

  // ── Paying (embedded PaymentElement) ──────────────────────────────────────
  if (phase === "paying" && selected && clientSecret) {
    return (
      <BookingLayout>
        <WizardProgress currentStep={4} showPaymentStep />
        <div className="max-w-md mx-auto w-full" style={{ padding: "32px 16px" }}>
          <p
            className="font-bold uppercase"
            style={{ fontSize: 10, color: "#4edea3", letterSpacing: "0.2em", marginBottom: 20 }}
          >
            Pago seguro
          </p>
          <p className="text-sm mb-6" style={{ color: "#bbcabf" }}>
            {selected.dateLabel} · {selected.label.split(/\s*[–\-]\s*/)[0]}
          </p>
          <PaymentForm
            clientSecret={clientSecret}
            onSuccess={(paymentIntentId) =>
              router.push(`/sesion-confirmada?payment_intent_id=${paymentIntentId}`)
            }
            onCancel={() => { setClientSecret(null); setPhase("review"); }}
          />
        </div>
      </BookingLayout>
    );
  }

  // ── Main booking UI ────────────────────────────────────────────────────────
  const wizardStep: 1 | 2 | 3 = phase === "review" ? 3 : 2;
  const isReschedule = !!rescheduleToken;

  return (
    <BookingLayout>
      <WizardProgress currentStep={wizardStep} showPaymentStep={needsPaymentStep} />

      {phase === "review" && selected ? (
        /* ── Review layout: 7+5 columns ─────────────────────────────────────── */
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* ── Main card (left, 7 cols) ── */}
          <div
            className="order-2 lg:order-1 lg:col-span-7 rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "#1c1b1d",
              boxShadow: "0 0 0 1px rgba(78,222,163,0.08), 0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            {/* Section 1: Header */}
            <div
              className="relative px-4 md:px-8 pt-6 md:pt-8 pb-6"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Decorative event_available icon — desktop only */}
              <div className="hidden md:block absolute top-0 right-0 p-6 pointer-events-none" style={{ opacity: 0.05 }}>
                <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <polyline points="7.5 15.5 10.5 18.5 16.5 12.5"/>
                </svg>
              </div>

              <p
                className="font-bold uppercase"
                style={{ fontSize: 10, color: "#4edea3", letterSpacing: "0.2em", marginBottom: 20 }}
              >
                Detalles de la cita
              </p>

              <div className="flex items-center gap-4">
                <div
                  className="flex-shrink-0 p-3 rounded-xl flex items-center justify-center"
                  style={{ background: "#201f22" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: "#bbcabf" }}>Fecha y Hora Seleccionada</p>
                  <p className="text-xl font-extrabold font-headline tracking-tight" style={{ color: "#e5e1e4" }}>
                    {selected.dateLabel} — {selected.label.split(/\s*[–\-]\s*/)[0]}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Contextual notice */}
            {(isReschedule || cfg.price) && (
              <div
                className="px-4 md:px-8 py-4 md:py-5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                {isReschedule ? (
                  <div
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(59,130,246,0.2)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-sm font-medium" style={{ color: "#93c5fd" }}>
                      Reprogramación gratuita — no se realiza ningún cobro
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.12) 100%)",
                      border: "1px solid rgba(78,222,163,0.2)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <p className="text-sm font-medium" style={{ color: "#4edea3" }}>
                      Serás redirigido a Stripe para completar el pago
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Note textarea */}
            <div
              className="px-4 md:px-8 py-5 md:py-6 flex-1 flex flex-col"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <label
                className="block font-bold uppercase"
                style={{ fontSize: 10, color: "#e5e1e4", letterSpacing: "0.2em", marginBottom: 16 }}
              >
                Motivo de la sesión{" "}
                <span className="normal-case font-normal" style={{ color: "#bbcabf", letterSpacing: "normal", fontSize: 12 }}>(opcional)</span>
              </label>
              <div className="relative flex-1">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Ej: tengo dudas sobre recursividad en Java, preparación de entrevista técnica..."
                  className="w-full h-full"
                  style={{
                    minHeight: "7rem",
                    padding: "16px 40px 16px 16px",
                    background: "#0e0e10",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    color: "#e5e1e4",
                    fontFamily: "inherit",
                    fontSize: 14,
                    lineHeight: 1.6,
                    resize: "none",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(78,222,163,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(78,222,163,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div className="absolute bottom-3 right-3 pointer-events-none" style={{ opacity: 0.2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
              </div>
              <p className="flex items-center gap-1.5" style={{ marginTop: 10, fontSize: 11, color: "#86948a" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                También puedes enviar los detalles por email después
              </p>
            </div>

            {/* Section 4: CTA */}
            <div className="px-4 md:px-8 py-5 md:py-6">
              <div className="flex items-center justify-between gap-4">
                {/* Back button */}
                <button
                  onClick={() => { setPhase("picking"); setNote(""); setFocusedSlot(selected); }}
                  className="flex items-center gap-2 font-semibold transition-colors group flex-shrink-0"
                  style={{ color: "#bbcabf", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Volver atrás</span>
                </button>

                {/* Confirm button */}
                <button
                  onClick={() => {
                    const needsStripe = (sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken;
                    if (needsStripe) handleStartPayment();
                    else void handleConfirm();
                  }}
                  className="group flex items-center justify-center gap-2"
                  style={{ ...primaryBtnStyle, width: "auto", paddingLeft: 32, paddingRight: 32 }}
                >
                  <span className="sm:hidden">Confirmar</span>
                  <span className="hidden sm:inline">{isReschedule ? "Confirmar reprogramación" : cfg.price ? "Confirmar pago" : "Confirmar reserva"}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Summary sidebar (right, 5 cols) ── */}
          <div className="order-1 lg:order-2 lg:col-span-5 flex flex-col">
            <div
              className="rounded-xl overflow-hidden flex flex-col flex-1"
              style={{
                background: "#201f22",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(78,222,163,0.06)",
              }}
            >
              {/* Hero area */}
              <div className="h-32 relative overflow-hidden">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCNL3zn2YTYaO_hmbb57yzENelgbezrtOYRkI0wzW9Z4G_EpOWuwa0LT9KVy9VtWo2BxDSDjbuxyxZEfsWLJJIlFKeSHVTNRymMJ2-SPExdi6Nt_yFfNoqKma8TUebR5hch_bTaDj4ezkdy1GIHCmkwIZJpmYWdDAUlzcY6BiHlX79U-YxDZDWoL5hwLk4UoIyTcTZe4W_zJdpb8pqshHykMhp1M3mgD9ROlLalXQhZ8WZLdfGRqxxzncfpXPx6gLjVOzh6yaeehQ"
                  alt=""
                  fill
                  className="object-cover grayscale brightness-50"
                  aria-hidden="true"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #201f22 0%, transparent 100%)" }} />
                <div className="absolute bottom-4 left-6">
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(78,222,163,0.15)",
                      color: "#4edea3",
                      border: "1px solid rgba(78,222,163,0.3)",
                    }}
                  >
                    Resumen
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 flex flex-col flex-1 justify-between gap-6">

                {/* Session label + duration */}
                <div
                  className="flex justify-between items-center pb-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span style={{ color: "#bbcabf" }}>{cfg.label}</span>
                  <span className="font-bold" style={{ color: "#e5e1e4" }}>{cfg.duration}</span>
                </div>

                {/* Detail rows */}
                <div className="space-y-3">
                  {/* Timezone */}
                  {userTz && (
                    <div className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-2 min-w-0" style={{ color: "#bbcabf" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        <span>Zona horaria</span>
                      </div>
                      <span className="text-right" style={{ color: "#e5e1e4" }}>{userTz}</span>
                    </div>
                  )}
                  {/* Platform */}
                  <div className="flex items-center justify-between text-sm gap-3">
                    <div className="flex items-center gap-2" style={{ color: "#bbcabf" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                      <span>Plataforma</span>
                    </div>
                    <span style={{ color: "#e5e1e4" }}>Zoom (en la app)</span>
                  </div>
                </div>

                {/* Total price */}
                {cfg.price && !isReschedule && (
                  <div
                    className="flex justify-between items-end pt-6"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div>
                      <p className="font-bold uppercase" style={{ fontSize: 10, color: "#bbcabf", letterSpacing: "0.15em", marginBottom: 4 }}>
                        Total a pagar
                      </p>
                      <p className="font-extrabold font-headline tracking-tighter" style={{ fontSize: 40, color: "#4edea3", lineHeight: 1 }}>
                        {cfg.price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: 10, color: "#86948a" }}>IVA incluido</p>
                    </div>
                  </div>
                )}

                {/* Security note */}
                <div
                  className="rounded-lg p-4 flex items-start gap-3"
                  style={{ background: "#1c1b1d" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0 mt-0.5" style={{ color: "#bbcabf" }} aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p className="leading-relaxed" style={{ fontSize: 11, color: "#bbcabf" }}>
                    Tu pago está protegido. El cargo se procesará al confirmar el siguiente paso.
                  </p>
                </div>

              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ── Picking / booking / redirecting layout: original 3+9 columns ───── */
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

          {/* ── Calendar / spinner area ── */}
          <div
            className="lg:col-span-9 rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "#1c1b1d",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex-1">
              {phase === "booking" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 12 }}>
                  <Spinner />
                  <p style={{ fontSize: 13, color: "#bbcabf" }}>
                    {`Reservando ${selected?.dateLabel} a las ${selected?.label}…`}
                  </p>
                </div>
              ) : (
                <WeeklyCalendar
                  durationMinutes={cfg.durationMinutes}
                  onSlotSelected={handleSlotSelected}
                  onSlotFocused={setFocusedSlot}
                  selectedSlot={selected}

                  initialWeekOffset={initialWeekOffset}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Cambiar tipo de sesión</span>
              </button>

              {phase === "picking" && (
                focusedSlot ? (
                  <button
                    onClick={() => handleSlotSelected(focusedSlot)}
                    className="flex items-center gap-2 font-semibold transition-colors group"
                    style={{ color: "#4edea3", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#6ee8b4"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4edea3"; }}
                  >
                    <span>Continuar</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ) : (
                  <div
                    className="hidden md:flex items-center gap-2 text-xs"
                    style={{ color: "#86948a" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Selecciona un horario para continuar
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </BookingLayout>
  );
}
