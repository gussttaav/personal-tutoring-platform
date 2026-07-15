/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * Types shared by WeeklyCalendar and AvailabilityModal (and the
 * useWeekAvailability hook). Previously these lived in WeeklyCalendar.tsx and
 * were re-imported by the modal; they now live here as the single source, and
 * WeeklyCalendar re-exports them for back-compat with existing import sites.
 */

/** A bookable atom as returned by GET /api/availability (TimeSlot + localLabel). */
export interface ApiSlot {
  start:      string;
  end:        string;
  label:      string;
  localLabel: string;
}

/** A confirmed/selected slot passed up to the booking surfaces. */
export interface SelectedSlot {
  startIso:  string;
  endIso:    string;
  label:     string;
  dateLabel: string;
  note?:     string;
  timezone?: string;
}

/** Per-day availability state: the loaded slots, or a loading/error sentinel. */
export type DaySlots = ApiSlot[] | "loading" | "error";
