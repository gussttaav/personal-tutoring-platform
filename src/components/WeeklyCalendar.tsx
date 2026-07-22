"use client";

/**
 * REFACTOR-R3-P3-01 — consumes the shared week-grid module
 *
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
 * Date/format/grid helpers, SlotCell, LoadingDots, TimeColumn and the per-day
 * fetch (useWeekAvailability) live in src/components/week-grid; block-selection
 * logic (findContiguousBlock, blockToSelectedSlot) stays here. ApiSlot and
 * SelectedSlot are re-exported below for back-compat with existing import sites.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useClientValue } from "@/hooks/useClientValue";
import { gridHourRange } from "@/lib/booking-config";
import { useScheduleConfig } from "@/components/booking/ScheduleProvider";
import { formatTime } from "@/lib/formatting";
import type { ApiSlot, SelectedSlot } from "@/components/week-grid/types";
import {
  getDayName,
  getWeekStart,
  formatDateLabel,
  formatDateKey,
  formatWeekHeading,
  getNowMinutes,
  getTimeRowHierarchy,
  rowBorderTop,
  hourBandBackground,
  buildTimeRows,
  isWithinWorkingHours,
  buildTimeMap,
  slotStartKey,
} from "@/components/week-grid/helpers";
import { SlotCell } from "@/components/week-grid/SlotCell";
import { LoadingDots } from "@/components/week-grid/LoadingDots";
import { TimeColumn } from "@/components/week-grid/TimeColumn";
import { useWeekAvailability } from "@/hooks/useWeekAvailability";

// ─── Types ────────────────────────────────────────────────────────────────────

// Re-exported for back-compat: several modules still import these from here.
export type { ApiSlot, SelectedSlot } from "@/components/week-grid/types";

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
  /** Increment to drop all cached slot data and re-fetch the current week. */
  refreshToken?: number;
}

/** Internal focused block: the pre-confirmed selection state. */
interface FocusedBlock {
  dateKey:    string;       // formatDateKey of the day
  block:      ApiSlot[];    // contiguous atoms
  anchorKey:  string;       // "HH:MM" of the cell the user clicked
  slot:       SelectedSlot;
}

