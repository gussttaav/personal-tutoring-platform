"use client";

/**
 * BookingModeView — Emerald Nocturne · booking.html layout
 *
 * ALL LOGIC IS IDENTICAL TO ORIGINAL.
 * Layout replaced to match booking.html:
 *   - BookingLayout (full-page overlay with real Navbar + Footer)
 *   - WizardProgress (3-step indicator)
 *   - lg:grid-cols-12 with BookingSidebar (col-span-3) + calendar (col-span-9)
 *   - Calendar container matches booking.html structure
 *   - Actions bar at bottom of calendar container
 *
 * All exports preserved with identical signatures:
 *   FullScreenShell, ConfirmPanel, TutorRow, InfoRow, MetaRows,
 *   SESSION_CONFIGS, primaryBtnStyle, secondaryBtnStyle
 */

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useClientValue } from "@/hooks/useClientValue";
import Image from "next/image";
import { Alert, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { errorCodeToKey } from "@/constants/errors";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import BookingLayout from "@/components/booking/BookingLayout";
import BookingSidebar from "@/components/booking/BookingSidebar";
import { useScheduleConfig } from "@/components/booking/ScheduleProvider";
import type { StudentInfo } from "@/domain/types";

// A pack class is always a 1-hour session.
const PACK_SESSION_MINUTES = 60;

// "verifying" = checking whether the modal's 30-min start hint is actually
// bookable as a full 1h pack slot before opening the confirm panel.
type BookingPhase = "idle" | "verifying" | "selected" | "confirming" | "error";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

interface BookingModeViewProps {
  student:           StudentInfo;
  rescheduleToken?:  string | null;
  onCreditsUpdated:  (remaining: number) => void;
  onExit:            () => void;
  hideTopBar?:       boolean;
  packTotal?:        number | null;
  /** Pre-selected 1h slot from AvailabilityModal — opens ConfirmPanel immediately */
  initialSlot?:      SelectedSlot;
}

interface SuccessBanner {
  dateLabel:    string;
  label:        string;
  isReschedule: boolean;
  sessionUrl:   string;
  cancelUrl:    string | null;
  emailFailed:  boolean;
}

export default function BookingModeView({
  student,
  rescheduleToken,
  onCreditsUpdated,
  onExit,
  // hideTopBar is no longer used — BookingLayout always shows the full nav
  packTotal,
  initialSlot,
}: BookingModeViewProps) {
  const t      = useTranslations("booking.modeView");
  const tErrors = useTranslations("errors");
  const schedule = useScheduleConfig();
  // A pre-selected slot from AvailabilityModal is only a 30-min start hint, not a
  // bookable 1h slot — start in "verifying" and confirm the full hour first.
  const [phase,                setPhase]                = useState<BookingPhase>(initialSlot ? "verifying" : "idle");
  const [remaining,            setRemaining]            = useState(student.credits);
  const [errMsg,               setErrMsg]               = useState("");
  const [selected,             setSelected]             = useState<SelectedSlot | null>(null);
  const [successBanner,        setSuccessBanner]        = useState<SuccessBanner | null>(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);

  // Synthesise the real 1-hour pack slot from the modal's 30-min start hint
  // (adjusts endIso + label to the full hour; the server re-validates on book).
  const makeHourSlot = (): SelectedSlot | null => {
    if (!initialSlot) return null;
    const start = new Date(initialSlot.startIso);
    const end   = new Date(start.getTime() + PACK_SESSION_MINUTES * 60_000);
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

  // Navigate the calendar to the week containing the pre-selected slot so the
  // user sees it immediately (mirrors SingleSessionBooking).
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

  // The modal only guarantees the clicked 30-min atom is free, not the full hour.
  // Verify against the 60-min availability (which encapsulates contiguity) before
  // opening the confirm panel. Bookable → "selected" with the synthesised hour;
  // otherwise → "idle" so the user picks a valid 1h block in the calendar (the
  // hint is still pre-focused via initialFocusedSlotStart when it is free). On
  // network error, degrade to "idle".
  useEffect(() => {
    if (!initialSlot) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const dayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(initialSlot.startIso));
        const tz  = encodeURIComponent(initialSlot.timezone ?? schedule.timezone);
        const res = await fetch(`/api/availability?date=${dayKey}&duration=${PACK_SESSION_MINUTES}&tz=${tz}`, { signal: ctrl.signal });
        const data = await res.json();
        const targetMs = new Date(initialSlot.startIso).getTime();
        const bookable = Array.isArray(data.slots)
          && data.slots.some((s: { start: string }) => new Date(s.start).getTime() === targetMs);
        if (bookable) {
          setSelected(makeHourSlot());
          setPhase("selected");
        } else {
          setPhase("idle");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPhase("idle");
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for the modal hint
  }, []);

  // Client timezone label ("<tz> (GMT±n)") after hydration; empty during SSR.
  const userTz = useClientValue(() => {
    try {
      const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const gmt    = `GMT${offset >= 0 ? "+" : ""}${offset}`;
      return `${tz} (${gmt})`;
    } catch { return ""; }
  }, "");

  // Re-seed the editable credit count when the upstream credits change
  // (render-phase "adjust state on input change" — not an effect).
  const [prevCredits, setPrevCredits] = useState(student.credits);
  if (student.credits !== prevCredits) {
    setPrevCredits(student.credits);
    setRemaining(student.credits);
  }

  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
    setPhase("selected");
  }, []);

  const isReschedule = !!rescheduleToken;

  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setPhase("confirming");
    try {
      const data = await api.book.post({
        startIso:        selected.startIso,
        endIso:          selected.endIso,
        sessionType:     "pack",
        note:            selected.note,
        timezone:        selected.timezone,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      const newRemaining = isReschedule ? remaining : remaining - 1;
      setRemaining(newRemaining);
      onCreditsUpdated(newRemaining);
      if (!isReschedule && newRemaining === 0) {
        onExit();
        return;
      }
      setSuccessBanner({
        dateLabel:   selected.dateLabel,
        label:       selected.label,
        isReschedule,
        sessionUrl:  data.cancelToken ? `${BASE_URL}/sesion/${data.cancelToken}` : "",
        cancelUrl:   data.cancelToken ? `${BASE_URL}/cancelar?token=${data.cancelToken}` : null,
        emailFailed: data.emailFailed,
      });
      setCalendarRefreshToken((t) => t + 1);
      setPhase("idle");
      setSelected(null);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code   = err instanceof ApiError ? err.message : "";
      setErrMsg(tErrors(errorCodeToKey(code, status) as Parameters<typeof tErrors>[0]));
      setPhase("error");
    }
  }, [selected, remaining, rescheduleToken, isReschedule, onCreditsUpdated, onExit, tErrors]);

  const showModal = (phase === "selected" || phase === "confirming" || phase === "error") && selected;

  // ── Main booking UI ────────────────────────────────────────────────────────

  return (
    <BookingLayout>
      {/* ── Success banner ── */}
      {successBanner && (
        <div
          style={{
            marginBottom: 24,
            background: "rgba(78,222,163,0.08)",
            border: "1px solid rgba(78,222,163,0.25)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#4edea3", marginBottom: 4 }}>
              {successBanner.isReschedule ? t("successReschedule") : t("successBook")}
            </p>
            <p style={{ fontSize: 13, color: "#bbcabf" }}>
              {successBanner.dateLabel} · {successBanner.label}
              {!successBanner.isReschedule && remaining > 0 && (
                <> — {t("creditsRemaining", { remaining })}</>
              )}
              {!successBanner.isReschedule && remaining === 0 && (
                <> — <span style={{ color: COLORS.warning }}>{t("creditsExhausted")}</span></>
              )}
            </p>
            {successBanner.emailFailed && successBanner.sessionUrl && (
              <>
                <p style={{ fontSize: 12, color: "#bbcabf", marginTop: 6 }}>
                  {t("emailError")}
                </p>
                <a
                  href={successBanner.sessionUrl}
                  style={{ fontSize: 12, color: "#4edea3", textDecoration: "underline", display: "block", marginTop: 2 }}
                >
                  {t("joinSession")}
                </a>
              </>
            )}
            {successBanner.cancelUrl && (
              <a
                href={successBanner.cancelUrl}
                style={{ fontSize: 12, color: "#86948a", display: "block", marginTop: 4 }}
              >
                {t("cancelBooking")}
              </a>
            )}
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            aria-label={t("close")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#86948a", flexShrink: 0, fontSize: 20, lineHeight: 1, padding: 2,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Sidebar ── */}
        <BookingSidebar
          mode="pack"
          sessionName={t("sessionName")}
          duration={t("sessionDuration")}
          packRemaining={remaining}
          packTotal={packTotal ?? remaining}
          isReschedule={isReschedule}
          userTz={userTz}
        />

        {/* ── Calendar area ── */}
        <div
          className="lg:col-span-9 rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "#1c1b1d",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex-1">
            {phase === "verifying" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 12 }}>
                <Spinner />
                <p style={{ fontSize: 13, color: "#bbcabf" }}>{t("verifyingAvailability")}</p>
              </div>
            ) : (
              <WeeklyCalendar
                durationMinutes={60}
                onSlotSelected={handleSlotSelected}
                onSlotFocused={(slot) => {
                  // Focusing a different valid slot drops the prior confirmed
                  // highlight so the grid shows only the new preselection (not both).
                  if (slot && slot.startIso !== selected?.startIso) setSelected(null);
                }}
                selectedSlot={selected}
                initialFocusedSlotStart={initialSlot?.startIso}
                initialWeekOffset={initialWeekOffset}
                refreshToken={calendarRefreshToken}
              />
            )}
          </div>

          {/* ── Actions bar ── */}
          <div
            className="p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#1c1b1d" }}
          >
            <button
              onClick={onExit}
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
              <span>{t("changeSessionType")}</span>
            </button>

          </div>
        </div>
      </div>

      {/* ── Confirmation modal ── */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { if (phase !== "confirming") { setPhase("idle"); } }}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            aria-hidden="true"
          />
          {/* Modal card */}
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 201,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "24px 16px", pointerEvents: "none",
            }}
          >
            <div style={{ width: "100%", maxWidth: 520, pointerEvents: "auto" }}>
              {phase === "confirming" ? (
                <div
                  style={{
                    background: "#201f22",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: 32,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Spinner />
                  <p style={{ fontSize: 13, color: "#bbcabf" }}>
                    {t("bookingProgress", { dateLabel: selected.dateLabel, label: selected.label })}
                  </p>
                </div>
              ) : phase === "error" ? (
                <div
                  style={{
                    background: "#201f22",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: COLORS.errorBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, color: COLORS.error, flexShrink: 0,
                      }}
                    >
                      ✕
                    </div>
                    <h3
                      style={{
                        fontSize: 16, color: "#e5e1e4",
                        fontFamily: "var(--font-headline, Manrope), sans-serif",
                      }}
                    >
                      {t("errorTitle")}
                    </h3>
                  </div>
                  <Alert variant="error">{errMsg}</Alert>
                  <button onClick={() => setPhase("selected")} style={primaryBtnStyle}>
                    {t("tryAgain")}
                  </button>
                  <button onClick={() => setPhase("idle")} style={secondaryBtnStyle}>
                    {t("chooseAnotherSlot")}
                  </button>
                </div>
              ) : (
                <ConfirmPanel
                  slot={selected}
                  onConfirm={handleConfirm}
                  onCancel={() => setPhase("idle")}
                  packInfo={{ remaining }}
                  isReschedule={isReschedule}
                />
              )}
            </div>
          </div>
        </>
      )}
    </BookingLayout>
  );
}

