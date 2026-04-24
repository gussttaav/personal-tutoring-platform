/**
 * lib/booking-config.ts
 *
 * Booking schedule configuration.
 * Kept separate from calendar.ts so client components can import it
 * without pulling in googleapis and Node.js built-ins.
 */

export interface DaySchedule {
  /** Morning block end hour (exclusive) */
  morningEnd: number;
  /** Afternoon block start hour (inclusive), or null if no afternoon */
  afternoonStart: number | null;
  /** Afternoon block end hour (exclusive), or null if no afternoon */
  afternoonEnd: number | null;
}

/**
 * Per-day schedule.
 * 0 = Sunday, 1 = Monday … 6 = Saturday
 *
 * Monday–Friday:    09:00–13:30
 * Mon & Wed:        +15:30–17:30
 * Tue, Thu, Fri:    +15:30–18:30
 * Saturday:         11:00–15:00
 * Sunday:           11:00–15:00
 */
export const DAY_SCHEDULES: Record<number, DaySchedule | null> = {
  0: { morningEnd: 15.25, afternoonStart: null, afternoonEnd: null  }, // Sun  11–15
  1: { morningEnd: 13.75, afternoonStart: 15.5, afternoonEnd: 17.5 }, // Mon  09–13:30 + 15:30–17:30
  2: { morningEnd: 13.75, afternoonStart: 15.5, afternoonEnd: 18.5 }, // Tue  09–13:30 + 15:30–18:30
  3: { morningEnd: 13.75, afternoonStart: 15.5, afternoonEnd: 17.5 }, // Wed  09–13:30 + 15:30–17:30
  4: { morningEnd: 13.75, afternoonStart: 15.5, afternoonEnd: 18.5 }, // Thu  09–13:30 + 15:30–18:30
  5: { morningEnd: 13.75, afternoonStart: 15.5, afternoonEnd: 18.5 }, // Fri  09–13:30 + 15:30–18:30
  6: { morningEnd: 15.25, afternoonStart: null, afternoonEnd: null  }, // Sat  11–15
};

/** Start hour for weekdays (Mon–Fri) */
const WEEKDAY_START = 9;
/** Start hour for weekend */
const WEEKEND_START = 11;

/** Returns the start hour for a given day-of-week (0=Sun…6=Sat) */
export function dayStartHour(dow: number): number {
  return (dow === 0 || dow === 6) ? WEEKEND_START : WEEKDAY_START;
}

export const SCHEDULE = {
  /** All days are working days — per-day schedule controls actual hours */
  workingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  bookingWindowWeeks: 8,
  /**
   * Minimum advance notice required before a session can be booked, in hours.
   * Applied identically to all session types (15 min, 1h, 2h, pack).
   * The backend (calendar.ts + /api/book) is the source of truth;
   * the frontend hides slots that fall within this window via the
   * availability API (which calls getAvailableSlots with this value).
   */
  minNoticeHours: 5,
  timezone: "Europe/Madrid",
} as const;
