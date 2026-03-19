/**
 * lib/booking-config.ts
 *
 * Booking schedule configuration.
 * Kept in a separate file from calendar.ts so client components
 * (SlotPicker, availability route) can import it without pulling
 * in googleapis and its Node.js built-ins (fs, net, child_process).
 */

export const SCHEDULE = {
  /** 0 = Sunday … 6 = Saturday */
  workingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  startHour: 9,
  endHour: 19,
  breaks: [{ start: 14, end: 15 }],
  bookingWindowWeeks: 8,
  minNoticeHours: 2,
  timezone: "Europe/Madrid",
} as const;
