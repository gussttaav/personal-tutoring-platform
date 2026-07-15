/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * Pure date / format / grid helpers shared by WeeklyCalendar and
 * AvailabilityModal. These were duplicated (and had already diverged) across
 * both components. This is the superset implementation:
 *   - getTimeRowHierarchy keeps the 3-tier "quarter" classification (the modal's
 *     copy was 2-tier only; the modal produces no quarter rows today, so it reads
 *     "hour"/"half" exactly as before, and the shared version is correct if the
 *     modal ever switches to 15-min atoms).
 *   - the label-start extractor is unified under the name slotStartKey.
 *
 * No React, no i18n — presentation strings flow from the consumers.
 * Composes the pure booking-config layer (isWithinBlocks); do not reimplement it.
 */

import { isWithinBlocks } from "@/lib/booking-config";
import type { WeeklyHours } from "@/domain/types";
import type { ApiSlot } from "@/components/week-grid/types";

export function getDayName(date: Date, locale: string, format: "short" | "long"): string {
  return new Intl.DateTimeFormat(locale, { weekday: format }).format(date);
}

export function getWeekStart(offset = 0): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  return monday;
}

export function formatDateLabel(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatWeekHeading(weekStart: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(weekStart);
}

/** Returns the current wall-clock minutes (0–1439) in the schedule's timezone. */
export function getNowMinutes(tz: string): number {
  const str = new Date().toLocaleTimeString("es-ES", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h = "0", m = "0"] = str.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** Classify a time row into its visual hierarchy tier. */
export function getTimeRowHierarchy(hhmm: string): "hour" | "half" | "quarter" {
  const mins = hhmm.split(":")[1] ?? "00";
  if (mins === "00") return "hour";
  if (mins === "30") return "half";
  return "quarter";
}

/** Border style for a grid row based on its position and time hierarchy. */
export function rowBorderTop(i: number, hhmm: string): string | undefined {
  if (i === 0) return undefined;
  const h = getTimeRowHierarchy(hhmm);
  // Hour boundary is a structural 2px line, faintly tinted with the emerald
  // accent — a categorically different weight AND hue than the neutral
  // half/quarter hairlines, so the eye can lock onto it on two dimensions.
  if (h === "hour")  return "2px solid rgba(78,222,163,0.22)";
  if (h === "half")  return "1px solid rgba(255,255,255,0.05)";
  return                    "1px solid rgba(255,255,255,0.022)";
}

/**
 * Faint alternating background tint per whole hour, so the eye groups the rows
 * of a single hour pre-attentively (zebra banding). Odd hours get the tint;
 * even hours stay on the base background. Shows through the semi-transparent
 * slot cells, so it reads on every column, not just empty/closed rows.
 */
export function hourBandBackground(hhmm: string): string | undefined {
  const h = parseInt(hhmm.split(":")[0] ?? "0", 10);
  return h % 2 === 1 ? "rgba(255,255,255,0.015)" : undefined;
}

/** Build "HH:MM" time rows for the grid, bounded by the configured hours. */
export function buildTimeRows(atomicMins: number, startMin: number, endMin: number): string[] {
  const rows: string[] = [];
  for (let m = startMin; m + atomicMins <= endMin; m += atomicMins) {
    const h  = Math.floor(m / 60);
    const mm = m % 60;
    rows.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return rows;
}

/** Returns true if a time row falls within this day's scheduled working windows. */
export function isWithinWorkingHours(
  weekly: WeeklyHours,
  dow: number,
  hhmm: string,
  atomicMins: number,
): boolean {
  const [hStr, mStr] = hhmm.split(":");
  const totalMin     = parseInt(hStr!) * 60 + parseInt(mStr!);
  return isWithinBlocks(weekly[dow] ?? [], totalMin, atomicMins);
}

/** Map each slot's display-timezone start "HH:MM" → ApiSlot. */
export function buildTimeMap(slots: ApiSlot[], tzDiffers: boolean): Map<string, ApiSlot> {
  const map = new Map<string, ApiSlot>();
  for (const slot of slots) {
    const key = slotStartKey(slot, tzDiffers);
    if (key) map.set(key, slot);
  }
  return map;
}

/** Extract the display-timezone start "HH:MM" from a slot (e.g. "09:00–09:30" → "09:00"). */
export function slotStartKey(slot: ApiSlot, tzDiffers: boolean): string {
  const label = tzDiffers ? slot.localLabel : slot.label;
  return label.split(/\s*[–\-]\s*/)[0]?.trim() ?? "";
}
