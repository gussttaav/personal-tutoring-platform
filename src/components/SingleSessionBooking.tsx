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
import { useTranslations } from "next-intl";
import { useClientValue } from "@/hooks/useClientValue";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Spinner,
  Alert,
  FeedbackCard,
  IconHalo,
  Eyebrow,
  FbTitle,
  FbBody,
  HeaderBlock,
  InfoBox,
  InfoRow,
  FbButton,
  ConfirmationChecklist,
  Helper,
} from "@/components/ui";
import { useScheduleConfig } from "@/components/booking/ScheduleProvider";
import { COLORS } from "@/constants";
import { errorCodeToKey } from "@/constants/errors";
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
import { useSessionPriceLabel } from "@/components/pricing/PricesProvider";

export type SingleSessionType = "free15min" | "session1h" | "session2h";

interface SingleSessionBookingProps {
  sessionType:      SingleSessionType;
  userName:         string;
  userEmail:        string;
  rescheduleToken?: string | null;
  onBack:           () => void;
  /** Pre-selected slot from AvailabilityModal. free15min pre-selects into
   *  "review"; session1h verifies 1h availability first (review if bookable,
   *  else picking with a notice); session2h starts in "picking". */
  initialSlot?:     SelectedSlot;
}

// "verifying" = checking whether the modal's 1h hint is actually bookable
// "review" = slot chosen, waiting for user to confirm before payment/booking
// "paying" = embedded PaymentElement shown inside the booking layout
type Phase = "picking" | "verifying" | "review" | "booking" | "paying" | "success" | "error";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

/** Full "HH:MM–HH:MM" range from a slot, timezone-aware when available. */
function formatTimeRange(slot: SelectedSlot): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-ES", {
      ...(slot.timezone ? { timeZone: slot.timezone } : {}),
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  return `${fmt(slot.startIso)}–${fmt(slot.endIso)}`;
}

// ─── Local feedback pieces (Emerald Nocturne) ──────────────────────────────

function MetaItem({ glyph, children }: { glyph: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 13, color: COLORS.textMuted }}
        aria-hidden="true"
      >
        {glyph}
      </span>
      {children}
    </span>
  );
}

