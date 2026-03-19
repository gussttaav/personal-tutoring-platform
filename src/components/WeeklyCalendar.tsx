"use client";

/**
 * WeeklyCalendar
 *
 * Replaces SlotPicker. Shows a 7-day week grid with available slots
 * rendered inside each day column. Fetches from /api/availability.
 *
 * API contract unchanged — only the UI changes.
 */

import { useState, useEffect, useCallback } from "react";
import { SCHEDULE } from "@/lib/booking-config";

export interface SelectedSlot {
  startIso:  string;
  endIso:    string;
  label:     string;
  dateLabel: string;
  dateShort: string;
}

interface ApiSlot {
  start: string;
  end:   string;
  label: string;
}

interface WeeklyCalendarProps {
  durationMinutes: 15 | 60 | 120;
  /** Called immediately when the user clicks a slot — no confirm button needed here */
  onSlotSelected: (slot: SelectedSlot) => void;
  /** Controlled selected slot — lets parent clear selection */
  selectedSlot?: SelectedSlot | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT  = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_LONG = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];
const MONTHS_SHORT = [
  "ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic",
];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date(); now.setHours(0,0,0,0);
  const dow = now.getDay();
  // Monday-first
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function weekLabel(days: Date[]): string {
  const f = days[0], l = days[6];
  if (f.getMonth() === l.getMonth()) {
    return `${f.getDate()}–${l.getDate()} de ${MONTHS_LONG[f.getMonth()]} ${f.getFullYear()}`;
  }
  return `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${l.getDate()} ${MONTHS_SHORT[l.getMonth()]} ${l.getFullYear()}`;
}

function formatDateLabel(d: Date): string {
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

function formatDateShort(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({
  durationMinutes,
  onSlotSelected,
  selectedSlot,
}: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  // slots[ymd] = ApiSlot[] | "loading" | "error"
  const [slotsMap, setSlotsMap] = useState<
    Record<string, ApiSlot[] | "loading" | "error">
  >({});

  const maxOffset = SCHEDULE.bookingWindowWeeks;

  const days = getWeekDates(weekOffset);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayYMD = toYMD(today);
  const maxDate  = new Date(today); maxDate.setDate(today.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  const maxYMD   = toYMD(maxDate);

  // Fetch availability for all 7 days of the current week
  useEffect(() => {
    days.forEach(async (date) => {
      const ymd = toYMD(date);
      // Skip past days, beyond-window days, and already-cached days
      if (ymd < todayYMD || ymd > maxYMD) return;
      if (slotsMap[ymd] !== undefined) return;
      // Check working day
      if (!SCHEDULE.workingDays.includes(date.getDay())) {
        setSlotsMap(prev => ({ ...prev, [ymd]: [] }));
        return;
      }

      setSlotsMap(prev => ({ ...prev, [ymd]: "loading" }));
      try {
        const res  = await fetch(`/api/availability?date=${ymd}&duration=${durationMinutes}`);
        const data = await res.json();
        setSlotsMap(prev => ({ ...prev, [ymd]: data.slots ?? [] }));
      } catch {
        setSlotsMap(prev => ({ ...prev, [ymd]: "error" }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, durationMinutes]);

  function handlePrev() {
    if (weekOffset === 0) return;
    setWeekOffset(o => o - 1);
  }

  function handleNext() {
    if (weekOffset >= maxOffset) return;
    setWeekOffset(o => o + 1);
  }

  function handleSlotClick(date: Date, slot: ApiSlot) {
    onSlotSelected({
      startIso:  slot.start,
      endIso:    slot.end,
      label:     slot.label,
      dateLabel: formatDateLabel(date),
      dateShort: formatDateShort(date),
    });
  }

  const canPrev = weekOffset > 0;
  const canNext = weekOffset < maxOffset;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Week header + nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          {weekLabel(days)}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <NavBtn onClick={handlePrev} disabled={!canPrev} direction="left" />
          <NavBtn onClick={handleNext} disabled={!canNext} direction="right" />
        </div>
      </div>

      {/* 7-day grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 6,
      }}>
        {days.map((date) => {
          const ymd     = toYMD(date);
          const isPast  = ymd < todayYMD;
          const isToday = ymd === todayYMD;
          const daySlots = slotsMap[ymd];

          return (
            <div
              key={ymd}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                opacity: isPast ? 0.35 : 1,
              }}
            >
              {/* Day header */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, paddingBottom: 6,
                borderBottom: "1px solid var(--border)", width: "100%",
              }}>
                <span style={{
                  fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: isToday ? "var(--green)" : "var(--text-dim)",
                }}>
                  {DAYS_SHORT[date.getDay()]}
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13,
                  background: isToday ? "var(--surface-2)" : "none",
                  border: isToday ? "1px solid rgba(255,255,255,0.12)" : "none",
                  color: isToday ? "var(--text)" : "var(--text-muted)",
                }}>
                  {date.getDate()}
                </div>
              </div>

              {/* Slots */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                {isPast ? (
                  <EmptyDash />
                ) : daySlots === "loading" ? (
                  <LoadingDots />
                ) : daySlots === "error" || !daySlots || daySlots.length === 0 ? (
                  <EmptyDash />
                ) : (
                  daySlots.map((slot) => {
                    const isSelected = selectedSlot?.startIso === slot.start;
                    return (
                      <SlotButton
                        key={slot.start}
                        label={slot.label}
                        selected={isSelected}
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavBtn({
  onClick, disabled, direction,
}: {
  onClick: () => void;
  disabled: boolean;
  direction: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Semana anterior" : "Semana siguiente"}
      style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        color: "var(--text-muted)",
        fontSize: 14,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.3 : 1,
        transition: "border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
      }}
    >
      {direction === "left" ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      )}
    </button>
  );
}

function SlotButton({
  label, selected, onClick,
}: {
  label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "6px 2px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        textAlign: "center",
        border: selected
          ? "1px solid var(--green)"
          : "1px solid rgba(61,220,132,0.2)",
        background: selected
          ? "var(--green)"
          : "rgba(61,220,132,0.1)",
        color: selected ? "#0d0f10" : "var(--green)",
        fontFamily: "inherit",
        lineHeight: 1.3,
        position: "relative",
        transition: "background 0.15s, border-color 0.15s, transform 0.1s",
        boxShadow: selected ? "0 4px 16px rgba(61,220,132,0.3)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "rgba(61,220,132,0.22)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(61,220,132,0.45)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "rgba(61,220,132,0.1)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(61,220,132,0.2)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }
      }}
    >
      {label}
      {selected && (
        <span style={{
          position: "absolute", top: -6, right: -4,
          width: 14, height: 14,
          background: "var(--green)",
          border: "2px solid var(--bg)",
          borderRadius: "50%",
          fontSize: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#0d0f10",
        }}>✓</span>
      )}
    </button>
  );
}

function EmptyDash() {
  return (
    <div style={{
      width: "100%", height: 36,
      borderRadius: 8,
      background: "var(--surface)",
      border: "1px dashed var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ width: 14, height: 1, background: "var(--text-dim)" }} />
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{
      width: "100%", height: 36,
      borderRadius: 8,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 3,
    }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 4, height: 4, borderRadius: "50%",
            background: "var(--text-dim)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
