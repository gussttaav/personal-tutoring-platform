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

describe("getAvailableSlots — stepMinutes parameter", () => {
  it("generates only whole-hour starts by default (step equals duration)", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60);

    expect(slots.length).toBeGreaterThan(0);
    // Madrid offsets are always whole hours (+1 or +2), so UTC minutes
    // mirror Madrid minutes exactly.
    const allOnHour = slots.every(s => new Date(s.start).getUTCMinutes() === 0);
    expect(allOnHour).toBe(true);
  });

  it("includes half-hour starts when stepMinutes=30", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60, 30);

    expect(slots.length).toBeGreaterThan(0);
    const hasHalfHour = slots.some(s => new Date(s.start).getUTCMinutes() === 30);
    expect(hasHalfHour).toBe(true);
  });

  it("returns more slots with stepMinutes=30 than with default step", async () => {
    const [defaultSlots, halfHourSlots] = await Promise.all([
      getAvailableSlots(TEST_DATE, 60),
      getAvailableSlots(TEST_DATE, 60, 30),
    ]);

    expect(halfHourSlots.length).toBeGreaterThan(defaultSlots.length);
  });

  it("each slot end is exactly durationMinutes after its start regardless of step", async () => {
    const slots = await getAvailableSlots(TEST_DATE, 60, 30);

    for (const slot of slots) {
      const diffMs = new Date(slot.end).getTime() - new Date(slot.start).getTime();
      expect(diffMs).toBe(60 * 60_000);
    }
  });
});