function EventCard({
  title, dateLabel, timeLabel, tone = "brand",
}: {
  title: string;
  dateLabel?: string;
  timeLabel?: string;
  tone?: "brand" | "error";
}) {
  const err = tone === "error";
  const accent = err ? COLORS.error : COLORS.brand;
  return (
    <div
      style={{
        display: "flex", gap: 14, padding: "14px 16px",
        background: COLORS.background,
        border: `1px solid ${err ? "rgba(255,180,171,0.18)" : "rgba(78,222,163,0.18)"}`,
        borderRadius: 11, alignItems: "center",
        opacity: err ? 0.7 : 1,
      }}
    >
      <div
        style={{
          flexShrink: 0, width: 44, height: 44, borderRadius: 9,
          background: err ? "rgba(255,180,171,0.08)" : "rgba(78,222,163,0.10)",
          border: `1px solid ${err ? "rgba(255,180,171,0.22)" : "rgba(78,222,163,0.22)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: accent,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }} aria-hidden="true">
          event
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "var(--font-headline)", fontSize: 14, fontWeight: 700,
            color: COLORS.textPrimary, margin: "0 0 3px",
          }}
        >
          {title}
        </p>
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 4,
            fontSize: 12, color: COLORS.textSecondary,
          }}
        >
          {dateLabel && <MetaItem glyph="calendar_today">{dateLabel}</MetaItem>}
          {timeLabel && <MetaItem glyph="schedule">{timeLabel}</MetaItem>}
        </div>
      </div>
    </div>
  );
}

export default function SingleSessionBooking({
  sessionType,
  userName,
  userEmail,
  rescheduleToken,
  onBack,
  initialSlot,
}: SingleSessionBookingProps) {
  const t       = useTranslations("booking.singleSession");
  const tMV     = useTranslations("booking.modeView");
  const tErrors = useTranslations("errors");
  const router  = useRouter();
  const cfg     = SESSION_CONFIGS[sessionType];
  const schedule = useScheduleConfig();
  // Live price from the pricing table (null for the free 15-min session).
  const price   = useSessionPriceLabel(sessionType);

  // Synthesise the exact session-duration slot from the modal's 30-min start hint
  // (adjusts endIso + label to the real session length; the server validates it).
  const makeSessionSlot = (): SelectedSlot | null => {
    if (!initialSlot) return null;
    const start = new Date(initialSlot.startIso);
    const end   = new Date(start.getTime() + cfg.durationMinutes * 60_000);
    const pad   = (n: number) => String(n).padStart(2, "0");
    const fmt   = (d: Date) =>
      initialSlot.timezone
        ? d.toLocaleTimeString("es-ES", { timeZone: initialSlot.timezone, hour: "2-digit", minute: "2-digit", hour12: false })
        : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return {
      startIso:  initialSlot.startIso,
      endIso:    end.toISOString(),
      label:     `${fmt(start)}–${fmt(end)}`,
      dateLabel: initialSlot.dateLabel,
      timezone:  initialSlot.timezone,
    };
  };

  // AvailabilityModal emits a 30-min slot as a start hint (product-agnostic).
  // 15min: start+15 stays inside the clicked 30-min atom → always bookable, so we
  //      pre-select and jump straight to "review".
  // 1h: start+60 extends one atom beyond the hint, which a free 30-min atom does
  //      NOT guarantee. Start in "verifying" and check the real 60-min availability
  //      (see the effect below): bookable → "review"; otherwise → "picking" with a
  //      notice so the user chooses another slot.
  // 2h: start in "picking" and pre-focus the block in the calendar
  //      (initialFocusedSlotStart), which validates contiguity before highlighting
  //      — we can't synthesise a 2h slot from a 30-min hint.
  const reviewSlot     = initialSlot && sessionType === "free15min" ? makeSessionSlot() : null;
  const needsHourCheck = !!initialSlot && sessionType === "session1h";

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

  const [phase,          setPhase]          = useState<Phase>(
    reviewSlot ? "review" : needsHourCheck ? "verifying" : "picking",
  );
  const [errorMsg,       setErrorMsg]       = useState("");
  const [selected,       setSelected]       = useState<SelectedSlot | null>(reviewSlot);
  const [focusedSlot,    setFocusedSlot]    = useState<SelectedSlot | null>(null);
  // Set when the modal's 1h hint failed the availability check → shows a notice
  // in the picking phase.
  const [hourUnavailable, setHourUnavailable] = useState(false);
  const [note,           setNote]           = useState("");
  const [sessionUrl,     setSessionUrl]     = useState("");
  const [cancelToken,    setCancelToken]    = useState("");
  const [emailFailed,    setEmailFailed]    = useState(false);
  const [clientSecret,   setClientSecret]   = useState<string | null>(null);

  // Client timezone label ("<tz> (GMT±n)") after hydration; empty during SSR.
  const userTz = useClientValue(() => {
    try {
      const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const gmt    = `GMT${offset >= 0 ? "+" : ""}${offset}`;
      return `${tz} (${gmt})`;
    } catch { return ""; }
  }, "");

  // Slot selected → always show review step first
  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
    setFocusedSlot(null);
    setHourUnavailable(false);
    setPhase("review");
  }, []);

  // session1h from AvailabilityModal: the modal only guarantees the clicked 30-min
  // atom is free, not the full hour. Verify against the 60-min availability (which
  // encapsulates contiguity) before committing to review. Bookable → review;
  // otherwise → picking with a notice. On network error, degrade to picking (the
  // calendar's initialFocusedSlotStart still pre-focuses the hour if it's free).
  useEffect(() => {
    if (!needsHourCheck || !initialSlot) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const dayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(initialSlot.startIso));
        const tz  = encodeURIComponent(initialSlot.timezone ?? schedule.timezone);
        const res = await fetch(`/api/availability?date=${dayKey}&duration=60&tz=${tz}`, { signal: ctrl.signal });
        const data = await res.json();
        const targetMs = new Date(initialSlot.startIso).getTime();
        const bookable = Array.isArray(data.slots)
          && data.slots.some((s: { start: string }) => new Date(s.start).getTime() === targetMs);
        if (bookable) {
          setSelected(makeSessionSlot());
          setPhase("review");
        } else {
          setHourUnavailable(true);
          setPhase("picking");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPhase("picking");
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for the 1h hint
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
      const code   = err instanceof ApiError ? err.message : "";
      setErrorMsg(tErrors(errorCodeToKey(code, status) as Parameters<typeof tErrors>[0]));
      setPhase("error");
    }
  }, [selected, sessionType, rescheduleToken, note, tErrors]);

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
      const code   = err instanceof ApiError ? err.message : "";
      setErrorMsg(tErrors(errorCodeToKey(code, status) as Parameters<typeof tErrors>[0]));
      setPhase("error");
    }
  }

  // UX-05: direct cancel link
  const cancelUrl = cancelToken ? `${BASE_URL}/cancelar?token=${cancelToken}` : null;

  const needsPaymentStep = (sessionType === "session1h" || sessionType === "session2h") && !rescheduleToken;

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <BookingLayout scrollResetKey={phase}>
        <div className="flex items-start sm:items-center justify-center px-2 py-2 sm:py-6 sm:px-6">
          <FeedbackCard>
            <IconHalo tone="success" glyph="check" />

            <HeaderBlock>
              <Eyebrow tone="success">
                {emailFailed ? t("statusEmailFailed") : t("statusSuccess")}
              </Eyebrow>
              <FbTitle>{t("successTitle")}</FbTitle>
              {emailFailed && (
                <FbBody>
                  {t("emailFailedBodyPrefix")}{" "}
                  <strong style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
                    {t("emailFailedBodyBold")}
                  </strong>{" "}
                  {t("emailFailedBodySuffix")}
                </FbBody>
              )}
            </HeaderBlock>

            <EventCard
              title={tMV(`sessions.${cfg.type}.label`)}
              dateLabel={selected?.dateLabel}
              timeLabel={selected ? formatTimeRange(selected) : undefined}
            />

            {emailFailed ? (
              <InfoBox tone="warning">
                <InfoRow glyph="manage_accounts" tone="warning">
                  {t("personalAreaNote")}
                </InfoRow>
              </InfoBox>
            ) : (
              <ConfirmationChecklist />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FbButton variant="primary" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">login</span>
                {t("goToPersonalArea")}
              </FbButton>
              <FbButton variant="ghost" onClick={onBack} style={{ width: "100%" }}>
                {t("backToHome")}
              </FbButton>
            </div>

            <Helper>
              {emailFailed ? (
                <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
                  {t("helpEmailFailed")}
                </a>
              ) : (
                t("helpGeneral")
              )}
            </Helper>
          </FeedbackCard>
        </div>
      </BookingLayout>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <BookingLayout scrollResetKey={phase}>
        <div className="flex items-start sm:items-center justify-center px-2 py-2 sm:py-6 sm:px-6">
          <FeedbackCard>
            <IconHalo tone="error" glyph="error" />

            <HeaderBlock>
              <Eyebrow tone="error">{t("errorEyebrow")}</Eyebrow>
              <FbTitle>{t("errorTitle")}</FbTitle>
              <FbBody>
                {t("errorSlotAvailable")}
              </FbBody>
            </HeaderBlock>

            {selected && (
              <EventCard
                title={tMV(`sessions.${cfg.type}.label`)}
                dateLabel={selected.dateLabel}
                timeLabel={formatTimeRange(selected)}
                tone="error"
              />
            )}

            <InfoBox tone="error">
              <InfoRow glyph="info" tone="error">
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.error, marginBottom: 2 }}>
                  {t("whatHappened")}
                </div>
                <div style={{ color: COLORS.textSecondary, lineHeight: 1.5 }}>{errorMsg}</div>
              </InfoRow>
            </InfoBox>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FbButton variant="primary" onClick={() => setPhase("picking")} style={{ width: "100%" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">refresh</span>
                {t("tryAgain")}
              </FbButton>
              <FbButton variant="ghost" onClick={() => setPhase("picking")} style={{ width: "100%" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">arrow_back</span>
                {t("chooseAnotherSlot")}
              </FbButton>
            </div>

            <Helper>
              <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
                {t("helpStillFailing")}
              </a>
            </Helper>
          </FeedbackCard>
        </div>
      </BookingLayout>
    );
  }

  // ── Paying (embedded PaymentElement) ──────────────────────────────────────
  if (phase === "paying" && selected && clientSecret) {
    return (
      <BookingLayout scrollResetKey={phase}>
        <WizardProgress currentStep={4} showPaymentStep spacingClassName="mt-4 sm:mt-0 mb-5 sm:mb-8" />
        <div className="max-w-lg mx-auto w-full" style={{ paddingBottom: 16 }}>
          <PaymentForm
            clientSecret={clientSecret}
            studentName={userName}
            studentEmail={userEmail}
            appointmentLabel={`${selected.dateLabel} · ${selected.label.split(/\s*[–\-]\s*/)[0]}`}
            priceLabel={price ?? undefined}
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
    <BookingLayout scrollResetKey={phase}>
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
                style={{ fontSize: 10, color: "#4edea3", letterSpacing: "0.2em", marginBottom: 10 }}
              >
                {t("appointmentDetails")}
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
                  <p className="text-xl font-extrabold font-headline tracking-tight" style={{ color: "#e5e1e4" }}>
                    {selected.dateLabel}
                  </p>
                  <p className="font-headline tracking-tight" style={{ color: "#4edea3", fontSize: 15, marginTop: 2 }}>
                    {selected.label}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Contextual notice — always present in review. One of:
                reschedule note, paid price pill (mobile) / security badge (desktop),
                or free-session pill (mobile) / badge (desktop). */}
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
                      {t("rescheduleNote")}
                    </p>
                  </div>
                ) : price ? (
                  <>
                    {/* Below lg the summary sidebar is hidden, so this slot carries
                        the price + timezone instead of the security badge — that
                        payment happens next is already told by the wizard's
                        Payment step. */}
                    <div
                      className="lg:hidden rounded-xl px-4 py-3 flex flex-col gap-2.5"
                      style={{
                        background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.12) 100%)",
                        border: "1px solid rgba(78,222,163,0.2)",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="font-bold uppercase"
                          style={{ fontSize: 10, color: "#bbcabf", letterSpacing: "0.15em" }}
                        >
                          {t("total")}
                        </span>
                        <span
                          className="font-headline font-extrabold"
                          style={{ fontSize: 24, color: "#4edea3", letterSpacing: "-0.02em", lineHeight: 1 }}
                        >
                          {price}
                        </span>
                      </div>

                      {userTz && (
                        <div
                          className="flex items-center gap-2"
                          style={{
                            color: "#bbcabf",
                            borderTop: "1px solid rgba(78,222,163,0.15)",
                            paddingTop: 10,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                          <span className="text-xs">{userTz}</span>
                        </div>
                      )}
                    </div>

                    {/* lg+: the sidebar already shows price + timezone */}
                    <div
                      className="hidden lg:flex rounded-xl px-4 py-3 items-center gap-3"
                      style={{
                        background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.12) 100%)",
                        border: "1px solid rgba(78,222,163,0.2)",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <p className="text-sm font-medium" style={{ color: "#4edea3" }}>
                        {t("paymentSecure")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Free session. Below lg the sidebar (with its "free" +
                        duration) is hidden, so this pill carries them plus the
                        timezone. */}
                    <div
                      className="lg:hidden rounded-xl px-4 py-3 flex flex-col gap-2.5"
                      style={{
                        background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.12) 100%)",
                        border: "1px solid rgba(78,222,163,0.2)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2" style={{ color: "#bbcabf" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span className="text-xs">{tMV(`sessions.${cfg.type}.duration`)}</span>
                        </div>
                        <span
                          className="font-headline font-extrabold"
                          style={{ fontSize: 20, color: "#4edea3", letterSpacing: "-0.02em", lineHeight: 1 }}
                        >
                          {t("free")}
                        </span>
                      </div>

                      {userTz && (
                        <div
                          className="flex items-center gap-2"
                          style={{
                            color: "#bbcabf",
                            borderTop: "1px solid rgba(78,222,163,0.15)",
                            paddingTop: 10,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                          <span className="text-xs">{userTz}</span>
                        </div>
                      )}
                    </div>

                    {/* lg+: the sidebar already shows the free indicator + duration */}
                    <div
                      className="hidden lg:flex rounded-xl px-4 py-3 items-center gap-3"
                      style={{
                        background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.12) 100%)",
                        border: "1px solid rgba(78,222,163,0.2)",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <p className="text-sm font-medium" style={{ color: "#4edea3" }}>
                        {t("freeNote")}
                      </p>
                    </div>
                  </>
                )}
              </div>

            {/* Section 3: Note textarea */}
            <div
              className="px-4 md:px-8 py-5 md:py-6 flex-1 flex flex-col"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <label
                className="block font-bold uppercase"
                style={{ fontSize: 10, color: "#e5e1e4", letterSpacing: "0.2em", marginBottom: 16 }}
              >
                {t("sessionReasonLabel")}{" "}
                <span className="normal-case font-normal" style={{ color: "#bbcabf", letterSpacing: "normal", fontSize: 12 }}>{t("sessionReasonOptional")}</span>
              </label>
              <div className="relative flex-1">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder={t("sessionReasonPlaceholder")}
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
                {t("emailAfterNote")}
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
                  <span>{t("back")}</span>
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
                  <span className="sm:hidden">{t("confirmShort")}</span>
                  <span className="hidden sm:inline">{isReschedule ? t("confirmReschedule") : price ? t("confirmPay") : t("confirmBook")}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Summary sidebar (right, 5 cols) ── */}
          <div className="hidden lg:flex flex-col lg:order-2 lg:col-span-5">
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
                  sizes="420px"
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
                    {t("summaryTitle")}
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
                  <span style={{ color: "#bbcabf" }}>{tMV(`sessions.${cfg.type}.label`)}</span>
                  <span className="font-bold" style={{ color: "#e5e1e4" }}>{tMV(`sessions.${cfg.type}.duration`)}</span>
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
                        <span>{t("timezone")}</span>
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
                      <span>{t("platform")}</span>
                    </div>
                    <span style={{ color: "#e5e1e4" }}>{t("platformValue")}</span>
                  </div>
                </div>

                {/* Total price — paid only. Free sessions convey "no charge"
                    through the note below, so no TOTAL row here. */}
                {price && !isReschedule && (
                  <div
                    className="flex justify-between items-end pt-6"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div>
                      <p className="font-bold uppercase" style={{ fontSize: 10, color: "#bbcabf", letterSpacing: "0.15em", marginBottom: 4 }}>
                        {t("total")}
                      </p>
                      <p className="font-extrabold font-headline tracking-tighter" style={{ fontSize: 40, color: "#4edea3", lineHeight: 1 }}>
                        {price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: 10, color: "#86948a" }}>{t("vatIncluded")}</p>
                    </div>
                  </div>
                )}

                {/* Bottom note. Free session (no price, not a reschedule) →
                    "no payment required"; every other case keeps the original
                    payment-protected note (paid, and reschedule as before). */}
                {!price && !isReschedule ? (
                  <div
                    className="rounded-lg p-4 flex items-start gap-3"
                    style={{ background: "#1c1b1d" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <p className="leading-relaxed" style={{ fontSize: 11, color: "#bbcabf" }}>
                      {t("freeNote")}
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-lg p-4 flex items-start gap-3"
                    style={{ background: "#1c1b1d" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0 mt-0.5" style={{ color: "#bbcabf" }} aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <p className="leading-relaxed" style={{ fontSize: 11, color: "#bbcabf" }}>
                      {t("paymentProtected")}
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ── Picking / booking / redirecting layout: original 3+9 columns ───── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
          {/* ── Sidebar ── */}
          <BookingSidebar
            mode="single"
            sessionName={tMV(`sessions.${cfg.type}.label`)}
            duration={tMV(`sessions.${cfg.type}.duration`)}
            price={price}
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
            {hourUnavailable && phase === "picking" && (
              <div style={{ padding: "16px 16px 0" }}>
                <Alert variant="warning">{t("hourUnavailableNotice")}</Alert>
              </div>
            )}
            <div className="flex-1">
              {phase === "booking" || phase === "verifying" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 12 }}>
                  <Spinner />
                  <p style={{ fontSize: 13, color: "#bbcabf" }}>
                    {phase === "verifying"
                      ? t("verifyingAvailability")
                      : t("bookingProgress", { dateLabel: selected?.dateLabel ?? "", label: selected?.label ?? "" })}
                  </p>
                </div>
              ) : (
                <WeeklyCalendar
                  durationMinutes={cfg.durationMinutes}
                  onSlotSelected={handleSlotSelected}
                  onSlotFocused={(slot) => {
                    setFocusedSlot(slot);
                    if (slot) {
                      setHourUnavailable(false);
                      // Picking a different valid slot clears the previously chosen
                      // one so the grid never shows the old confirmed slot alongside
                      // the new focus.
                      if (slot.startIso !== selected?.startIso) setSelected(null);
                    }
                  }}
                  selectedSlot={selected}
                  initialFocusedSlotStart={initialSlot?.startIso}
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
                <span>{t("changeSessionType")}</span>
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
                    <span>{t("continueButton")}</span>
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
                    {t("selectSlotHint")}
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
