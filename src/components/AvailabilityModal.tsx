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
import { SCHEDULE, DAY_SCHEDULES } from "@/lib/booking-config";
import type { ApiSlot, SelectedSlot } from "@/components/WeeklyCalendar";

// ─── Exported types ────────────────────────────────────────────────────────────

export type SessionChoice =
  | { kind: "session"; type: "free15min" | "session1h" | "session2h" }
  | { kind: "pack"; size: 5 | 10 };

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

// ─── Session / pack option data ────────────────────────────────────────────────

const SESSION_OPTIONS = [
  {
    kind: "session" as const, type: "free15min" as const,
    label: "Encuentro inicial", detail: "15 min · Gratis", badge: null,
    icon: "chat_bubble",
    description: "Comentamos tu caso y definimos un plan de trabajo.",
  },
  {
    kind: "session" as const, type: "session1h" as const,
    label: "Sesión 1 hora", detail: "60 min · €16", badge: "Popular",
    icon: "timer",
    description: "Resolución de dudas, proyecto o preparación de examen.",
  },
  {
    kind: "session" as const, type: "session2h" as const,
    label: "Sesión 2 horas", detail: "120 min · €30", badge: null,
    icon: "history",
    description: "Para temas que requieren mayor profundidad.",
  },
] as const;

const PACK_OPTIONS = [
  {
    kind: "pack" as const, size: 5 as const,
    label: "Pack Esencial", detail: "5 × 1h · €75", badge: null,
    savings: "Ahorra 5€",
    description: "Ideal para comenzar con flexibilidad.",
    hourlyRate: "€15/h",
    totalPrice: "€75",
  },
  {
    kind: "pack" as const, size: 10 as const,
    label: "Pack Intensivo", detail: "10 × 1h · €140", badge: "Recomendado",
    savings: "Ahorra 20€",
    description: "El mejor valor para un acompañamiento continuo.",
    hourlyRate: "€14/h",
    totalPrice: "€140",
  },
] as const;

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
                  }}
                >
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
                        onSlotClick={(slot) => handleSlotClick(date, slot)}
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        16,
                  padding:    "10px 12px 14px 64px",
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
                      background: "transparent",
                      border: "1px solid rgba(134,148,138,0.2)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    No disponible
                  </span>
                </div>
              </>
            ) : (
              <SessionPicker
                slot={selectedSlot!}
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
            alignItems:     "center",
            justifyContent: "flex-end",
            paddingRight:   8,
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
  date, daySlots, isMobile, isClosed, isToday, tzDiffers, onSlotClick,
}: {
  date:        Date;
  daySlots:    DaySlots | undefined;
  isMobile:    boolean;
  isClosed:    boolean;
  isToday:     boolean;
  tzDiffers:   boolean;
  onSlotClick: (slot: ApiSlot) => void;
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
        const slot = hourMap?.get(hour) ?? null;
        const timeLabel = slot
          ? startTimeFromLabel(tzDiffers ? slot.localLabel : slot.label)
          : null;

        return (
          <div
            key={hour}
            style={{
              height:    ROW_H,
              padding:   "3px 3px",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
            }}
          >
            {isClosed ? null
              : isLoading ? (
                hour === 10 ? (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <LoadingDots />
                  </div>
                ) : null
              ) : slot ? (
                <SlotCell
                  timeLabel={isMobile ? null : timeLabel}
                  onClick={() => onSlotClick(slot)}
                />
              ) : null
            }
          </div>
        );
      })}
    </div>
  );
}

// ─── Slot cell ─────────────────────────────────────────────────────────────────

function SlotCell({ timeLabel, onClick }: { timeLabel: string | null; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:          "100%",
        height:         "100%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        paddingLeft:    0,
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
          fontSize:     10,
          fontWeight:   600,
          color:        "#4edea3",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          lineHeight:   1,
          pointerEvents: "none",
        }}>
          {timeLabel}
        </span>
      )}
    </button>
  );
}

// ─── Session picker panel ──────────────────────────────────────────────────────

