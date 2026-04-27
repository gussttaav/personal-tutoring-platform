"use client";

/**
 * AvailabilityModal — unauthenticated availability preview
 *
 * Shows an 8-column time-grid calendar (time markers + 7 day columns) of
 * 1-hour slots fetched from /api/availability (no auth required). On slot
 * selection, presents a session-type picker with a sticky CTA footer.
 * Calls onSessionSelected only when the user explicitly confirms.
 *
 * Layout:
 *   - Mobile  (< 640px): bottom sheet, all 7 days visible, no horizontal scroll
 *   - Desktop (≥ 640px): centered dialog, up to 860px wide
 */

import { useState, useEffect, useCallback } from "react";
import { SCHEDULE, DAY_SCHEDULES, dayStartHour } from "@/lib/booking-config";
import type { ApiSlot, SelectedSlot } from "@/components/WeeklyCalendar";
import SessionPickerContent, { type SessionChoice, SESSION_OPTIONS, PACK_OPTIONS } from "@/components/SessionPickerContent";

// Re-export so existing consumers (InteractiveShell) keep their import unchanged
export type { SessionChoice } from "@/components/SessionPickerContent";

interface AvailabilityModalProps {
  onClose: () => void;
  onSessionSelected: (choice: SessionChoice, slot: SelectedSlot) => void;
  /** Whether the user is currently signed in */
  isSignedIn: boolean;
  /** Pack size the user already has credits for (null = no active pack) */
  activePackSize: 5 | 10 | null;
}

// ─── Internal types ────────────────────────────────────────────────────────────

type DaySlots = ApiSlot[] | "loading" | "error";

// ─── Time grid rows ────────────────────────────────────────────────────────────

