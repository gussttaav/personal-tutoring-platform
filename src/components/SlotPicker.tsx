"use client";

/**
 * SlotPicker
 *
 * Replaces CalComBooking. Shows a month calendar on the left and
 * available time slots on the right. Calls /api/availability to fetch
 * slots for the selected date.
 *
 * Props:
 *   durationMinutes  — 15 | 60 | 120
 *   onSlotSelected   — called with { startIso, endIso } when user confirms
 */

import { useState, useEffect, useCallback } from "react";
import { COLORS } from "@/constants";
import { SCHEDULE } from "@/lib/booking-config";
import { Spinner } from "@/components/ui";

export interface SelectedSlot {
  startIso: string;
  endIso:   string;
  label:    string;
  dateLabel: string;
}

interface TimeSlot {
  start: string;
  end:   string;
  label: string;
}

interface SlotPickerProps {
  durationMinutes: 15 | 60 | 120;
  onSlotSelected: (slot: SelectedSlot) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const MONTHS_ES   = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function getMonthGrid(year: number, month: number): (string | null)[][] {
  // Returns a 6x7 grid of YYYY-MM-DD strings (or null for padding)
  const firstDay = new Date(year, month, 1);
  // Monday-first: 0=Mon … 6=Sun
  let startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(ymd);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SlotPicker({ durationMinutes, onSlotSelected }: SlotPickerProps) {
  const today     = new Date();
  const maxDate   = new Date();
  maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots,    setSlots]    = useState<TimeSlot[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState<TimeSlot | null>(null);

  const fetchSlots = useCallback(async (date: string) => {
    setLoading(true);
    setError("");
    setSlots([]);
    setSelected(null);
    try {
      const res  = await fetch(`/api/availability?date=${date}&duration=${durationMinutes}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlots(data.slots ?? []);
    } catch {
      setError("No se pudo cargar la disponibilidad. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [durationMinutes]);

  function handleDateClick(ymd: string) {
    setSelectedDate(ymd);
    fetchSlots(ymd);
  }

  function handleSlotClick(slot: TimeSlot) {
    setSelected(slot);
  }

  function handleConfirm() {
    if (!selected || !selectedDate) return;
    onSlotSelected({
      startIso:  selected.start,
      endIso:    selected.end,
      label:     selected.label,
      dateLabel: formatDateLabel(selectedDate),
    });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const grid     = getMonthGrid(viewYear, viewMonth);
  const todayYMD = toYMD(today);
  const maxYMD   = toYMD(maxDate);

  // Disable past months navigation
  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());
  const canGoNext = !(viewYear === maxDate.getFullYear() && viewMonth === maxDate.getMonth());

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 24,
      padding: "16px 0",
      minHeight: 420,
    }}>
      {/* ── Calendar ── */}
      <div style={{ flex: "1 1 260px" }}>
        {/* Month navigation */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            style={navBtnStyle(!canGoPrev)}
            aria-label="Mes anterior"
          >
            ←
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            style={navBtnStyle(!canGoNext)}
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {WEEKDAYS_ES.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--text-dim)", padding: "4px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {row.map((ymd, ci) => {
              if (!ymd) return <div key={ci} />;

              const isPast      = ymd < todayYMD;
              const isBeyond    = ymd > maxYMD;
              const isToday     = ymd === todayYMD;
              const isSelected  = ymd === selectedDate;
              const isDisabled  = isPast || isBeyond;

              // Check if it's a working day
              const dow = (new Date(`${ymd}T12:00:00`).getDay() + 6) % 7; // 0=Mon
              const calDow = (dow + 1) % 7; // back to 0=Sun for SCHEDULE
              const isWorkingDay = SCHEDULE.workingDays.includes(
                new Date(`${ymd}T12:00:00`).getDay()
              );

              return (
                <button
                  key={ci}
                  disabled={isDisabled || !isWorkingDay}
                  onClick={() => handleDateClick(ymd)}
                  style={{
                    padding: "7px 0",
                    margin: "2px",
                    borderRadius: 8,
                    border: isToday ? `1px solid rgba(61,220,132,0.4)` : "1px solid transparent",
                    background: isSelected ? "var(--green)" : "none",
                    color: isDisabled || !isWorkingDay
                      ? "var(--text-dim)"
                      : isSelected
                        ? "#0d0f10"
                        : isToday
                          ? "var(--green)"
                          : "var(--text)",
                    fontSize: 13,
                    cursor: isDisabled || !isWorkingDay ? "default" : "pointer",
                    fontFamily: "inherit",
                    fontWeight: isSelected ? 500 : 400,
                    transition: "background 0.15s",
                  }}
                  aria-label={ymd}
                  aria-pressed={isSelected}
                >
                  {parseInt(ymd.slice(-2), 10)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Time slots ── */}
      <div style={{ flex: "1 1 200px" }}>
        {!selectedDate && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>
            Selecciona un día para ver los horarios disponibles.
          </p>
        )}

        {selectedDate && loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <Spinner />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Cargando horarios…</span>
          </div>
        )}

        {selectedDate && !loading && error && (
          <p style={{ fontSize: 13, color: COLORS.error }}>{error}</p>
        )}

        {selectedDate && !loading && !error && slots.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No hay horarios disponibles para este día. Prueba con otro.
          </p>
        )}

        {selectedDate && !loading && slots.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
              {formatDateLabel(selectedDate)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {slots.map((slot) => {
                const isChosen = selected?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    onClick={() => handleSlotClick(slot)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: isChosen
                        ? "1px solid var(--green)"
                        : "1px solid var(--border)",
                      background: isChosen ? "rgba(61,220,132,0.1)" : "var(--surface)",
                      color: isChosen ? "var(--green)" : "var(--text)",
                      fontSize: 14,
                      fontWeight: isChosen ? 500 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    aria-pressed={isChosen}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>

            {selected && (
              <button
                onClick={handleConfirm}
                style={{
                  width: "100%", padding: "11px",
                  borderRadius: 8,
                  background: "var(--green)", border: "none",
                  color: "#0d0f10", fontSize: 14, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Confirmar {selected.label} →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function navBtnStyle(disabled: boolean) {
  return {
    background: "none",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "var(--text-dim)" : "var(--text-muted)",
    fontSize: 16,
    padding: "4px 8px",
    borderRadius: 6,
    fontFamily: "inherit",
  } as React.CSSProperties;
}