// ─── Exported shells & configs (unchanged signatures) ──────────────────────────

// Static, non-price session metadata. Prices now live in the `pricing` table
// and are surfaced via PricesProvider (see src/lib/pricing-display.ts).
export interface SessionConfig {
  type:            "free15min" | "session1h" | "session2h";
  label:           string;
  duration:        string;
  durationMinutes: 15 | 60 | 120;
}

export const SESSION_CONFIGS: Record<string, SessionConfig> = {
  free15min: { type: "free15min", label: "Initial meeting",  duration: "15 min", durationMinutes: 15  },
  session1h: { type: "session1h", label: "1-hour session",   duration: "60 min", durationMinutes: 60  },
  session2h: { type: "session2h", label: "2-hour session",   duration: "2h",     durationMinutes: 120 },
};

/**
 * FullScreenShell — legacy export, now delegates to BookingLayout.
 * Kept for backward compatibility with SingleSessionBooking and any other consumer.
 */
export function FullScreenShell({
  onBack,
  badgeType,
  badgeLabel,
  title,
  hideTopBar,
  children,
}: {
  onBack:      () => void;
  badgeType:   "free" | "paid" | "pack";
  badgeLabel:  string;
  title:       string;
  hideTopBar?: boolean;
  children:    React.ReactNode;
}) {
  // badgeType, badgeLabel, title, hideTopBar no longer drive the layout —
  // SingleSessionBooking has been updated to use BookingLayout directly.
  // This shell is kept only for any remaining callers.
  void badgeType; void badgeLabel; void title; void hideTopBar;
  const t = useTranslations("booking.modeView");
  return (
    <BookingLayout>
      {/* Back button row */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-semibold transition-colors"
          style={{ color: "#bbcabf", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("back")}
        </button>
      </div>
      {children}
    </BookingLayout>
  );
}

export function ConfirmPanel({
  slot,
  onConfirm,
  onCancel,
  packInfo,
  sessionDuration,
  isReschedule,
}: {
  slot:             SelectedSlot;
  onConfirm:        () => void;
  onCancel?:        () => void;
  packInfo?:        { remaining: number };
  sessionDuration?: string;
  isReschedule?:    boolean;
}) {
  const t = useTranslations("booking.modeView");
  return (
    <div style={{ background: "#201f22", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.25s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(78,222,163,0.1)", border: "1px solid rgba(78,222,163,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#e5e1e4" }}>{slot.dateLabel} · {slot.label}</div>
          <div style={{ fontSize: 12, color: "#bbcabf" }}>{sessionDuration ?? t("fallbackDuration")} · Google Meet</div>
        </div>
      </div>

      {packInfo && !isReschedule && (
        <div style={{ background: "rgba(78,222,163,0.1)", border: "1px solid rgba(78,222,163,0.2)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#4edea3" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            {t("packDeduct")}
            <br />
            <span style={{ color: "#bbcabf", fontSize: 12 }}>
              {t("packRemaining", { n: Math.max(0, packInfo.remaining - 1) })}
            </span>
          </div>
        </div>
      )}

      {isReschedule && (
        <div style={{ background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.25)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#63b3ed" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <div>
            <strong>{t("rescheduleNote")}</strong>
            <br />
            <span style={{ color: "#bbcabf", fontSize: 12 }}>{t("rescheduleNoCharge")}</span>
          </div>
        </div>
      )}

      <button
        onClick={onConfirm}
        style={primaryBtnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        {isReschedule ? t("confirmReschedule") : t("confirmBook")}
      </button>

      {onCancel && (
        <button onClick={onCancel} style={secondaryBtnStyle}>{t("chooseAnotherSlot")}</button>
      )}

      <div style={{ fontSize: 11.5, color: "#86948a", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        {t("emailNotice")}
      </div>

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

export function TutorRow() {
  const t = useTranslations("booking.modeView");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#201f22", border: "2px solid rgba(78,222,163,0.15)", overflow: "hidden", flexShrink: 0 }}>
        <Image src="/avatar.jpg" alt="Gustavo Torres" width={42} height={42} style={{ objectFit: "cover" }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e1e4" }}>{t("instructorName")}</div>
        <div style={{ fontSize: 11.5, color: "#bbcabf" }}>{t("instructorTitle")}</div>
      </div>
    </div>
  );
}

export function InfoRow({ icon, children }: { icon: "clock" | "phone" | "globe"; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#bbcabf" }}>
      {icon === "clock" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
      {icon === "phone" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.46a19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.92z"/></svg>}
      {icon === "globe" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
      {children}
    </div>
  );
}

export function MetaRows() {
  const t = useTranslations("booking.modeView");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, text: t("realtimeSlots") },
        { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, text: t("securePay") },
      ].map(({ icon, text }) => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#86948a" }}>
          {icon}
          {text}
        </div>
      ))}
    </div>
  );
}

export const primaryBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", padding: "13px 20px",
  background: "linear-gradient(135deg, #4edea3, #10b981)",
  border: "none", borderRadius: 8,
  color: "#003824", fontSize: 14, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  transition: "opacity 0.15s, transform 0.1s",
};

export const secondaryBtnStyle: React.CSSProperties = {
  width: "100%", padding: "11px",
  background: "none", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, color: "#bbcabf",
  fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  transition: "border-color 0.15s",
};
