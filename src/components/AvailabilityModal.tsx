"use client";

/**
 * AvailabilityModal — availability preview
 *
 * Shows an 8-column time-grid calendar (time markers + 7 day columns) of
 * 30-minute slots fetched from /api/availability (no auth required). Visual
 * style mirrors WeeklyCalendar: per-row "HH:MM" markers with tiered
 * de-emphasis, emerald hour-boundary lines, zebra hour banding, and flush
 * (label-less) slot cells. On slot selection, immediately invokes
 * onSlotSelected and closes — the caller decides which booking surface to
 * open based on user state.
 *
 * Layout:
 *   - Mobile  (< 640px): bottom sheet, all 7 days visible, no horizontal scroll
 *   - Desktop (≥ 640px): centered dialog, up to 860px wide
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useClientValue } from "@/hooks/useClientValue";
import { gridHourRange, isWithinBlocks } from "@/lib/booking-config";
import { useScheduleConfig } from "@/components/booking/ScheduleProvider";
import type { WeeklyHours } from "@/domain/types";
import type { ApiSlot, SelectedSlot } from "@/components/WeeklyCalendar";

interface AvailabilityModalProps {
  onClose:        () => void;
  onSlotSelected: (slot: SelectedSlot) => void;
}

// ─── Internal types ────────────────────────────────────────────────────────────

type DaySlots = ApiSlot[] | "loading" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Day name helpers — use Intl.DateTimeFormat rather than hardcoded arrays.
function getDayName(date: Date, locale: string, format: "short" | "long"): string {
  return new Intl.DateTimeFormat(locale, { weekday: format }).format(date);
}

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

function formatDateLabel(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

function formatWeekHeading(weekStart: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(weekStart);
}

function buildSelectedSlot(date: Date, slot: ApiSlot, userTz: string, scheduleTz: string, locale: string): SelectedSlot {
  const tzDiffers = userTz !== scheduleTz;
  return {
    startIso:  slot.start,
    endIso:    slot.end,
    label:     tzDiffers ? slot.localLabel : slot.label,
    dateLabel: formatDateLabel(date, locale),
    timezone:  userTz,
  };
}

/** Returns the current wall-clock minutes (0–1439) in the schedule's timezone. */
function getNowMinutes(tz: string): number {
  const str = new Date().toLocaleTimeString("es-ES", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h = "0", m = "0"] = str.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** The atomic grid granularity — every row is a 30-minute slot. */
const ATOMIC_MIN = 30;

/** Classify a time row into its visual hierarchy tier. */
function getTimeRowHierarchy(hhmm: string): "hour" | "half" {
  const mins = hhmm.split(":")[1] ?? "00";
  return mins === "00" ? "hour" : "half";
}

/** Border style for a grid row based on its position and time hierarchy. */
function rowBorderTop(i: number, hhmm: string): string | undefined {
  if (i === 0) return undefined;
  // Hour boundary is a structural 2px line, faintly tinted with the emerald
  // accent — a categorically different weight AND hue than the neutral half
  // hairline, so the eye can lock onto it on two dimensions.
  if (getTimeRowHierarchy(hhmm) === "hour") return "2px solid rgba(78,222,163,0.22)";
  return "1px solid rgba(255,255,255,0.05)";
}

/**
 * Faint alternating background tint per whole hour, so the eye groups the two
 * rows of a single hour pre-attentively (zebra banding). Odd hours get the
 * tint; even hours stay on the base background. Shows through the
 * semi-transparent slot cells, so it reads on every column.
 */
function hourBandBackground(hhmm: string): string | undefined {
  const h = parseInt(hhmm.split(":")[0] ?? "0", 10);
  return h % 2 === 1 ? "rgba(255,255,255,0.015)" : undefined;
}

/** Build "HH:MM" time rows for the grid, bounded by the configured hours. */
function buildTimeRows(atomicMins: number, startMin: number, endMin: number): string[] {
  const rows: string[] = [];
  for (let m = startMin; m + atomicMins <= endMin; m += atomicMins) {
    const h  = Math.floor(m / 60);
    const mm = m % 60;
    rows.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
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

/** Returns true if a 30-minute row falls within this day's working windows. */
function isWithinWorkingHours(weekly: WeeklyHours, dow: number, hhmm: string, atomicMins: number): boolean {
  const [hStr, mStr] = hhmm.split(":");
  const totalMin     = parseInt(hStr!) * 60 + parseInt(mStr!);
  return isWithinBlocks(weekly[dow] ?? [], totalMin, atomicMins);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvailabilityModal({
  onClose,
  onSlotSelected,
}: AvailabilityModalProps) {
  const t      = useTranslations("booking.availabilityModal");
  const locale = useLocale();
  const schedule = useScheduleConfig();

  const { minHour, maxHour } = useMemo(
    () => gridHourRange(schedule.weeklyHours),
    [schedule.weeklyHours],
  );
  // "HH:MM" row markers for the grid, one per 30-minute slot.
  const timeRows = useMemo(
    () => buildTimeRows(ATOMIC_MIN, minHour * 60, maxHour * 60),
    [minHour, maxHour],
  );

  const [weekOffset,     setWeekOffset]     = useState(0);
  const [slotsMap,       setSlotsMap]       = useState<Record<string, DaySlots>>({});
  // Client timezone after hydration; the schedule's timezone during SSR (avoids a
  // hydration mismatch without setting state in a mount effect).
  const userTz = useClientValue(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return schedule.timezone; }
  }, schedule.timezone);
  const [isMobile,       setIsMobile]       = useState(false);
  const [nowMadridMin,   setNowMadridMin]   = useState<number>(() => getNowMinutes(schedule.timezone));

  const maxWeekOffset = schedule.bookingWindowWeeks - 1;
  const weekStart     = getWeekStart(weekOffset);
  const tzDiffers     = userTz !== schedule.timezone;

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
  // Clear the slot map whenever the week or timezone changes (render-phase
  // "adjust state on input change") so the fetch effect below repopulates fresh
  // and the displayed times stay consistent with WeeklyCalendar.
  const fetchKey = `${weekOffset}|${userTz}`;
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setSlotsMap({});
  }

  useEffect(() => {
    const ws = getWeekStart(weekOffset);
    const days: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return d;
    });

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + schedule.bookingWindowWeeks * 7);

    const controllers: AbortController[] = [];

    days.forEach((date) => {
      const key      = formatDateKey(date);
      const isPast   = date < today;
      const isBeyond = date > maxDate;
      const dow      = date.getDay();
      const noSched  = (schedule.weeklyHours[dow] ?? []).length === 0;

      if (isPast || isBeyond || noSched) return;

      setSlotsMap((prev) => ({ ...prev, [key]: "loading" }));

      const controller = new AbortController();
      controllers.push(controller);

      const tz = encodeURIComponent(userTz);
      fetch(`/api/availability?date=${key}&duration=${ATOMIC_MIN}&tz=${tz}`, { signal: controller.signal })
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
  }, [weekOffset, userTz, schedule.bookingWindowWeeks, schedule.weeklyHours]);

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const handleSlotClick = useCallback((date: Date, slot: ApiSlot) => {
    onSlotSelected(buildSelectedSlot(date, slot, userTz, schedule.timezone, locale));
    onClose();
  }, [userTz, schedule.timezone, onSlotSelected, onClose, locale]);

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + schedule.bookingWindowWeeks * 7);

  // ── Time indicator ───────────────────────────────────────────────────────
  // Rows are halved (20/24) vs. the old 1-hour grid (40/48) so twice as many
  // 30-minute rows keep the overall grid height unchanged.
  const ROW_H_VAL    = isMobile ? 20 : 24;
  const HEADER_H_VAL = isMobile ? 52 : 64;
  const GRID_START_MIN = minHour * 60;
  const GRID_END_MIN   = maxHour * 60;
  const showTimeLine   = weekOffset === 0 && nowMadridMin >= GRID_START_MIN && nowMadridMin < GRID_END_MIN;
  const timeLineTop    = HEADER_H_VAL + ((nowMadridMin - GRID_START_MIN) / ATOMIC_MIN) * ROW_H_VAL;

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
        aria-label={t("viewAvailability")}
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
                  {formatWeekHeading(weekStart, locale)}
                </p>
                <p style={{ fontSize: 11, color: "#86948a", margin: "2px 0 0" }}>
                  {tzDiffers
                    ? t("timezone", { userTz })
                    : t("scheduleIn", { timezone: schedule.timezone })}
                </p>
              </div>
            </div>

            {/* Right side controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                    aria-label={t("prevWeek")}
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
                    aria-label={t("nextWeek")}
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

              <button
                onClick={onClose}
                aria-label={t("close")}
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

                  <TimeColumn isMobile={isMobile} timeRows={timeRows} />

                  {days.map((date) => {
                    const key      = formatDateKey(date);
                    const dow      = date.getDay();
                    const daySlots = slotsMap[key];
                    const isPast   = date < today;
                    const isBeyond = date > maxDate;
                    const noSched  = (schedule.weeklyHours[dow] ?? []).length === 0;
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
                        locale={locale}
                        timeRows={timeRows}
                        weekly={schedule.weeklyHours}
                        minNoticeHours={schedule.minNoticeHours}
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
                    {t("available")}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
                    <span style={{
                      width: 18, height: 10, borderRadius: 3,
                      background: "rgba(255,180,171,0.07)",
                      border: "1px solid rgba(255,180,171,0.18)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {t("booked")}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
                    <span style={{
                      width: 18, height: 10, borderRadius: 3,
                      background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 6px)",
                      border: "1px solid rgba(255,255,255,0.04)",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {t("unavailable")}
                  </span>
                </div>
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

function TimeColumn({ isMobile, timeRows }: { isMobile: boolean; timeRows: string[] }) {
  const ROW_H    = isMobile ? 20 : 24;
  const HEADER_H = isMobile ? 52 : 64;
  return (
    <div style={{ background: "#111113" }}>
      {/* Header spacer — aligns with day header cells */}
      <div style={{
        height:       HEADER_H,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }} />
      {/* Time labels — "HH:MM" for every 30-minute row */}
      {timeRows.map((hhmm, i) => {
        const tier = getTimeRowHierarchy(hhmm);
        return (
          <div
            key={hhmm}
            style={{
              height:         ROW_H,
              display:        "flex",
              alignItems:     "flex-start",
              justifyContent: "flex-end",
              paddingRight:   8,
              paddingTop:     3,
              borderTop:      rowBorderTop(i, hhmm),
              background:     hourBandBackground(hhmm),
              position:       "relative",
            }}
          >
            {/* Hour tick — a brighter emerald stub at the gutter's inner edge
                that anchors the eye to the hour line beside its label. */}
            {i > 0 && tier === "hour" && (
              <div
                aria-hidden="true"
                style={{
                  position:   "absolute",
                  top:        -2,
                  right:      0,
                  width:      8,
                  height:     2,
                  background: "rgba(78,222,163,0.5)",
                }}
              />
            )}
            <span style={{
              fontSize:           isMobile
                ? (tier === "hour" ? 9 : 7.5)
                : (tier === "hour" ? 10 : 8.5),
              fontWeight:         tier === "hour" ? 600 : 400,
              color:              tier === "hour" ? "#c2d0c8" : "rgba(134,148,138,0.6)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace:         "nowrap",
            }}>
              {hhmm}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day column ────────────────────────────────────────────────────────────────

function DayColumn({
  date, daySlots, isMobile, isClosed, isToday, tzDiffers, nowMadridMin, onSlotClick, locale,
  timeRows, weekly, minNoticeHours,
}: {
  date:           Date;
  daySlots:       DaySlots | undefined;
  isMobile:       boolean;
  isClosed:       boolean;
  isToday:        boolean;
  tzDiffers:      boolean;
  locale:         string;
  nowMadridMin:   number;
  onSlotClick:    (slot: ApiSlot) => void;
  timeRows:       string[];
  weekly:         WeeklyHours;
  minNoticeHours: number;
}) {
  const ROW_H    = isMobile ? 20 : 24;
  const HEADER_H = isMobile ? 52 : 64;
  const dow      = date.getDay();
  const timeMap  = Array.isArray(daySlots) ? buildTimeMap(daySlots, tzDiffers) : null;
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
        const slot = timeMap?.get(hhmm) ?? null;

        if (isClosed) {
          return (
            <div key={hhmm} style={{
              height:     ROW_H,
              borderTop:  rowBorderTop(i, hhmm),
              background: hourBandBackground(hhmm),
            }} />
          );
        }

        if (isLoading) {
          return (
            <div key={hhmm} style={{
              height:         ROW_H,
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

        const [rowH, rowM] = hhmm.split(":").map(Number);
        const rowMin      = (rowH ?? 0) * 60 + (rowM ?? 0);
        const isPastRow   = isToday && rowMin + ATOMIC_MIN <= nowMadridMin;
        const isNoticeRow = isToday && !isPastRow && rowMin < nowMadridMin + minNoticeHours * 60;

        if (isPastRow) {
          return (
            <div key={hhmm} style={{
              height:     ROW_H,
              borderTop:  rowBorderTop(i, hhmm),
              background: hourBandBackground(hhmm),
            }} />
          );
        }

        const cellState: "available" | "booked" | "unavailable" =
          isNoticeRow                                          ? "unavailable"
          : slot                                               ? "available"
          : isWithinWorkingHours(weekly, dow, hhmm, ATOMIC_MIN) ? "booked"
          : "unavailable";

        return (
          <div
            key={hhmm}
            style={{
              height:     ROW_H,
              padding:    0,
              borderTop:  rowBorderTop(i, hhmm),
              background: hourBandBackground(hhmm),
            }}
          >
            <SlotCell
              state={cellState}
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
  onClick,
}: {
  state:    "available" | "booked" | "unavailable";
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (state === "unavailable") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 0,
        border: "1px solid rgba(255,255,255,0.04)",
        background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 6px)",
        cursor: "default",
      }} />
    );
  }

  if (state === "booked") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 0,
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
        width:        "100%",
        height:       "100%",
        cursor:       "pointer",
        border:       `1px solid ${hovered ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.3)"}`,
        background:   hovered ? "rgba(78,222,163,0.22)" : "rgba(78,222,163,0.13)",
        borderRadius: 0,
        transition:   "background 0.12s, border-color 0.12s",
        fontFamily:   "inherit",
        overflow:     "hidden",
      }}
      aria-label="Hora disponible"
    />
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
