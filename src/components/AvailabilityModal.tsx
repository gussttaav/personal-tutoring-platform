"use client";

/**
 * AvailabilityModal — unauthenticated availability preview
 *
 * Shows a compact 7-column weekly calendar of 1-hour slots fetched from
 * /api/availability (no auth required). On slot selection, presents a
 * session-type picker with a CTA button. Calls onSessionSelected only
 * when the user explicitly confirms with the button.
 *
 * Layout:
 *   - Mobile  (< 640px): bottom sheet, all 7 days visible, no horizontal scroll
 *   - Desktop (≥ 640px): centered dialog, up to 920px wide
 *
 * Timezone:
 *   - Fetches with the correct user timezone from the start (re-fetches if it changes)
 *   - Displays slots using API-computed labels (same source as WeeklyCalendar)
 *   - Shows active timezone so the user knows what times they are seeing
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

// ─── Session / pack option data ────────────────────────────────────────────────

const SESSION_OPTIONS = [
  { kind: "session" as const, type: "free15min" as const, label: "Encuentro inicial", detail: "15 min · Gratis",    badge: null },
  { kind: "session" as const, type: "session1h"  as const, label: "Sesión 1 hora",    detail: "60 min · €16",     badge: "Popular" },
  { kind: "session" as const, type: "session2h"  as const, label: "Sesión 2 horas",   detail: "2 h · €30",        badge: null },
] as const;

const PACK_OPTIONS = [
  { kind: "pack" as const, size: 5  as const, label: "Pack 5 horas",  detail: "5 × 1h · €75",   badge: null },
  { kind: "pack" as const, size: 10 as const, label: "Pack 10 horas", detail: "10 × 1h · €140", badge: "Recomendado" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPACT_DAY_NAMES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const SHORT_DAY_NAMES   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

    // Start fresh — any in-flight request from the previous effect run will be
    // aborted by the cleanup below.
    setSlotsMap({});

    const controllers: AbortController[] = [];

    days.forEach((date) => {
      const key    = formatDateKey(date);
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
    setSelectedChoice(null); // reset choice when slot changes
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

  // ── CTA button label ──────────────────────────────────────────────────────
  function ctaLabel(choice: SessionChoice): string {
    if (choice.kind === "session") return "Reservar →";
    // pack
    if (isSignedIn && activePackSize === choice.size) return "Reservar →";
    return "Comprar pack →";
  }

  // ── Modal shell ──────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:      "relative",
        width:         "100%",
        maxHeight:     "92dvh",
        background:    "#1c1b1d",
        borderRadius:  "20px 20px 0 0",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availSheetUp 0.25s ease both",
      }
    : {
        position:      "relative",
        width:         "min(920px, 95vw)",
        maxHeight:     "88vh",
        background:    "#1c1b1d",
        borderRadius:  "16px",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "availFadeUp 0.22s ease both",
        boxShadow:     "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
      };

  return (
    <>
      {/* Backdrop */}
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
          padding:              isMobile ? 0 : "20px",
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
              padding:        "18px 20px 14px",
              borderBottom:   "1px solid rgba(255,255,255,0.05)",
              flexShrink:     0,
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
              <div>
                <p
                  style={{
                    fontFamily:    "var(--font-headline, Manrope), sans-serif",
                    fontSize:      isMobile ? 15 : 17,
                    fontWeight:    700,
                    color:         "#e5e1e4",
                    letterSpacing: "-0.01em",
                    margin:        0,
                  }}
                >
                  {formatWeekHeading(weekStart)}
                </p>
                <p style={{ fontSize: 11, color: "#86948a", margin: "2px 0 0" }}>
                  {tzDiffers
                    ? `Horarios en tu zona · ${userTz}`
                    : `Horarios en ${SCHEDULE.timezone}`}
                </p>
              </div>
            )}

            {/* Close button */}
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
                marginLeft:     12,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#86948a"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

            {view === "calendar" ? (
              <>
                {/* Week navigation */}
                <div
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    padding:        "10px 20px 6px",
                  }}
                >
                  <button
                    onClick={() => setWeekOffset((w) => w - 1)}
                    disabled={weekOffset === 0}
                    aria-label="Semana anterior"
                    style={{
                      width:          28,
                      height:         28,
                      borderRadius:   "50%",
                      background:     "#201f22",
                      border:         "1px solid rgba(255,255,255,0.07)",
                      cursor:         weekOffset === 0 ? "not-allowed" : "pointer",
                      color:          weekOffset === 0 ? "rgba(134,148,138,0.3)" : "#bbcabf",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      opacity:        weekOffset === 0 ? 0.4 : 1,
                    }}
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
                      width:          28,
                      height:         28,
                      borderRadius:   "50%",
                      background:     "#201f22",
                      border:         "1px solid rgba(255,255,255,0.07)",
                      cursor:         weekOffset >= maxWeekOffset ? "not-allowed" : "pointer",
                      color:          weekOffset >= maxWeekOffset ? "rgba(134,148,138,0.3)" : "#bbcabf",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      opacity:        weekOffset >= maxWeekOffset ? 0.4 : 1,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                {/* 7-column grid — no min-width, fits all screen sizes */}
                <div
                  style={{
                    display:             "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap:                 "2px",
                    padding:             "0 8px 16px",
                  }}
                >
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
                      <div
                        key={key}
                        style={{
                          display:       "flex",
                          flexDirection: "column",
                          alignItems:    "center",
                          gap:           3,
                          opacity:       noSched ? 0.4 : 1,
                        }}
                      >
                        {/* Day header */}
                        <div style={{ textAlign: "center", padding: "6px 2px 4px", width: "100%" }}>
                          <p
                            style={{
                              fontSize:      isMobile ? 9 : 10,
                              fontWeight:    700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color:         isToday ? "#4edea3" : "#86948a",
                              margin:        0,
                            }}
                          >
                            {isMobile ? COMPACT_DAY_NAMES[dow] : SHORT_DAY_NAMES[dow]}
                          </p>
                          <p
                            style={{
                              fontSize:   isMobile ? 13 : 16,
                              fontWeight: 700,
                              fontFamily: "var(--font-headline, Manrope), sans-serif",
                              color:      isToday ? "#4edea3" : "#e5e1e4",
                              margin:     "2px 0 0",
                              lineHeight: 1,
                            }}
                          >
                            {date.getDate()}
                          </p>
                        </div>

                        {/* Slot list */}
                        <div
                          style={{
                            width:         "100%",
                            display:       "flex",
                            flexDirection: "column",
                            gap:           3,
                            padding:       "0 2px",
                          }}
                        >
                          {isClosed ? (
                            noSched ? (
                              <p style={{ fontSize: 8, color: "rgba(134,148,138,0.3)", textAlign: "center", margin: "8px 0", fontStyle: "italic" }}>
                                Cerrado
                              </p>
                            ) : null
                          ) : daySlots === "loading" || daySlots === undefined ? (
                            <LoadingDots />
                          ) : daySlots === "error" || daySlots.length === 0 ? (
                            <p style={{ fontSize: 8, color: "rgba(134,148,138,0.3)", textAlign: "center", margin: "8px 0", fontStyle: "italic" }}>
                              Sin disp.
                            </p>
                          ) : (
                            daySlots.map((slot) => {
                              // Use the API-computed label (same source as WeeklyCalendar)
                              // to ensure timezone consistency between the two calendars.
                              const fullLabel = tzDiffers ? slot.localLabel : slot.label;
                              const timeStr   = startTimeFromLabel(fullLabel);
                              return (
                                <SlotPill
                                  key={slot.start}
                                  label={timeStr}
                                  onClick={() => handleSlotClick(date, slot)}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* ── Session picker ── */
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
      `}</style>
    </>
  );
}

// ─── Slot pill ─────────────────────────────────────────────────────────────────

function SlotPill({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:         "100%",
        padding:       "5px 2px",
        borderRadius:  6,
        fontSize:      10,
        fontWeight:    500,
        textAlign:     "center",
        cursor:        "pointer",
        fontFamily:    "inherit",
        border:        hovered
          ? "1px solid rgba(78,222,163,0.5)"
          : "1px solid rgba(78,222,163,0.2)",
        background:    hovered
          ? "rgba(78,222,163,0.18)"
          : "rgba(78,222,163,0.08)",
        color:         "#4edea3",
        transition:    "background 0.12s, border-color 0.12s",
        lineHeight:    1.3,
        whiteSpace:    "nowrap",
        overflow:      "hidden",
        textOverflow:  "ellipsis",
      }}
    >
      {label}
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
    <div style={{ padding: "16px 20px 20px" }}>
      {/* Selected slot summary */}
      <div
        style={{
          background:   "rgba(78,222,163,0.08)",
          border:       "1px solid rgba(78,222,163,0.2)",
          borderRadius: 10,
          padding:      "10px 14px",
          marginBottom: 18,
          display:      "flex",
          alignItems:   "center",
          gap:          10,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <div>
          <p style={{ fontSize: 11, color: "#86948a", margin: 0 }}>Horario seleccionado</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#4edea3", margin: "2px 0 0" }}>
            {slot.dateLabel} · {startTimeFromLabel(slot.label)}
          </p>
        </div>
      </div>

      {/* Individual sessions */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e5e1e4", marginBottom: 10 }}>
        Elige el tipo de sesión
      </p>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap:                 8,
          marginBottom:        10,
        }}
      >
        {SESSION_OPTIONS.map((opt) => {
          const choice: SessionChoice = { kind: opt.kind, type: opt.type };
          return (
            <OptionCard
              key={opt.type}
              label={opt.label}
              detail={opt.detail}
              badge={opt.badge}
              selected={isChoiceSelected(choice)}
              onClick={() => onSelect(choice)}
            />
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "10px 0" }} />

      {/* Packs */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bbcabf", marginBottom: 10 }}>
        Packs de continuidad
      </p>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap:                 8,
          marginBottom:        16,
        }}
      >
        {PACK_OPTIONS.map((opt) => {
          const choice: SessionChoice = { kind: opt.kind, size: opt.size };
          const hasThisPack = isSignedIn && activePackSize === opt.size;
          return (
            <OptionCard
              key={opt.size}
              label={opt.label}
              detail={opt.detail}
              badge={hasThisPack ? "Pack activo" : opt.badge}
              accent
              selected={isChoiceSelected(choice)}
              onClick={() => onSelect(choice)}
            />
          );
        })}
      </div>

      {/* CTA button — shows after a choice is made */}
      {selectedChoice && (
        <button
          onClick={onConfirm}
          style={{
            width:          "100%",
            padding:        "13px 20px",
            background:     "linear-gradient(135deg, #4edea3, #10b981)",
            border:         "none",
            borderRadius:   10,
            color:          "#003824",
            fontSize:       14,
            fontWeight:     700,
            cursor:         "pointer",
            fontFamily:     "inherit",
            transition:     "opacity 0.15s, transform 0.1s",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            8,
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

      <p style={{ fontSize: 11, color: "#86948a", textAlign: "center", marginTop: 12 }}>
        Cancelación gratuita con 24h de antelación
      </p>
    </div>
  );
}

// ─── Option card ───────────────────────────────────────────────────────────────

function OptionCard({
  label,
  detail,
  badge,
  accent = false,
  selected = false,
  onClick,
}: {
  label:     string;
  detail:    string;
  badge:     string | null;
  accent?:   boolean;
  selected?: boolean;
  onClick:   () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:     "relative",
        textAlign:    "left",
        background:   selected
          ? (accent ? "rgba(78,222,163,0.18)" : "#2a2a2c")
          : isActive
          ? (accent ? "rgba(78,222,163,0.14)" : "#2a2a2c")
          : (accent ? "rgba(78,222,163,0.06)" : "#201f22"),
        border:       selected
          ? "1px solid #4edea3"
          : isActive
          ? `1px solid ${accent ? "rgba(78,222,163,0.45)" : "#4edea3"}`
          : `1px solid ${accent ? "rgba(78,222,163,0.22)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 10,
        padding:      "12px 14px",
        cursor:       "pointer",
        fontFamily:   "inherit",
        transition:   "background 0.12s, border-color 0.12s",
        width:        "100%",
        boxShadow:    selected ? "0 0 0 1px rgba(78,222,163,0.15)" : "none",
      }}
    >
      {badge && (
        <span
          style={{
            position:      "absolute",
            top:           "-1px",
            right:         8,
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding:       "2px 6px",
            borderRadius:  "0 0 6px 6px",
            background:    selected ? "rgba(78,222,163,0.25)" : "rgba(78,222,163,0.15)",
            color:         "#4edea3",
            border:        "1px solid rgba(78,222,163,0.3)",
            borderTop:     "none",
          }}
        >
          {badge}
        </span>
      )}
      <p
        style={{
          fontSize:   13,
          fontWeight: 600,
          color:      selected ? "#4edea3" : accent ? "#4edea3" : "#e5e1e4",
          margin:     0,
          marginTop:  badge ? 10 : 0,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 11.5, color: "#86948a", margin: "3px 0 0" }}>
        {detail}
      </p>
    </button>
  );
}

// ─── Loading dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 3, padding: "10px 0" }}>
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