function SessionPicker({
  slot,
  isMobile,
  isSignedIn,
  activePackSize,
  selectedChoice,
  onSelect,
  ctaLabel,
  onConfirm,
}: {
  slot:           SelectedSlot;
  isMobile:       boolean;
  isSignedIn:     boolean;
  activePackSize: 5 | 10 | null;
  selectedChoice: SessionChoice | null;
  onSelect:       (choice: SessionChoice) => void;
  ctaLabel:       (choice: SessionChoice) => string;
  onConfirm:      () => void;
}) {
  const isChoiceSelected = (choice: SessionChoice) => {
    if (!selectedChoice) return false;
    if (choice.kind !== selectedChoice.kind) return false;
    if (choice.kind === "session" && selectedChoice.kind === "session") {
      return choice.type === selectedChoice.type;
    }
    if (choice.kind === "pack" && selectedChoice.kind === "pack") {
      return choice.size === selectedChoice.size;
    }
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* Scrollable content */}
      <div style={{ flex: 1, padding: "24px 20px 8px" }}>

        {/* Date badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          8,
            background:   "rgba(78,222,163,0.1)",
            border:       "1px solid rgba(78,222,163,0.2)",
            borderRadius: 9999,
            padding:      "8px 16px",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4edea3", lineHeight: 1 }}>
              event_available
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#4edea3" }}>
              {slot.dateLabel} · {startTimeFromLabel(slot.label)}
            </span>
          </div>
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          fontSize:      isMobile ? 26 : 34,
          fontWeight:    800,
          color:         "#e5e1e4",
          letterSpacing: "-0.03em",
          textAlign:     "center",
          margin:        "0 0 8px",
          lineHeight:    1.15,
        }}>
          Selecciona tu sesión
        </h2>
        <p style={{ fontSize: 13, color: "#86948a", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Elige el tipo de sesión que mejor se adapta a lo que buscas.
        </p>

        {/* Individual sessions */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e5e1e4", marginBottom: 10 }}>
          Sesiones individuales
        </p>
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap:                 8,
          marginBottom:        10,
        }}>
          {SESSION_OPTIONS.map((opt) => {
            const choice: SessionChoice = { kind: opt.kind, type: opt.type };
            return (
              <OptionCard
                key={opt.type}
                label={opt.label}
                detail={opt.detail}
                badge={opt.badge}
                icon={opt.icon}
                description={opt.description}
                selected={isChoiceSelected(choice)}
                onClick={() => isChoiceSelected(choice) ? onConfirm() : onSelect(choice)}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0" }} />

        {/* Packs */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bbcabf", marginBottom: 10 }}>
          Packs de continuidad
        </p>
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap:                 8,
          marginBottom:        8,
        }}>
          {PACK_OPTIONS.map((opt) => {
            const choice: SessionChoice = { kind: opt.kind, size: opt.size };
            const hasPack = isSignedIn && activePackSize === opt.size;
            return (
              <PackCard
                key={opt.size}
                label={opt.label}
                savings={opt.savings}
                description={opt.description}
                hourlyRate={opt.hourlyRate}
                totalPrice={opt.totalPrice}
                badge={hasPack ? "Pack activo" : opt.badge}
                hasPack={hasPack}
                selected={isChoiceSelected(choice)}
                onClick={() => isChoiceSelected(choice) ? onConfirm() : onSelect(choice)}
              />
            );
          })}
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position:       "sticky",
        bottom:         0,
        background:     "#1c1b1d",
        borderTop:      "1px solid rgba(255,255,255,0.06)",
        padding:        "12px 20px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            12,
        flexWrap:       isMobile ? "wrap" : "nowrap",
      }}>
        {/* Security badge — uses the lock SVG from the footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#86948a" aria-hidden="true">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#bbcabf", margin: 0, lineHeight: 1.3 }}>Pago seguro</p>
            <p style={{ fontSize: 10, color: "#86948a", margin: 0 }}>SSL · Stripe</p>
          </div>
        </div>

        {/* CTA button */}
        {selectedChoice && (
          <button
            onClick={onConfirm}
            style={{
              padding:      isMobile ? "13px 0" : "12px 28px",
              width:        isMobile ? "100%" : "auto",
              background:   "linear-gradient(135deg, #4edea3, #10b981)",
              border:       "none",
              borderRadius: 10,
              color:        "#003824",
              fontSize:     14,
              fontWeight:   700,
              cursor:       "pointer",
              fontFamily:   "inherit",
              transition:   "opacity 0.15s, transform 0.1s",
              whiteSpace:   "nowrap",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.9";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            {ctaLabel(selectedChoice)}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Option card (individual sessions) ────────────────────────────────────────

function OptionCard({
  label,
  detail,
  badge,
  icon,
  description,
  selected = false,
  onClick,
}: {
  label:        string;
  detail:       string;
  badge:        string | null;
  icon?:        string;
  description?: string;
  selected?:    boolean;
  onClick:      () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  const parts    = detail.split("·");
  const duration = parts[0]?.trim() ?? "";
  const price    = parts[1]?.trim() ?? detail;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:      "relative",
        textAlign:     "left",
        display:       "flex",
        flexDirection: "column",
        background:    isActive ? "#2a2a2c" : "#201f22",
        border:        selected
          ? "2px solid rgba(78,222,163,0.4)"
          : isActive
          ? "1px solid rgba(78,222,163,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius:  12,
        padding:       "14px 14px 12px",
        cursor:        "pointer",
        fontFamily:    "inherit",
        transition:    "background 0.12s, border-color 0.12s",
        width:         "100%",
      }}
    >
      {badge && (
        <span style={{
          position:      "absolute",
          top:           "-1px",
          right:         8,
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding:       "2px 7px",
          borderRadius:  "0 0 6px 6px",
          background:    selected ? "rgba(78,222,163,0.25)" : "rgba(78,222,163,0.15)",
          color:         "#4edea3",
          border:        "1px solid rgba(78,222,163,0.3)",
          borderTop:     "none",
        }}>
          {badge}
        </span>
      )}

      {/* Icon + duration row */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   10,
        marginTop:      badge ? 8 : 0,
      }}>
        {icon && (
          <span className="material-symbols-outlined" style={{
            fontSize:   20,
            color:      selected ? "#4edea3" : "#86948a",
            lineHeight: 1,
            transition: "color 0.12s",
          }}>
            {icon}
          </span>
        )}
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color:         selected ? "#e5e1e4" : "#86948a",
        }}>
          {duration}
        </span>
      </div>

      <p style={{
        fontSize:   13,
        fontWeight: 600,
        color:      selected ? "#4edea3" : "#e5e1e4",
        margin:     "0 0 4px",
        transition: "color 0.12s",
      }}>
        {label}
      </p>

      {description && (
        <p style={{ fontSize: 11, color: "#86948a", margin: "0 0 10px", lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      <p style={{ fontSize: 15, fontWeight: 700, color: "#e5e1e4", margin: "auto 0 0" }}>
        {price}
      </p>
    </button>
  );
}

// ─── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({
  label,
  savings,
  description,
  hourlyRate,
  totalPrice,
  badge,
  hasPack,
  selected,
  onClick,
}: {
  label:       string;
  savings:     string;
  description: string;
  hourlyRate:  string;
  totalPrice:  string;
  badge:       string | null;
  hasPack:     boolean;
  selected:    boolean;
  onClick:     () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:      "relative",
        textAlign:     "left",
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        background:    isActive ? "#2a2a2c" : "rgba(78,222,163,0.06)",
        border:        selected
          ? "2px solid rgba(78,222,163,0.4)"
          : isActive
          ? "1px solid rgba(78,222,163,0.3)"
          : "1px solid rgba(78,222,163,0.22)",
        borderRadius:  12,
        padding:       "14px 14px 12px",
        cursor:        "pointer",
        fontFamily:    "inherit",
        transition:    "background 0.12s, border-color 0.12s",
        width:         "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: selected ? "#4edea3" : "#e5e1e4", transition: "color 0.12s" }}>
          {label}
        </span>
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background:    "rgba(78,222,163,0.12)",
          border:        "1px solid rgba(78,222,163,0.2)",
          borderRadius:  4,
          color:         "#4edea3",
          padding:       "2px 6px",
          whiteSpace:    "nowrap",
          flexShrink:    0,
        }}>
          {savings}
        </span>
      </div>

      <p style={{ fontSize: 11, color: "#86948a", margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#bbcabf" }}>{hourlyRate}</span>
          {badge && (
            <span style={{
              display:       "inline-block",
              marginLeft:    8,
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background:    hasPack ? "rgba(78,222,163,0.25)" : "rgba(78,222,163,0.15)",
              color:         "#4edea3",
              border:        "1px solid rgba(78,222,163,0.3)",
              borderRadius:  4,
              padding:       "1px 5px",
            }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{
          fontSize:   24,
          fontWeight: 800,
          color:      "#e5e1e4",
          lineHeight: 1,
          fontFamily: "var(--font-headline, Manrope), sans-serif",
        }}>
          {totalPrice}
        </span>
      </div>
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
