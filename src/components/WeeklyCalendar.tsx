"use client";

/**
 * WeeklyCalendar — Emerald Nocturne · time-grid redesign
 *
 * Visual style mirrors AvailabilityModal: a sticky time-labels column + 7 day
 * columns with uniform-height rows.
 *
 * Selection is two-step:
 *   1st click → focus the block (visual highlight, fires onSlotFocused)
 *   2nd click on ANY cell in the focused block → confirm (fires onSlotSelected)
 *   "Continuar" button in parent → calls onSlotSelected(focusedSlot) directly
 *
 * Duration logic:
 *   15 min  → 15-min atoms, 1 cell = 1 slot
 *   60 min  → 30-min atoms, contiguous 2-cell check
 *   120 min → 30-min atoms, contiguous 4-cell check
 *
 * Exported types (ApiSlot, SelectedSlot) and component props are unchanged.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  onSlotFocused?:  (slot: SelectedSlot | null) => void;
  selectedSlot?:   SelectedSlot | null;
  /** ISO start string from AvailabilityModal — auto-focuses the matching slot
   *  once it loads, as if the user had clicked it. */
  initialFocusedSlotStart?: string;
  /** Week offset to start on (default 0 = current week). */
  initialWeekOffset?: number;
}

type DaySlots = ApiSlot[] | "loading" | "error";

