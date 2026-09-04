// Tests for getAvailableSlots step-size behaviour.
// googleapis is mocked so no real calendar credentials are needed.

const mockFreebusyQuery = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    calendar: jest.fn().mockImplementation(() => ({
      freebusy: { query: mockFreebusyQuery },
    })),
  },
}));

import { getAvailableSlots } from "../CalendarClient";
import type { ScheduleConfig } from "@/domain/types";

// Returning an empty calendars map means busyBlocks = [] for any CALENDAR_ID value,
// so all generated slots are treated as free.
const emptyBusyResponse = { data: { calendars: {} } };

beforeEach(() => {
  jest.clearAllMocks();
  mockFreebusyQuery.mockResolvedValue(emptyBusyResponse);
});

// Use a far-future date so all slots pass the minBookingTime guard.
// 2099-12-01 is a weekday (checked at test-write time); the schedule has
// both a morning and afternoon window for any weekday.
const TEST_DATE = "2099-12-01";

// Config mirrors the seeded schedule: weekday morning 09:00–13:30 + afternoon.
const TEST_CONFIG: ScheduleConfig = {
  weeklyHours: {
    0: [{ startMinute: 660, endMinute: 900 }],
    1: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
    2: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    3: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
    4: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    5: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    6: [{ startMinute: 660, endMinute: 900 }],
  },
  timezone: "Europe/Madrid",
  minNoticeHours: 5,
  cancelMinNoticeHours: 2,
  bookingWindowWeeks: 8,
};

describe("getAvailableSlots — stepMinutes parameter", () => {
  it("consecutive slot starts are at least durationMinutes apart by default (step equals duration)", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60, TEST_CONFIG);

    expect(slots.length).toBeGreaterThan(0);
    // When step == duration, no two consecutive slot starts can be closer
    // than 60 min apart — there are no intermediate half-hour subdivisions.
    // (The afternoon window starts at 15:30, so some slots begin on the half-hour,
    // but that is the window origin, not an intermediate step.)
    const starts = slots
      .map(s => new Date(s.start).getTime())
      .sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      const diffMin = (starts[i]! - starts[i - 1]!) / 60_000;
      expect(diffMin).toBeGreaterThanOrEqual(60);
    }
  });

  it("includes half-hour starts when stepMinutes=30", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60, TEST_CONFIG, 30);

    expect(slots.length).toBeGreaterThan(0);
    const hasHalfHour = slots.some(s => new Date(s.start).getUTCMinutes() === 30);
    expect(hasHalfHour).toBe(true);
  });

  it("returns more slots with stepMinutes=30 than with default step", async () => {
    const [defaultSlots, halfHourSlots] = await Promise.all([
      getAvailableSlots(TEST_DATE, 60, TEST_CONFIG),
      getAvailableSlots(TEST_DATE, 60, TEST_CONFIG, 30),
    ]);

    expect(halfHourSlots.length).toBeGreaterThan(defaultSlots.length);
  });

  it("each slot end is exactly durationMinutes after its start regardless of step", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60, TEST_CONFIG, 30);

    for (const slot of slots) {
      const diffMs = new Date(slot.end).getTime() - new Date(slot.start).getTime();
      expect(diffMs).toBe(60 * 60_000);
    }
  });
});
