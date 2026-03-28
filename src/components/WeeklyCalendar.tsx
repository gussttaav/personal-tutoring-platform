"use client";

/**
 * WeeklyCalendar — Emerald Nocturne · booking.html design
 *
 * ALL LOGIC IS IDENTICAL TO ORIGINAL.
 * Only the visual structure has been replaced to match booking.html:
 *   - min-w-[1000px] 7-column grid with divide-x
 *   - Full day names ("Lunes", "Martes"…) with large date numbers
 *   - Taller slot buttons (py-3) with selected check-badge
 *   - Labeled nav buttons ("Anterior" / "Siguiente")
 *   - "Semana del X de Month" week heading
 *   - "Sin disponibilidad" / "Cerrado" day states
 *
 * Exported types (ApiSlot, SelectedSlot) and component signature are unchanged.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { SCHEDULE, DAY_SCHEDULES } from "@/lib/booking-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiSlot {
  start:      string;
  end:        string;
  label:      string;
  localLabel: string;
}

export interface SelectedSlot {
  startIso:  string;
  endIso:    string;
  label:     string;
  dateLabel: string;
  note?:     string;
  timezone?: string;
}

interface WeeklyCalendarProps {
  durationMinutes: 15 | 60 | 120;
  onSlotSelected:  (slot: SelectedSlot) => void;
  selectedSlot?:   SelectedSlot | null;
}

type DaySlots = ApiSlot[] | "loading" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(offset = 0): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  return monday;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function slotKey(date: Date, slot: ApiSlot): string {
  return `${formatDateKey(date)}-${slot.start}`;
}

// Full day names for column headers
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// "Semana del 7 de octubre" — uses Monday's date
function formatWeekHeading(weekStart: Date): string {
  const day   = weekStart.getDate();
  const month = weekStart.toLocaleDateString("es-ES", { month: "long" });
  return `Semana del ${day} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({
  durationMinutes,
  onSlotSelected,
  selectedSlot,
}: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slotsMap,   setSlotsMap]   = useState<Record<string, DaySlots>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [modalSlot,  setModalSlot]  = useState<{ slot: ApiSlot; date: Date } | null>(null);
  const [isMobile,   setIsMobile]   = useState(false);
  const [userTz,     setUserTz]     = useState<string>(SCHEDULE.timezone);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxWeekOffset = SCHEDULE.bookingWindowWeeks - 1;
  const weekStart     = getWeekStart(weekOffset);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 500);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Detect user timezone
  useEffect(() => {
    try {
      setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch { /* ignore */ }
  }, []);

  // Build 7-day window
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Fetch slots for each day in the window
  useEffect(() => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

    days.forEach((date) => {
      const key = formatDateKey(date);
      if (slotsMap[key]) return;

      const isPast   = date < today;
      const isBeyond = date > maxDate;
      const dow      = date.getDay();
      const noSched  = DAY_SCHEDULES[dow] === null;

      if (isPast || isBeyond || noSched) return;

      setSlotsMap((prev) => ({ ...prev, [key]: "loading" }));

      const tz = encodeURIComponent(userTz);
      fetch(`/api/availability?date=${key}&duration=${durationMinutes}&tz=${tz}`)
        .then((r) => r.json())
        .then((data) => {
          setSlotsMap((prev) => ({
            ...prev,
            [key]: Array.isArray(data.slots) ? data.slots : "error",
          }));
        })
        .catch(() => {
          setSlotsMap((prev) => ({ ...prev, [key]: "error" }));
        });
    });
  }, [weekOffset, durationMinutes, userTz]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotClick = useCallback((date: Date, slot: ApiSlot) => {
    const key = slotKey(date, slot);
    if (isMobile) {
      if (focusedKey === key) {
        setModalSlot({ slot, date });
        setFocusedKey(null);
      } else {
        setFocusedKey(key);
      }
    } else {
      setFocusedKey(key);
    }
  }, [isMobile, focusedKey]);

  const handleSelectOverlay = useCallback((date: Date, slot: ApiSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalSlot({ slot, date });
    setFocusedKey(null);
  }, []);

  const handleModalConfirm = useCallback((note?: string) => {
    if (!modalSlot) return;
    const { slot, date } = modalSlot;
    const tzDiffers     = userTz !== SCHEDULE.timezone;
    const displayLabel  = tzDiffers ? slot.localLabel : slot.label;
    onSlotSelected({
      startIso:  slot.start,
      endIso:    slot.end,
      label:     displayLabel,
      dateLabel: formatDateLabel(date),
      note,
      timezone:  userTz,
    });
    setModalSlot(null);
  }, [modalSlot, userTz, onSlotSelected]);

  const handleModalClose = useCallback(() => setModalSlot(null), []);

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  const tzDiffers = userTz !== SCHEDULE.timezone;

  return (
    <>
      <div ref={containerRef}>
        {/* ── Weekly header with navigation ── */}
        <div
          className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#1c1b1d" }}
        >
          <div>
            <h1
              className="font-headline text-3xl tracking-tight"
              style={{ color: "#e5e1e4", letterSpacing: "-0.02em" }}
            >
              {formatWeekHeading(weekStart)}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#bbcabf" }}>
              {tzDiffers
                ? `Horarios en tu zona (${userTz})`
                : "Selecciona el horario que mejor encaje en tu flujo de trabajo."}
            </p>
          </div>

          {/* Nav buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              disabled={weekOffset === 0}
              aria-label="Semana anterior"
              className="p-3 rounded-lg flex items-center gap-2 group transition-colors"
              style={{
                background: "#201f22",
                border: "1px solid #3c4a42",
                color: weekOffset === 0 ? "rgba(187,202,191,0.3)" : "#bbcabf",
                cursor: weekOffset === 0 ? "not-allowed" : "pointer",
                opacity: weekOffset === 0 ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (weekOffset !== 0) {
                  (e.currentTarget as HTMLElement).style.background = "#2a2a2c";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#201f22";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="group-hover:-translate-x-0.5 transition-transform"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-widest pr-1">Anterior</span>
            </button>

            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              disabled={weekOffset >= maxWeekOffset}
              aria-label="Semana siguiente"
              className="p-3 rounded-lg flex items-center gap-2 group transition-colors"
              style={{
                background: "#201f22",
                border: "1px solid #3c4a42",
                color: weekOffset >= maxWeekOffset ? "rgba(187,202,191,0.3)" : "#bbcabf",
                cursor: weekOffset >= maxWeekOffset ? "not-allowed" : "pointer",
                opacity: weekOffset >= maxWeekOffset ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (weekOffset < maxWeekOffset) {
                  (e.currentTarget as HTMLElement).style.background = "#2a2a2c";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#201f22";
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest pl-1">Siguiente</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="group-hover:translate-x-0.5 transition-transform"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Weekly grid ── */}
        <div className="overflow-x-auto hide-scrollbar">
          <div
            className="grid"
            style={{
              minWidth: "1000px",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderTop: "none",
            }}
          >
            {days.map((date) => {
              const key      = formatDateKey(date);
              const dow      = date.getDay();
              const daySlots = slotsMap[key];
              const isPast   = date < today;
              const isBeyond = date > maxDate;
              const noSched  = DAY_SCHEDULES[dow] === null;
              const isToday  = date.toDateString() === today.toDateString();
              const isClosed = isPast || isBeyond || noSched;

              return (
                <div
                  key={key}
                  className="flex flex-col"
                  style={{
                    borderRight: "1px solid rgba(255,255,255,0.05)",
                    opacity: isClosed && (noSched) ? 0.5 : 1,
                  }}
                >
                  {/* Day header */}
                  <div
                    className="p-4 text-center"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: isToday
                        ? "rgba(78,222,163,0.06)"
                        : isClosed && noSched
                        ? "rgba(14,14,16,0.3)"
                        : "rgba(32,31,34,0.3)",
                    }}
                  >
                    <p
                      className="font-label uppercase font-bold"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.1em",
                        color: isToday ? "#4edea3" : "#bbcabf",
                      }}
                    >
                      {DAY_NAMES[dow]}
                    </p>
                    <p
                      className="font-headline text-2xl mt-1"
                      style={{
                        color: isToday ? "#4edea3" : "#e5e1e4",
                        lineHeight: 1,
                      }}
                    >
                      {date.getDate()}
                    </p>
                  </div>

                  {/* Slot list */}
                  <div className="p-4 space-y-3" style={{ minHeight: "400px" }}>
                    {isClosed && noSched ? (
                      <div
                        className="flex flex-col items-center justify-center h-20 italic"
                        style={{ color: "rgba(134,148,138,0.2)", fontSize: "10px" }}
                      >
                        Cerrado
                      </div>
                    ) : isPast || isBeyond ? (
                      <div
                        className="flex flex-col items-center justify-center h-20 italic"
                        style={{ color: "rgba(134,148,138,0.3)", fontSize: "10px" }}
                      >
                        No disponible
                      </div>
                    ) : daySlots === "loading" || daySlots === undefined ? (
                      <LoadingDots />
                    ) : daySlots === "error" || daySlots.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center h-20 italic"
                        style={{ color: "rgba(134,148,138,0.3)", fontSize: "10px" }}
                      >
                        Sin disponibilidad
                      </div>
                    ) : (
                      daySlots.map((slot) => {
                        const sk           = slotKey(date, slot);
                        const isFocused    = focusedKey === sk;
                        const isSelected   = selectedSlot?.startIso === slot.start;
                        const displayLabel = tzDiffers ? slot.localLabel : slot.label;
                        return (
                          <SlotButton
                            key={slot.start}
                            label={displayLabel}
                            subLabel={tzDiffers ? slot.label : undefined}
                            focused={isFocused}
                            selected={isSelected}
                            isMobile={isMobile}
                            onClick={() => handleSlotClick(date, slot)}
                            onSelectOverlay={(e) => handleSelectOverlay(date, slot, e)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isMobile && focusedKey && (
          <p
            className="text-center text-xs mt-3"
            style={{ color: "#86948a" }}
          >
            Toca el horario seleccionado de nuevo para confirmar
          </p>
        )}
      </div>

      {/* Confirmation modal */}
      {modalSlot && (
        <ConfirmModal
          slot={modalSlot.slot}
          date={modalSlot.date}
          userTz={userTz}
          onConfirm={handleModalConfirm}
          onClose={handleModalClose}
        />
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  slot, date, userTz, onConfirm, onClose,
}: {
  slot:      ApiSlot;
  date:      Date;
  userTz:    string;
  onConfirm: (note?: string) => void;
  onClose:   () => void;
}) {
  const [note, setNote]   = useState("");
  const tzDiffers         = userTz !== SCHEDULE.timezone;
  const dateLabel         = formatDateLabel(date);
  const localLabel        = slot.localLabel;
  const madridLabel       = slot.label;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          background: "rgba(53,52,55,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderRadius: 16, width: "100%", maxWidth: 420,
          padding: "24px",
          display: "flex", flexDirection: "column", gap: 18,
          animation: "fadeUp 0.2s ease both",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(78,222,163,0.1)",
              border: "1px solid rgba(78,222,163,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e1e4" }}>{dateLabel}</div>
              <div style={{ fontSize: 13, color: "#bbcabf" }}>
                {tzDiffers ? `${localLabel} (tu hora)` : localLabel}
                {tzDiffers && <span style={{ color: "#86948a", marginLeft: 4 }}>· {madridLabel} Madrid</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#bbcabf", padding: 4, borderRadius: 6 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e5e1e4")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#bbcabf")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Note input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#bbcabf", display: "block", marginBottom: 6 }}>
            Motivo de la sesión <span style={{ color: "#86948a", fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ej: tengo dudas sobre recursividad en Java, preparación de entrevista técnica..."
            style={{
              width: "100%", padding: "10px 12px",
              background: "#201f22",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, color: "#e5e1e4",
              fontFamily: "inherit", fontSize: 13, lineHeight: 1.6,
              resize: "vertical", outline: "none",
              transition: "border-color 0.15s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(78,222,163,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
          />
          <p style={{ fontSize: 11.5, color: "#86948a", marginTop: 5 }}>
            También puedes enviar los detalles por email después
          </p>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(note || undefined)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "13px 20px",
            background: "linear-gradient(135deg, #4edea3, #10b981)",
            border: "none", borderRadius: 8,
            color: "#003824", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            transition: "opacity 0.15s, transform 0.1s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; (e.currentTarget as HTMLElement).style.transform = "scale(1.01)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Confirmar reserva
        </button>

        <p style={{ fontSize: 11.5, color: "#86948a", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, margin: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Recibirás confirmación por correo
        </p>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Slot button ──────────────────────────────────────────────────────────────

function SlotButton({
  label, subLabel, focused, selected, isMobile, onClick, onSelectOverlay,
}: {
  label:           string;
  subLabel?:       string;
  focused:         boolean;
  selected:        boolean;
  isMobile:        boolean;
  onClick:         () => void;
  onSelectOverlay: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showOverlay = focused && (hovered || isMobile);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        className="w-full rounded-lg font-headline text-xs transition-all text-center"
        style={{
          padding: subLabel ? "6px 8px" : "12px 8px",
          border: selected
            ? "1px solid #4edea3"
            : focused
            ? "1px solid rgba(78,222,163,0.5)"
            : "1px solid #3c4a42",
          background: selected
            ? "#4edea3"
            : focused
            ? "rgba(78,222,163,0.12)"
            : "#2a2a2c",
          color: selected ? "#003824" : "#e5e1e4",
          fontWeight: focused || selected ? 700 : 400,
          boxShadow: selected ? "0 0 15px rgba(78,222,163,0.3)" : "none",
          cursor: "pointer",
          lineHeight: 1.3,
        }}
        onMouseEnter={(e) => {
          if (!selected && !focused) {
            (e.currentTarget as HTMLElement).style.borderColor = "#4edea3";
          }
        }}
        onMouseLeave={(e) => {
          if (!selected && !focused) {
            (e.currentTarget as HTMLElement).style.borderColor = "#3c4a42";
          }
        }}
      >
        {label}
        {subLabel && (
          <div style={{ fontSize: "9px", opacity: 0.6, lineHeight: 1.2 }}>{subLabel}</div>
        )}
      </button>

      {/* Selected check badge */}
      {selected && (
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            top: "-6px",
            right: "-6px",
            width: "18px",
            height: "18px",
            background: "#131315",
            color: "#4edea3",
          }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#4edea3">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </div>
      )}

      {/* Hover overlay when focused (desktop) */}
      {focused && !selected && (
        <button
          onClick={onSelectOverlay}
          className="absolute inset-0 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
          style={{
            border: "none",
            background: hovered ? "rgba(78,222,163,0.92)" : "rgba(78,222,163,0.0)",
            color: "#003824",
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: hovered ? 1 : 0,
          }}
          aria-label="Seleccionar este horario"
        >
          ✓ Seleccionar
        </button>
      )}
    </div>
  );
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div
      className="flex items-center justify-center gap-1 py-8"
      style={{ color: "#86948a" }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#86948a",
            animation: `calPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes calPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