/** Internal focused block: the pre-confirmed selection state. */
interface FocusedBlock {
  dateKey:    string;       // formatDateKey of the day
  block:      ApiSlot[];    // contiguous atoms
  anchorKey:  string;       // "HH:MM" of the cell the user clicked
  slot:       SelectedSlot;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_ABBR  = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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

function formatWeekHeading(weekStart: Date): string {
  const day   = weekStart.getDate();
  const month = weekStart.toLocaleDateString("es-ES", { month: "long" });
  return `Semana del ${day} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
}

/** Build "HH:MM" time rows for the grid. */
function buildTimeRows(atomicMins: 15 | 30): string[] {
  const rows: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += atomicMins) {
      if (h === 18 && m + atomicMins > 60) break; // last start ensures end ≤ 19:00
      rows.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return rows;
}

/** Map each slot's display-timezone start "HH:MM" → ApiSlot. */
function buildTimeMap(slots: ApiSlot[], tzDiffers: boolean): Map<string, ApiSlot> {
  const map = new Map<string, ApiSlot>();
  for (const slot of slots) {
    const label = tzDiffers ? slot.localLabel : slot.label;
    const key   = label.split(/\s*[–\-]\s*/)[0]?.trim() ?? "";
    if (key) map.set(key, slot);
  }
  return map;
}

/** Extract the display start "HH:MM" from a slot. */
function slotStartKey(slot: ApiSlot, tzDiffers: boolean): string {
  const label = tzDiffers ? slot.localLabel : slot.label;
  return label.split(/\s*[–\-]\s*/)[0]?.trim() ?? "";
}

/**
 * Attempt to pick `cellsNeeded` contiguous available atoms starting from or
 * ending at the clicked time key.
 */
function findContiguousBlock(
  timeRows:   string[],
  slotMap:    Map<string, ApiSlot>,
  clickedKey: string,
  cellsNeeded: number,
): ApiSlot[] | null {
  const idx = timeRows.indexOf(clickedKey);
  if (idx === -1) return null;

  // Forward: clicked + next (cellsNeeded-1)
  if (idx + cellsNeeded <= timeRows.length) {
    const fwd = timeRows.slice(idx, idx + cellsNeeded).map((k) => slotMap.get(k));
    if (fwd.every(Boolean)) return fwd as ApiSlot[];
  }

  // Backward: previous (cellsNeeded-1) + clicked
  if (idx - (cellsNeeded - 1) >= 0) {
    const bwd = timeRows.slice(idx - (cellsNeeded - 1), idx + 1).map((k) => slotMap.get(k));
    if (bwd.every(Boolean)) return bwd as ApiSlot[];
  }

  return null;
}

/** Build the SelectedSlot from a contiguous block of atoms. */
function blockToSelectedSlot(
  date:            Date,
  block:           ApiSlot[],
  userTz:          string,
  tzDiffers:       boolean,
  durationMinutes: 15 | 60 | 120,
): SelectedSlot {
  const first = block[0]!;
  const last  = block[block.length - 1]!;
  const firstLabel = tzDiffers ? first.localLabel : first.label;
  const lastLabel  = tzDiffers ? last.localLabel  : last.label;

  const startTime = firstLabel.split(/\s*[–\-]\s*/)[0]?.trim() ?? "";
  const endTime   = lastLabel.includes("–") || lastLabel.includes("-")
    ? (lastLabel.split(/\s*[–\-]\s*/)[1]?.trim() ?? "")
    : new Date(last.end).toLocaleTimeString("es-ES", {
        timeZone: userTz,
        hour:     "2-digit",
        minute:   "2-digit",
        hour12:   false,
      });

  return {
    startIso:  first.start,
    endIso:    last.end,
    label:     durationMinutes === 15 ? startTime : `${startTime}–${endTime}`,
    dateLabel: formatDateLabel(date),
    timezone:  userTz,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({
  durationMinutes,
  onSlotSelected,
  onSlotFocused,
  selectedSlot,
  initialFocusedSlotStart,
  initialWeekOffset = 0,
}: WeeklyCalendarProps) {
  const atomicMinutes: 15 | 30 = durationMinutes === 15 ? 15 : 30;
  const cellsPerSlot            = durationMinutes === 15 ? 1 : durationMinutes === 60 ? 2 : 4;

  const [weekOffset,    setWeekOffset]    = useState(initialWeekOffset);
  const [slotsMap,      setSlotsMap]      = useState<Record<string, DaySlots>>({});
  const [focusedBlock,  setFocusedBlock]  = useState<FocusedBlock | null>(null);
  const [invalidKey,    setInvalidKey]    = useState<string | null>(null);
  const [isMobile,      setIsMobile]      = useState(false);
  const [userTz,        setUserTz]        = useState<string>(SCHEDULE.timezone);
  const initialFocusedHandled             = useRef(false);

  const maxWeekOffset = SCHEDULE.bookingWindowWeeks - 1;
  const weekStart     = getWeekStart(weekOffset);
  const tzDiffers     = userTz !== SCHEDULE.timezone;

  const timeRows = useMemo(() => buildTimeRows(atomicMinutes), [atomicMinutes]);

  const days: Date[] = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Clear focused block when navigating weeks
  useEffect(() => {
    setFocusedBlock((prev) => {
      if (prev) onSlotFocused?.(null);
      return null;
    });
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear focused block when the parent confirms the slot externally
  // (e.g. "Continuar" button calls onSlotSelected via focusedSlot)
  useEffect(() => {
    if (selectedSlot) setFocusedBlock(null);
  }, [selectedSlot?.startIso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch atomic slots for each day in the window
  useEffect(() => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

    days.forEach((date) => {
      const key = formatDateKey(date);
      if (slotsMap[key]) return;

      const isPast  = date < today;
      const isBeyond = date > maxDate;
      const dow     = date.getDay();
      const noSched = DAY_SCHEDULES[dow] === null;

      if (isPast || isBeyond || noSched) return;

      setSlotsMap((prev) => ({ ...prev, [key]: "loading" }));

      const tz = encodeURIComponent(userTz);
      fetch(`/api/availability?date=${key}&duration=${atomicMinutes}&tz=${tz}`)
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
  }, [weekOffset, atomicMinutes, userTz]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus initialFocusedSlotStart once its day's slots load.
  // Fires onSlotFocused (not onSlotSelected) — preserves original contract.
  useEffect(() => {
    if (!initialFocusedSlotStart || initialFocusedHandled.current) return;
    const targetMs = new Date(initialFocusedSlotStart).getTime();
    for (const date of days) {
      const key      = formatDateKey(date);
      const daySlots = slotsMap[key];
      if (!Array.isArray(daySlots)) continue;
      const match = daySlots.find((s) => new Date(s.start).getTime() === targetMs);
      if (match) {
        initialFocusedHandled.current = true;
        const tmap  = buildTimeMap(daySlots, tzDiffers);
        const tkey  = slotStartKey(match, tzDiffers);
        const block = findContiguousBlock(timeRows, tmap, tkey, cellsPerSlot);
        if (block) {
          const slot = blockToSelectedSlot(date, block, userTz, tzDiffers, durationMinutes);
          setFocusedBlock({ dateKey: key, block, anchorKey: tkey, slot });
          onSlotFocused?.(slot);
        }
        break;
      }
    }
  }, [slotsMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellClick = useCallback((date: Date, timeKey: string) => {
    const dayKey  = formatDateKey(date);

    // ── Second click: if this cell is in the current focused block → confirm ──
    if (focusedBlock && focusedBlock.dateKey === dayKey) {
      const inFocused = focusedBlock.block.some(
        (s) => slotStartKey(s, tzDiffers) === timeKey,
      );
      if (inFocused && timeKey === focusedBlock.anchorKey) {
        // Hot slot clicked again → confirm selection
        onSlotSelected(focusedBlock.slot);
        onSlotFocused?.(null);
        setFocusedBlock(null);
        return;
      }
      // Any other cell (non-hot slot in block, or outside) → fall through and
      // recalculate: the clicked cell becomes the new hot slot.
    }

    // ── First click (or different cell) ──
    const dayData = slotsMap[dayKey];
    if (!Array.isArray(dayData)) {
      setFocusedBlock(null);
      onSlotFocused?.(null);
      return;
    }

    const tmap  = buildTimeMap(dayData, tzDiffers);
    const block = findContiguousBlock(timeRows, tmap, timeKey, cellsPerSlot);

    if (!block) {
      setFocusedBlock(null);
      onSlotFocused?.(null);
      const ik = `${dayKey}-${timeKey}`;
      setInvalidKey(ik);
      setTimeout(() => setInvalidKey(null), 500);
      return;
    }

    const slot = blockToSelectedSlot(date, block, userTz, tzDiffers, durationMinutes);
    setFocusedBlock({ dateKey: dayKey, block, anchorKey: timeKey, slot });
    onSlotFocused?.(slot);
  }, [slotsMap, tzDiffers, timeRows, cellsPerSlot, userTz, durationMinutes,
      focusedBlock, onSlotSelected, onSlotFocused]);

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);

  const ROW_H    = isMobile ? 40 : 48;
  const HEADER_H = isMobile ? 52 : 64;

  return (
    <>
      <div>
        {/* ── Week header with navigation ── */}
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
                border:     "1px solid #3c4a42",
                color:      weekOffset === 0 ? "rgba(187,202,191,0.3)" : "#bbcabf",
                cursor:     weekOffset === 0 ? "not-allowed" : "pointer",
                opacity:    weekOffset === 0 ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (weekOffset !== 0) (e.currentTarget as HTMLElement).style.background = "#2a2a2c"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#201f22"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:-translate-x-0.5 transition-transform" aria-hidden="true">
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
                border:     "1px solid #3c4a42",
                color:      weekOffset >= maxWeekOffset ? "rgba(187,202,191,0.3)" : "#bbcabf",
                cursor:     weekOffset >= maxWeekOffset ? "not-allowed" : "pointer",
                opacity:    weekOffset >= maxWeekOffset ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (weekOffset < maxWeekOffset) (e.currentTarget as HTMLElement).style.background = "#2a2a2c"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#201f22"; }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest pl-1">Siguiente</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Time grid ── */}
        {/*
          The outer div scrolls horizontally on small screens.
          The time column is position:sticky so it stays visible while scrolling.
        */}
        <div className="overflow-x-auto hide-scrollbar" style={{ position: "relative" }}>
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "52px repeat(7, 1fr)",
              columnGap:           1,
              background:          "rgba(255,255,255,0.05)",
              minWidth:            480,
            }}
          >
            {/* ── Sticky time column ── */}
            <div style={{
              background:  "#111113",
              position:    "sticky",
              left:        0,
              zIndex:      2,
              boxShadow:   "2px 0 6px rgba(0,0,0,0.5)",
            }}>
              {/* Header spacer */}
              <div style={{ height: HEADER_H, borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
              {/* Time labels — "HH:MM" for every row */}
              {timeRows.map((hhmm, i) => (
                <div
                  key={hhmm}
                  style={{
                    height:         ROW_H,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "flex-end",
                    paddingRight:   8,
                    borderTop:      i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                  }}
                >
                  <span style={{
                    fontSize:           isMobile ? 8 : 9,
                    fontWeight:         500,
                    color:              "#86948a",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace:         "nowrap",
                  }}>
                    {hhmm}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Day columns ── */}
            {days.map((date) => {
              const key       = formatDateKey(date);
              const dow       = date.getDay();
              const daySlots  = slotsMap[key];
              const isPast    = date < today;
              const isBeyond  = date > maxDate;
              const noSched   = DAY_SCHEDULES[dow] === null;
              const isClosed  = isPast || isBeyond || noSched;
              const isToday   = date.toDateString() === today.toDateString();
              const isLoading = daySlots === "loading" || (!isClosed && daySlots === undefined);
              const timeMap   = Array.isArray(daySlots) ? buildTimeMap(daySlots, tzDiffers) : null;

              // Focused block boundaries for this day
              const focusedHere = focusedBlock?.dateKey === key ? focusedBlock : null;
              const focusedFirstKey = focusedHere
                ? slotStartKey(focusedHere.block[0]!, tzDiffers)
                : null;
              const focusedLastKey = focusedHere
                ? slotStartKey(focusedHere.block[focusedHere.block.length - 1]!, tzDiffers)
                : null;

              // Confirmed selection boundaries for this day
              const selFirstMs = selectedSlot ? new Date(selectedSlot.startIso).getTime() : null;
              const selEndMs   = selectedSlot ? new Date(selectedSlot.endIso).getTime()   : null;

              return (
                <div
                  key={key}
                  style={{
                    opacity:    isClosed ? 0.32 : 1,
                    background: isToday ? "rgba(78,222,163,0.025)" : "#1c1b1d",
                  }}
                >
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
                    {isToday && (
                      <div style={{
                        position:     "absolute",
                        top:          0,
                        left:         "20%",
                        right:        "20%",
                        height:       2,
                        background:   "#4edea3",
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
                      {isMobile ? DAY_ABBR[dow] : DAY_NAMES[dow]}
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
                  {timeRows.map((hhmm, i) => {
                    if (isClosed) {
                      return (
                        <div key={hhmm} style={{
                          height:    ROW_H,
                          borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
                        }} />
                      );
                    }

                    if (isLoading) {
                      return (
                        <div key={hhmm} style={{
                          height:         ROW_H,
                          borderTop:      i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
                          display:        hhmm === "10:00" ? "flex" : undefined,
                          alignItems:     "center",
                          justifyContent: "center",
                        }}>
                          {hhmm === "10:00" && <LoadingDots />}
                        </div>
                      );
                    }

                    const slot      = timeMap?.get(hhmm) ?? null;
                    const cellKey   = `${key}-${hhmm}`;
                    const isInvalid = invalidKey === cellKey;

                    // ── Confirmed selection state ──
                    const slotMs    = slot ? new Date(slot.start).getTime() : null;
                    const inSel     = !!(slotMs !== null && selFirstMs !== null && selEndMs !== null
                      && slotMs >= selFirstMs && slotMs < selEndMs);
                    const isSelTop  = inSel && slotMs === selFirstMs;
                    const isSelBot  = inSel && (() => {
                      const nextIdx = timeRows.indexOf(hhmm) + 1;
                      if (nextIdx >= timeRows.length) return true;
                      const nx = timeMap?.get(timeRows[nextIdx]!);
                      if (!nx) return true;
                      const nxMs = new Date(nx.start).getTime();
                      return !(nxMs >= selFirstMs! && nxMs < selEndMs!);
                    })();

                    // ── Focused block state ──
                    const inFocus       = !!(focusedHere && slot
                      && focusedHere.block.some((s) => s.start === slot.start));
                    const isFocusAnchor = inFocus && hhmm === focusedHere!.anchorKey;
                    const isFocusTop    = inFocus && hhmm === focusedFirstKey;
                    const isFocusBot    = inFocus && hhmm === focusedLastKey;

                    return (
                      <div key={hhmm} style={{
                        height:    ROW_H,
                        padding:   "3px 3px",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                      }}>
                        {slot ? (
                          <SlotCell
                            timeLabel={isMobile ? null : hhmm}
                            inSel={inSel}
                            isSelTop={isSelTop}
                            isSelBot={isSelBot}
                            inFocus={inFocus}
                            isFocusAnchor={isFocusAnchor}
                            isFocusTop={isFocusTop}
                            isFocusBot={isFocusBot}
                            isInvalid={isInvalid}
                            onClick={() => handleCellClick(date, hhmm)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 12px 14px 64px" }}>
          <LegendDot bg="rgba(78,222,163,0.18)" border="rgba(78,222,163,0.35)" label="Disponible" />
          <LegendDot bg="rgba(78,222,163,0.32)" border="rgba(78,222,163,0.6)"  label="Preseleccionado" />
          <LegendDot bg="rgba(78,222,163,0.55)" border="rgba(78,222,163,0.8)"  label="Confirmado" />
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}

// ─── Slot cell ─────────────────────────────────────────────────────────────────

function SlotCell({
  timeLabel,
  inSel, isSelTop, isSelBot,
  inFocus, isFocusAnchor, isFocusTop, isFocusBot,
  isInvalid,
  onClick,
}: {
  timeLabel:    string | null;
  inSel:        boolean;
  isSelTop:     boolean;
  isSelBot:     boolean;
  inFocus:      boolean;
  isFocusAnchor: boolean;
  isFocusTop:   boolean;
  isFocusBot:   boolean;
  isInvalid:    boolean;
  onClick:      () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Compute border-radius based on block position
  function blockRadius(isTop: boolean, isBot: boolean): string {
    const t = isTop ? 4 : 0;
    const b = isBot ? 4 : 0;
    return `${t}px ${t}px ${b}px ${b}px`;
  }

  let bg           = hovered ? "rgba(78,222,163,0.22)" : "rgba(78,222,163,0.13)";
  let borderColor  = hovered ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.3)";
  let radius       = "4px";
  let labelColor   = "#4edea3";

  if (inSel) {
    bg          = "rgba(78,222,163,0.55)";
    borderColor = "rgba(78,222,163,0.8)";
    radius      = blockRadius(isSelTop, isSelBot);
    labelColor  = "#003824";
  } else if (inFocus) {
    // Anchor cell is slightly darker to mark the entry point
    bg          = isFocusAnchor ? "rgba(78,222,163,0.42)" : "rgba(78,222,163,0.28)";
    borderColor = isFocusAnchor ? "rgba(78,222,163,0.75)" : "rgba(78,222,163,0.55)";
    radius      = blockRadius(isFocusTop, isFocusBot);
    labelColor  = "#4edea3";
  }

  if (isInvalid) {
    bg          = "rgba(239,68,68,0.25)";
    borderColor = "rgba(239,68,68,0.5)";
    radius      = "4px";
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
        alignItems:     "center",
        justifyContent: "center",
        cursor:         "pointer",
        border:         `1px solid ${borderColor}`,
        background:     bg,
        borderRadius:   radius,
        transition:     "background 0.1s, border-color 0.1s",
        fontFamily:     "inherit",
        overflow:       "hidden",
      }}
      aria-label={timeLabel ? `Disponible a las ${timeLabel}` : "Hora disponible"}
    >
      {timeLabel && (
        <span style={{
          fontSize:      9,
          fontWeight:    600,
          color:         labelColor,
          whiteSpace:    "nowrap",
          pointerEvents: "none",
          lineHeight:    1,
        }}>
          {timeLabel}
        </span>
      )}
    </button>
  );
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

function LegendDot({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
      <span style={{
        width: 18, height: 10, borderRadius: 3,
        background: bg,
        border: `1px solid ${border}`,
        display: "inline-block", flexShrink: 0,
      }} />
      {label}
    </span>
  );
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:        3,
            height:       3,
            borderRadius: "50%",
            background:   "#86948a",
            animation:    `wcalPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes wcalPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