// ─── Block-selection helpers (calendar-only) ────────────────────────────────────

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
  locale:          string,
): SelectedSlot {
  const first = block[0]!;
  const last  = block[block.length - 1]!;
  const firstLabel = tzDiffers ? first.localLabel : first.label;
  const lastLabel  = tzDiffers ? last.localLabel  : last.label;

  const startTime = firstLabel.split(/\s*[–\-]\s*/)[0]?.trim() ?? "";
  const endTime   = lastLabel.includes("–") || lastLabel.includes("-")
    ? (lastLabel.split(/\s*[–\-]\s*/)[1]?.trim() ?? "")
    : formatTime(new Date(last.end), locale as "es" | "en", { timeZone: userTz });

  return {
    startIso:  first.start,
    endIso:    last.end,
    label:     durationMinutes === 15 ? startTime : `${startTime}–${endTime}`,
    dateLabel: formatDateLabel(date, locale),
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
  refreshToken,
}: WeeklyCalendarProps) {
  const t      = useTranslations("booking.weeklyCalendar");
  const locale = useLocale();
  const schedule = useScheduleConfig();

  const atomicMinutes: 15 | 30 = durationMinutes === 15 ? 15 : 30;
  const cellsPerSlot            = durationMinutes === 15 ? 1 : durationMinutes === 60 ? 2 : 4;

  const { minHour, maxHour } = useMemo(
    () => gridHourRange(schedule.weeklyHours),
    [schedule.weeklyHours],
  );

  const [weekOffset,    setWeekOffset]    = useState(initialWeekOffset);
  const [focusedBlock,  setFocusedBlock]  = useState<FocusedBlock | null>(null);
  const [invalidKey,    setInvalidKey]    = useState<string | null>(null);
  const [isMobile,      setIsMobile]      = useState(false);
  // Client timezone after hydration; the schedule's timezone during SSR.
  const userTz = useClientValue(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return schedule.timezone; }
  }, schedule.timezone);
  const [nowMadridMin,  setNowMadridMin]  = useState<number>(() => getNowMinutes(schedule.timezone));
  const initialFocusedHandled             = useRef(false);

  const maxWeekOffset = schedule.bookingWindowWeeks - 1;
  const weekStart     = getWeekStart(weekOffset);
  const tzDiffers     = userTz !== schedule.timezone;

  // Per-day availability fetch (shared hook). resetKey = refreshToken so the
  // cache clears + refetches only when a booking is confirmed; navigating weeks
  // keeps other weeks cached (incremental skip-loaded).
  const { slotsMap } = useWeekAvailability({
    weekStart,
    atomicMinutes,
    userTz,
    weeklyHours:        schedule.weeklyHours,
    bookingWindowWeeks: schedule.bookingWindowWeeks,
    resetKey:           String(refreshToken),
  });

  // Clear the focused block when a refresh drops the cached slots (the focused
  // block may reference a slot that no longer exists). Render-phase adjust.
  const [prevRefreshToken, setPrevRefreshToken] = useState(refreshToken);
  if (refreshToken !== prevRefreshToken) {
    setPrevRefreshToken(refreshToken);
    setFocusedBlock(null);
  }

  const timeRows = useMemo(
    () => buildTimeRows(atomicMinutes, minHour * 60, maxHour * 60),
    [atomicMinutes, minHour, maxHour],
  );

  const days: Date[] = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Update current Madrid time every minute for the "now" line and past-cell logic
  useEffect(() => {
    const id = setInterval(() => setNowMadridMin(getNowMinutes(schedule.timezone)), 60_000);
    return () => clearInterval(id);
  }, [schedule.timezone]);

  // Navigate weeks and clear any focused block (with parent notification) in the
  // same event handler — avoids resetting state from an effect.
  const goToWeek = useCallback((delta: number) => {
    setWeekOffset((w) => w + delta);
    if (focusedBlock) onSlotFocused?.(null);
    setFocusedBlock(null);
  }, [focusedBlock, onSlotFocused]);

  // Clear focused block when the parent confirms the slot externally
  // (e.g. "Continuar" button calls onSlotSelected via focusedSlot).
  // Render-phase "adjust state on input change" keyed on the selected-slot prop.
  const [prevSelectedSlotStart, setPrevSelectedSlotStart] = useState(selectedSlot?.startIso);
  if (selectedSlot?.startIso !== prevSelectedSlotStart) {
    setPrevSelectedSlotStart(selectedSlot?.startIso);
    if (selectedSlot) setFocusedBlock(null);
  }

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
          const slot = blockToSelectedSlot(date, block, userTz, tzDiffers, durationMinutes, locale);
          // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronises focus to availability data that arrives asynchronously into slotsMap; runs once (guarded by initialFocusedHandled).
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

    const slot = blockToSelectedSlot(date, block, userTz, tzDiffers, durationMinutes, locale);
    setFocusedBlock({ dateKey: dayKey, block, anchorKey: timeKey, slot });
    onSlotFocused?.(slot);
  }, [slotsMap, tzDiffers, timeRows, cellsPerSlot, userTz, durationMinutes,
      focusedBlock, onSlotSelected, onSlotFocused]);

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + schedule.bookingWindowWeeks * 7);

  const ROW_H    = isMobile ? 28 : 34;
  const HEADER_H = isMobile ? 52 : 64;
  const HOUR_GAP = 0; // flush rows — hour boundaries are marked by a brighter line, not a gap

  // Current-time indicator line — only shown on the current week and within grid range
  const GRID_START_MIN = minHour * 60;
  const GRID_END_MIN   = maxHour * 60;  // last slot ends at maxHour:00
  const showTimeLine   = weekOffset === 0 && nowMadridMin >= GRID_START_MIN && nowMadridMin < GRID_END_MIN;
  const timeLineTop    = HEADER_H + ((nowMadridMin - GRID_START_MIN) / atomicMinutes) * ROW_H;

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
              {formatWeekHeading(weekStart, locale)}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#bbcabf" }}>
              {tzDiffers
                ? t("subtitle", { userTz })
                : t("selectHint")}
            </p>
          </div>

          {/* Nav buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => goToWeek(-1)}
              disabled={weekOffset === 0}
              aria-label={t("prevWeek")}
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
              <span className="text-xs font-semibold uppercase tracking-widest pr-1">{t("prev")}</span>
            </button>

            <button
              onClick={() => goToWeek(1)}
              disabled={weekOffset >= maxWeekOffset}
              aria-label={t("nextWeek")}
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
              <span className="text-xs font-semibold uppercase tracking-widest pl-1">{t("next")}</span>
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
              position:            "relative",
            }}
          >
            {/* ── Current-time indicator ── */}
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
            {/* ── Sticky time column ── */}
            <TimeColumn
              isMobile={isMobile}
              timeRows={timeRows}
              rowHeight={ROW_H}
              headerHeight={HEADER_H}
              paddingTop={4}
              sticky
            />

            {/* ── Day columns ── */}
            {days.map((date) => {
              const key       = formatDateKey(date);
              const dow       = date.getDay();
              const daySlots  = slotsMap[key];
              const isPast    = date < today;
              const isBeyond  = date > maxDate;
              const noSched   = (schedule.weeklyHours[dow] ?? []).length === 0;
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
                      {getDayName(date, locale, isMobile ? "short" : "long")}
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
                    const isHourBoundary = i > 0 && getTimeRowHierarchy(hhmm) === "hour";

                    if (isClosed) {
                      return (
                        <div key={hhmm} style={{
                          height:     ROW_H,
                          marginTop:  isHourBoundary ? HOUR_GAP : 0,
                          borderTop:  rowBorderTop(i, hhmm),
                          background: hourBandBackground(hhmm),
                        }} />
                      );
                    }

                    if (isLoading) {
                      return (
                        <div key={hhmm} style={{
                          height:         ROW_H,
                          marginTop:      isHourBoundary ? HOUR_GAP : 0,
                          borderTop:      rowBorderTop(i, hhmm),
                          background:     hourBandBackground(hhmm),
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

                    // For today: classify rows as past (empty) or within the notice window (unavailable)
                    const [rowH, rowM] = hhmm.split(":").map(Number);
                    const rowMin = (rowH ?? 0) * 60 + (rowM ?? 0);
                    const isPastRow   = isToday && rowMin + atomicMinutes <= nowMadridMin;
                    const isNoticeRow = isToday && !isPastRow && rowMin < nowMadridMin + schedule.minNoticeHours * 60;

                    // Three-state classification (notice rows always show as unavailable)
                    const inWorkingHours = isWithinWorkingHours(schedule.weeklyHours, date.getDay(), hhmm, atomicMinutes);
                    const cellState: "available" | "booked" | "unavailable" =
                      isNoticeRow ? "unavailable"
                      : slot      ? "available"
                      : inWorkingHours ? "booked"
                      : "unavailable";

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
                    const isFocusTop    = inFocus && hhmm === focusedFirstKey;
                    const isFocusBot    = inFocus && hhmm === focusedLastKey;

                    if (isPastRow) {
                      return (
                        <div key={hhmm} style={{
                          height:     ROW_H,
                          marginTop:  isHourBoundary ? HOUR_GAP : 0,
                          borderTop:  rowBorderTop(i, hhmm),
                          background: hourBandBackground(hhmm),
                        }} />
                      );
                    }

                    return (
                      <div key={hhmm} style={{
                        height:     ROW_H,
                        marginTop:  isHourBoundary ? HOUR_GAP : 0,
                        padding:    0,
                        borderTop:  rowBorderTop(i, hhmm),
                        background: hourBandBackground(hhmm),
                      }}>
                        <SlotCell
                          state={cellState}
                          availableLabel={t("availableAt", { timeLabel: hhmm })}
                          unavailableTitle="No disponible"
                          bookedTitle="Reservado"
                          inSel={inSel}
                          isSelTop={isSelTop}
                          isSelBot={isSelBot}
                          inFocus={inFocus}
                          isFocusTop={isFocusTop}
                          isFocusBot={isFocusBot}
                          isInvalid={isInvalid}
                          onClick={cellState === "available" ? () => handleCellClick(date, hhmm) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 8, padding: "10px 12px 14px 12px" }}>
          <LegendDot bg="rgba(78,222,163,0.18)" border="rgba(78,222,163,0.35)" label={t("available")} />
          <LegendDot bg="rgba(78,222,163,0.55)" border="rgba(78,222,163,0.8)"  label={t("selected")} />
          <LegendDot bg="rgba(255,180,171,0.07)" border="rgba(255,180,171,0.18)" label={t("booked")} />
          <LegendDot bg="repeating-linear-gradient(135deg,rgba(255,255,255,0.025) 0px,rgba(255,255,255,0.025) 1px,transparent 1px,transparent 6px)" border="rgba(255,255,255,0.04)" label={t("unavailable")} />
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
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