const TIME_ROWS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Sun=0 … Sat=6
const DAY_ABBR  = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const DAY_FULL  = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getWeekStart(offset = 0): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  return monday;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatWeekHeading(weekStart: Date): string {
  const day   = weekStart.getDate();
  const month = weekStart.toLocaleDateString("es-ES", { month: "long" });
  return `Semana del ${day} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
}

function buildSelectedSlot(date: Date, slot: ApiSlot, userTz: string): SelectedSlot {
  const tzDiffers = userTz !== SCHEDULE.timezone;
  return {
    startIso:  slot.start,
    endIso:    slot.end,
    label:     tzDiffers ? slot.localLabel : slot.label,
    dateLabel: formatDateLabel(date),
    timezone:  userTz,
  };
}

/** Returns the current wall-clock minutes (0–1439) in the schedule's timezone. */
function getMadridMinutes(): number {
  const str = new Date().toLocaleTimeString("es-ES", {
    timeZone: SCHEDULE.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h = "0", m = "0"] = str.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Returns true if a 60-minute slot starting at `hour` fits within the
 * configured working-hour windows for the given day-of-week.
 */
function isHourInWorkingWindow(dow: number, hour: number): boolean {
  const sched = DAY_SCHEDULES[dow];
  if (!sched) return false;
  const start = dayStartHour(dow);
  if (hour >= start && hour + 1 <= sched.morningEnd) return true;
  if (sched.afternoonStart !== null && sched.afternoonEnd !== null) {
    if (hour >= sched.afternoonStart && hour + 1 <= sched.afternoonEnd) return true;
  }
  return false;
}

/** Extract just the start time from a label like "09:00–10:00" → "09:00" */
function startTimeFromLabel(label: string): string {
  return label.split(/\s*[–\-]\s*/)[0] ?? label;
}

/** Extract the start hour integer from a label like "09:00–10:00" → 9 */
function startHourFromLabel(label: string): number {
  const timeStr = (label.split(/\s*[–\-]\s*/)[0] ?? "").trim();
  return parseInt(timeStr.split(":")[0] ?? "0", 10);
}

/** Build a map of start-hour → ApiSlot for time-grid positioning */
function buildHourMap(slots: ApiSlot[], tzDiffers: boolean): Map<number, ApiSlot> {
  const map = new Map<number, ApiSlot>();
  for (const slot of slots) {
    const label = tzDiffers ? slot.localLabel : slot.label;
    map.set(startHourFromLabel(label), slot);
  }
  return map;
}

function formatHourLabel(hour: number): string {
  if (hour < 12)  return `${String(hour).padStart(2, "0")} AM`;
  if (hour === 12) return "12 PM";
  return `${String(hour - 12).padStart(2, "0")} PM`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvailabilityModal({
  onClose,
  onSessionSelected,
  isSignedIn,
  activePackSize,
}: AvailabilityModalProps) {
  const [view,           setView]           = useState<"calendar" | "picker">("calendar");
  const [selectedSlot,   setSelectedSlot]   = useState<SelectedSlot | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<SessionChoice | null>(null);
  const [weekOffset,     setWeekOffset]     = useState(0);
  const [slotsMap,       setSlotsMap]       = useState<Record<string, DaySlots>>({});
  const [userTz,         setUserTz]         = useState<string>(SCHEDULE.timezone);
  const [isMobile,       setIsMobile]       = useState(false);
  const [nowMadridMin,   setNowMadridMin]   = useState<number>(() => getMadridMinutes());

  const maxWeekOffset = SCHEDULE.bookingWindowWeeks - 1;
  const weekStart     = getWeekStart(weekOffset);
  const tzDiffers     = userTz !== SCHEDULE.timezone;

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Update current Madrid time every minute for the "now" line and past-cell logic
  useEffect(() => {
    const id = setInterval(() => setNowMadridMin(getMadridMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Detect user timezone
  useEffect(() => {
    try { setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* ignore */ }
  }, []);

  // Body scroll lock + Escape key
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Fetch 1-hour slots for the visible week.
  // Clears the slot map on every weekOffset/timezone change and re-fetches fresh,
  // so the displayed times are always consistent with WeeklyCalendar.
  useEffect(() => {
    const ws = getWeekStart(weekOffset);
    const days: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return d;
    });

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

    setSlotsMap({});

    const controllers: AbortController[] = [];

    days.forEach((date) => {
      const key      = formatDateKey(date);
      const isPast   = date < today;
      const isBeyond = date > maxDate;
      const dow      = date.getDay();
      const noSched  = DAY_SCHEDULES[dow] === null;

      if (isPast || isBeyond || noSched) return;

      setSlotsMap((prev) => ({ ...prev, [key]: "loading" }));

      const controller = new AbortController();
      controllers.push(controller);

      const tz = encodeURIComponent(userTz);
      fetch(`/api/availability?date=${key}&duration=60&tz=${tz}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          setSlotsMap((prev) => ({
            ...prev,
            [key]: Array.isArray(data.slots) ? data.slots : "error",
          }));
        })
        .catch((err) => {
          if ((err as Error).name === "AbortError") return;
          setSlotsMap((prev) => ({ ...prev, [key]: "error" }));
        });
    });

    return () => controllers.forEach((c) => c.abort());
  }, [weekOffset, userTz]); // eslint-disable-line react-hooks/exhaustive-deps

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const handleSlotClick = useCallback((date: Date, slot: ApiSlot) => {
    setSelectedSlot(buildSelectedSlot(date, slot, userTz));
    setSelectedChoice(null);
    setView("picker");
  }, [userTz]);

  const handleBackToCalendar = () => {
    setView("calendar");
    setSelectedSlot(null);
    setSelectedChoice(null);
  };

  const handleConfirm = useCallback(() => {
    if (!selectedSlot || !selectedChoice) return;
    onSessionSelected(selectedChoice, selectedSlot);
    onClose();
  }, [selectedSlot, selectedChoice, onSessionSelected, onClose]);

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

  function ctaLabel(choice: SessionChoice): string {
    if (choice.kind === "session") return "Reservar →";
    if (isSignedIn && activePackSize === choice.size) return "Reservar →";
    return "Comprar pack →";
  }

  // ── Time indicator ───────────────────────────────────────────────────────
  const ROW_H_VAL    = isMobile ? 40 : 48;
  const HEADER_H_VAL = isMobile ? 52 : 64;
  const GRID_START_MIN = 9 * 60;
  const GRID_END_MIN   = 19 * 60;
  const showTimeLine   = weekOffset === 0 && nowMadridMin >= GRID_START_MIN && nowMadridMin < GRID_END_MIN;
  const timeLineTop    = HEADER_H_VAL + ((nowMadridMin - GRID_START_MIN) / 60) * ROW_H_VAL;

  // ── Modal shell ──────────────────────────────────────────────────────────
  const NAVBAR_H = 64; // px — matches the site's h-16 fixed navbar

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:      "relative",
        width:         "100%",
        maxHeight:     `calc(100dvh - ${NAVBAR_H}px)`,
        background:    "#1c1b1d",
        borderRadius:  "24px 24px 0 0",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availSheetUp 0.25s ease both",
      }
    : {
        position:      "relative",
        width:         "min(860px, 95vw)",
        maxHeight:     "90vh",
        background:    "#1c1b1d",
        borderRadius:  "24px",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availFadeUp 0.22s ease both",
        boxShadow:     "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
      };

  return (
    <>
      {/* Backdrop — paddingTop on mobile clears the fixed navbar */}
      <div
        onClick={onClose}
        style={{
          position:             "fixed",
          inset:                0,
          zIndex:               60,
          background:           "rgba(0,0,0,0.75)",
          backdropFilter:       "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          display:              "flex",
          alignItems:           isMobile ? "flex-end" : "center",
          justifyContent:       "center",
          padding:              isMobile ? `${NAVBAR_H}px 0 0` : "20px",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Ver disponibilidad"
      >
        {/* Panel */}
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "16px 20px 14px",
              borderBottom:   "1px solid rgba(255,255,255,0.05)",
              flexShrink:     0,
              gap:            12,
            }}
          >
            {view === "picker" ? (
              <button
                onClick={handleBackToCalendar}
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        6,
                  background: "none",
                  border:     "none",
                  cursor:     "pointer",
                  color:      "#bbcabf",
                  fontFamily: "inherit",
                  fontSize:   13,
                  fontWeight: 500,
                  padding:    0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Cambiar horario
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, color: "#4edea3", flexShrink: 0, lineHeight: 1 }}
                >
                  event_note
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily:    "var(--font-headline, Manrope), sans-serif",
                    fontSize:      isMobile ? 15 : 17,
                    fontWeight:    700,
                    color:         "#e5e1e4",
                    letterSpacing: "-0.01em",
                    margin:        0,
                    lineHeight:    1.2,
                  }}>
                    {formatWeekHeading(weekStart)}
                  </p>
                  <p style={{ fontSize: 11, color: "#86948a", margin: "2px 0 0" }}>
                    {tzDiffers
                      ? `Horarios en tu zona · ${userTz}`
                      : `Horarios en ${SCHEDULE.timezone}`}
                  </p>
                </div>
              </div>
            )}

            {/* Right side controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {view === "calendar" && (
                <div style={{
                  display:      "flex",
                  alignItems:   "center",
                  background:   "#0e0e10",
                  borderRadius: 9999,
                  border:       "1px solid rgba(255,255,255,0.07)",
                  overflow:     "hidden",
                }}>
                  <button
                    onClick={() => setWeekOffset((w) => w - 1)}
                    disabled={weekOffset === 0}
                    aria-label="Semana anterior"
                    style={{
                      width:          36,
                      height:         36,
                      background:     "transparent",
                      border:         "none",
                      cursor:         weekOffset === 0 ? "not-allowed" : "pointer",
                      color:          weekOffset === 0 ? "rgba(134,148,138,0.3)" : "#bbcabf",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      opacity:        weekOffset === 0 ? 0.4 : 1,
                      transition:     "color 0.12s",
                    }}
                    onMouseEnter={(e) => { if (weekOffset !== 0) (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                    onMouseLeave={(e) => { if (weekOffset !== 0) (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setWeekOffset((w) => w + 1)}
                    disabled={weekOffset >= maxWeekOffset}
                    aria-label="Semana siguiente"
                    style={{
                      width:          36,
                      height:         36,
                      background:     "transparent",
                      border:         "none",
                      borderLeft:     "1px solid rgba(255,255,255,0.07)",
                      cursor:         weekOffset >= maxWeekOffset ? "not-allowed" : "pointer",
                      color:          weekOffset >= maxWeekOffset ? "rgba(134,148,138,0.3)" : "#bbcabf",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      opacity:        weekOffset >= maxWeekOffset ? 0.4 : 1,
                      transition:     "color 0.12s",
                    }}
                    onMouseEnter={(e) => { if (weekOffset < maxWeekOffset) (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                    onMouseLeave={(e) => { if (weekOffset < maxWeekOffset) (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width:          32,
                  height:         32,
                  borderRadius:   "50%",
                  background:     "#201f22",
                  border:         "1px solid rgba(255,255,255,0.07)",
                  cursor:         "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  color:          "#86948a",
                  flexShrink:     0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#86948a"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

            {view === "calendar" ? (
              <>
                {/*
                  8-column time grid.
                  The wrapper's background + columnGap create 1px column separators.
                */}
                <div
                  style={{
                    display:             "grid",
                    gridTemplateColumns: "52px repeat(7, 1fr)",
                    columnGap:           1,
                    background:          "rgba(255,255,255,0.05)",
                    margin:              "0 12px",
                    position:            "relative",
                  }}
                >
                  {/* Current-time indicator */}
                  {showTimeLine && (
                    <div
                      aria-hidden="true"
                      style={{
                        position:      "absolute",
                        left:          53,
                        right:         0,
                        top:           timeLineTop,
                        height:        1,
                        background:    "rgba(78,222,163,0.5)",
                        zIndex:        3,
                        pointerEvents: "none",
                      }}
                    >
                      <div style={{
                        position:     "absolute",
                        left:         -4,
                        top:          -3,
                        width:        7,
                        height:       7,
                        borderRadius: "50%",
                        background:   "#4edea3",
                      }} />
                    </div>
                  )}

                  <TimeColumn isMobile={isMobile} />

                  {days.map((date) => {
                    const key      = formatDateKey(date);
                    const dow      = date.getDay();
                    const daySlots = slotsMap[key];
                    const isPast   = date < today;
                    const isBeyond = date > maxDate;
                    const noSched  = DAY_SCHEDULES[dow] === null;
                    const isClosed = isPast || isBeyond || noSched;
                    const isToday  = date.toDateString() === today.toDateString();

                    return (
                      <DayColumn
                        key={key}
                        date={date}
                        daySlots={daySlots}
                        isMobile={isMobile}
                        isClosed={isClosed}
                        isToday={isToday}
                        tzDiffers={tzDiffers}
                        nowMadridMin={nowMadridMin}
                        onSlotClick={(slot) => handleSlotClick(date, slot)}
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{
                  display:    "flex",
                  flexWrap:   "wrap",
                  alignItems: "center",
                  columnGap:  14,
                  rowGap:     8,
                  padding:    "10px 12px 14px 12px",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
                    <span style={{
                      width: 18, height: 10, borderRadius: 3,
                      background: "rgba(78,222,163,0.18)",
                      border: "1px solid rgba(78,222,163,0.35)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    Disponible
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
                    <span style={{
                      width: 18, height: 10, borderRadius: 3,
                      background: "rgba(255,180,171,0.07)",
                      border: "1px solid rgba(255,180,171,0.18)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    Reservado
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
                    <span style={{
                      width: 18, height: 10, borderRadius: 3,
                      background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 6px)",
                      border: "1px solid rgba(255,255,255,0.04)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    No disponible
                  </span>
                </div>
              </>
            ) : (
              <SessionPickerContent
                slot={selectedSlot ?? undefined}
                isMobile={isMobile}
                isSignedIn={isSignedIn}
                activePackSize={activePackSize}
                selectedChoice={selectedChoice}
                onSelect={setSelectedChoice}
                ctaLabel={ctaLabel}
                onConfirm={handleConfirm}
              />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes availFadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes availSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        /* Hide the chat FAB while this modal is mounted */
        .chat-fab { display: none !important; }
      `}</style>
    </>
  );
}

// ─── Time column ───────────────────────────────────────────────────────────────

function TimeColumn({ isMobile }: { isMobile: boolean }) {
  const ROW_H    = isMobile ? 40 : 48;
  const HEADER_H = isMobile ? 52 : 64;
  return (
    <div style={{ background: "#111113" }}>
      {/* Header spacer — aligns with day header cells */}
      <div style={{
        height:       HEADER_H,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }} />
      {/* Hour rows */}
      {TIME_ROWS.map((hour, i) => (
        <div
          key={hour}
          style={{
            height:         ROW_H,
            display:        "flex",
            alignItems:     "flex-start",
            justifyContent: "flex-end",
            paddingRight:   8,
            paddingTop:     4,
            borderTop:      i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
          }}
        >
          <span style={{
            fontSize:           isMobile ? 9 : 10,
            fontWeight:         500,
            color:              "#86948a",
            fontVariantNumeric: "tabular-nums",
            whiteSpace:         "nowrap",
          }}>
            {formatHourLabel(hour)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Day column ────────────────────────────────────────────────────────────────

function DayColumn({
  date, daySlots, isMobile, isClosed, isToday, tzDiffers, nowMadridMin, onSlotClick,
}: {
  date:         Date;
  daySlots:     DaySlots | undefined;
  isMobile:     boolean;
  isClosed:     boolean;
  isToday:      boolean;
  tzDiffers:    boolean;
  nowMadridMin: number;
  onSlotClick:  (slot: ApiSlot) => void;
}) {
  const ROW_H    = isMobile ? 40 : 48;
  const HEADER_H = isMobile ? 52 : 64;
  const dow      = date.getDay();
  const hourMap  = Array.isArray(daySlots) ? buildHourMap(daySlots, tzDiffers) : null;
  const isLoading = daySlots === "loading" || daySlots === undefined;

  return (
    <div style={{
      opacity:    isClosed ? 0.32 : 1,
      background: isToday ? "rgba(78,222,163,0.025)" : "#1c1b1d",
    }}>
      {/* Day header */}
      <div style={{
        height:         HEADER_H,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            2,
        background:     isToday ? "rgba(78,222,163,0.1)" : "#111113",
        borderBottom:   "1px solid rgba(255,255,255,0.1)",
        position:       "relative",
      }}>
        {/* Today accent bar */}
        {isToday && (
          <div style={{
            position:   "absolute",
            top:        0,
            left:       "20%",
            right:      "20%",
            height:     2,
            background: "#4edea3",
            borderRadius: "0 0 2px 2px",
          }} />
        )}
        <span style={{
          fontSize:      isMobile ? 8 : 10,
          fontWeight:    700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color:         isToday ? "#4edea3" : "#86948a",
          lineHeight:    1,
        }}>
          {isMobile ? DAY_ABBR[dow] : DAY_FULL[dow]}
        </span>
        <span style={{
          fontSize:   isMobile ? 16 : 20,
          fontWeight: 800,
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          color:      isToday ? "#4edea3" : "#e5e1e4",
          lineHeight: 1,
        }}>
          {date.getDate()}
        </span>
      </div>

      {/* Time rows */}
      {TIME_ROWS.map((hour, i) => {
        const slot      = hourMap?.get(hour) ?? null;
        const timeLabel = slot
          ? startTimeFromLabel(tzDiffers ? slot.localLabel : slot.label)
          : null;

        if (isClosed) {
          return (
            <div key={hour} style={{
              height:    ROW_H,
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
            }} />
          );
        }

        if (isLoading) {
          return (
            <div key={hour} style={{
              height:         ROW_H,
              borderTop:      i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
              display:        hour === 10 ? "flex" : undefined,
              alignItems:     "center",
              justifyContent: "center",
            }}>
              {hour === 10 && <LoadingDots />}
            </div>
          );
        }

        const rowMin      = hour * 60;
        const isPastRow   = isToday && rowMin + 60 <= nowMadridMin;
        const isNoticeRow = isToday && !isPastRow && rowMin < nowMadridMin + SCHEDULE.minNoticeHours * 60;

        if (isPastRow) {
          return (
            <div key={hour} style={{
              height:    ROW_H,
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
            }} />
          );
        }

        const cellState: "available" | "booked" | "unavailable" =
          isNoticeRow                            ? "unavailable"
          : slot                                 ? "available"
          : isHourInWorkingWindow(dow, hour)     ? "booked"
          : "unavailable";

        return (
          <div
            key={hour}
            style={{
              height:    ROW_H,
              padding:   "3px 3px",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
            }}
          >
            <SlotCell
              state={cellState}
              timeLabel={cellState === "available" && !isMobile ? timeLabel : null}
              onClick={cellState === "available" && slot ? () => onSlotClick(slot) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Slot cell ─────────────────────────────────────────────────────────────────

function SlotCell({
  state,
  timeLabel,
  onClick,
}: {
  state:     "available" | "booked" | "unavailable";
  timeLabel: string | null;
  onClick?:  () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (state === "unavailable") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.04)",
        background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 6px)",
        cursor: "default",
      }} />
    );
  }

  if (state === "booked") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 3,
        border: "1px solid rgba(255,180,171,0.18)",
        background: "rgba(255,180,171,0.07)",
        cursor: "default",
      }} />
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:          "100%",
        height:         "100%",
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "flex-start",
        padding:        "3px 4px",
        cursor:         "pointer",
        border:         `1px solid ${hovered ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.3)"}`,
        background:     hovered ? "rgba(78,222,163,0.22)" : "rgba(78,222,163,0.13)",
        borderRadius:   4,
        transition:     "background 0.12s, border-color 0.12s",
        fontFamily:     "inherit",
        overflow:       "hidden",
      }}
      aria-label={timeLabel ? `Disponible a las ${timeLabel}` : "Hora disponible"}
    >
      {timeLabel && (
        <span style={{
          fontSize:      10,
          fontWeight:    600,
          color:         "#4edea3",
          whiteSpace:    "nowrap",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          lineHeight:    1,
          pointerEvents: "none",
        }}>
          {timeLabel}
        </span>
      )}
    </button>
  );
}

// ─── Loading dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:        3,
            height:       3,
            borderRadius: "50%",
            background:   "#86948a",
            animation:    `availDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes availDotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
