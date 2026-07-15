"use client";

/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * Per-day availability fetch for the week grid, extracted from the near-identical
 * effects in WeeklyCalendar and AvailabilityModal. Fetches up to 7 days (one per
 * visible date), skipping past / beyond-window / non-working days, and stores
 * each day's state in a consolidated `Record<string, DaySlots>` keyed by
 * formatDateKey — the same shape both components already render from.
 *
 * Cancellation: adopts the modal's AbortController cleanup (one controller per
 * fetch, all aborted on unmount / dependency change), so both surfaces now abort
 * in-flight requests — the calendar gains this for free.
 *
 * Cache reset: `resetKey` drives clear-then-refetch. The two surfaces differ in
 * when they reset, so each passes its own key and the incremental skip-loaded
 * behavior is otherwise identical:
 *   - calendar: resetKey = String(refreshToken) → clears only when a booking is
 *     confirmed; navigating weeks keeps other weeks cached.
 *   - modal:    resetKey = `${weekOffset}|${userTz}` → clears on week/timezone
 *     change, matching its former render-phase reset.
 */

import { useEffect, useRef, useState } from "react";
import type { WeeklyHours } from "@/domain/types";
import type { DaySlots } from "@/components/week-grid/types";
import { formatDateKey } from "@/components/week-grid/helpers";

export interface UseWeekAvailabilityArgs {
  /** Monday (local midnight) of the visible week. */
  weekStart:          Date;
  /** Atom granularity passed to the API as `duration` (15 or 30). */
  atomicMinutes:      number;
  /** Display timezone for slot labels. */
  userTz:             string;
  weeklyHours:        WeeklyHours;
  bookingWindowWeeks: number;
  /** Change to clear the cache and refetch the current week. */
  resetKey:           string;
}

export interface UseWeekAvailabilityResult {
  slotsMap: Record<string, DaySlots>;
}

export function useWeekAvailability({
  weekStart,
  atomicMinutes,
  userTz,
  weeklyHours,
  bookingWindowWeeks,
  resetKey,
}: UseWeekAvailabilityArgs): UseWeekAvailabilityResult {
  const [slotsMap, setSlotsMap] = useState<Record<string, DaySlots>>({});
  const prevResetKey = useRef(resetKey);

  const weekStartMs = weekStart.getTime();

  useEffect(() => {
    const isReset = resetKey !== prevResetKey.current;
    prevResetKey.current = resetKey;
    if (isReset) setSlotsMap({});

    const days: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + bookingWindowWeeks * 7);

    const controllers: AbortController[] = [];

    days.forEach((date) => {
      const key = formatDateKey(date);
      // On a normal render skip already-loaded days; on a reset re-fetch all.
      if (!isReset && slotsMap[key]) return;

      const isPast   = date < today;
      const isBeyond = date > maxDate;
      const dow      = date.getDay();
      const noSched  = (weeklyHours[dow] ?? []).length === 0;

      if (isPast || isBeyond || noSched) return;

      setSlotsMap((prev) => ({ ...prev, [key]: "loading" }));

      const controller = new AbortController();
      controllers.push(controller);

      const tz = encodeURIComponent(userTz);
      fetch(`/api/availability?date=${key}&duration=${atomicMinutes}&tz=${tz}`, { signal: controller.signal })
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
    // slotsMap is read for the skip-loaded check but intentionally omitted from
    // deps — including it would re-run the effect on every fetch resolution.
  }, [weekStartMs, atomicMinutes, userTz, resetKey, bookingWindowWeeks, weeklyHours]); // eslint-disable-line react-hooks/exhaustive-deps

  return { slotsMap };
}
