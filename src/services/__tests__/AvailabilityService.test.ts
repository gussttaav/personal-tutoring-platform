// CHAT-AGENT-P1-01: the availability lookup with a fake schedule and a fake slot source.
// The cache module is mocked: getOrCompute runs `compute` straight through, so the
// tests see exactly which days reach the (Google) source.
import { AvailabilityService, MAX_FIND_DAYS } from "../AvailabilityService";
import { getOrCompute, resolveCacheKey } from "@/lib/availability-cache";
import type { ScheduleConfig, TimeSlot, WeeklyHours } from "@/domain/types";

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));
jest.mock("@/lib/availability-cache", () => ({
  cacheTTLSeconds: jest.fn(() => 300),
  resolveCacheKey: jest.fn(async (date: string, duration: number) => `avail:v0:${date}:${duration}`),
  getOrCompute:    jest.fn(async (_key: string, compute: () => Promise<unknown>) => compute()),
}));

const BLOCK = [{ startMinute: 9 * 60, endMinute: 13 * 60 }];
// Monday–Friday open, weekend closed.
const WEEKDAYS: WeeklyHours = { 0: [], 1: BLOCK, 2: BLOCK, 3: BLOCK, 4: BLOCK, 5: BLOCK, 6: [] };
const EVERY_DAY: WeeklyHours = { 0: BLOCK, 1: BLOCK, 2: BLOCK, 3: BLOCK, 4: BLOCK, 5: BLOCK, 6: BLOCK };

function config(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    weeklyHours: WEEKDAYS,
    timezone: "Europe/Madrid",
    minNoticeHours: 0,
    cancelMinNoticeHours: 2,
    joinOpenMinutesBefore: 15,
    tutorAbsentAlertMinutes: 5,
    bookingWindowWeeks: 52,
    ...overrides,
  };
}

function slot(date: string, hh: string): TimeSlot {
  return { start: `${date}T${hh}:00:00.000Z`, end: `${date}T${hh}:15:00.000Z`, label: `${hh}:00` };
}

/** YYYY-MM-DD of the next `dow` (0 = Sunday) at least `minDaysAhead` days from now. */
function nextDow(dow: number, minDaysAhead = 2): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function make(cfg = config(), slotsPerDay = 2) {
  const schedule = { getConfig: jest.fn().mockResolvedValue(cfg) };
  const source = jest.fn(async (date: string) =>
    ["09", "10", "11", "12"].slice(0, slotsPerDay).map(hh => slot(date, hh)));
  return { service: new AvailabilityService(schedule, source), schedule, source };
}

beforeEach(() => jest.clearAllMocks());

describe("AvailabilityService.getSlots", () => {
  it("a working day goes through the cache to the source", async () => {
    const { service, source, schedule } = make();
    const monday = nextDow(1);

    const slots = await service.getSlots(monday, 15);

    expect(slots).toEqual([slot(monday, "09"), slot(monday, "10")]);
    expect(schedule.getConfig).toHaveBeenCalledTimes(1);
    expect(resolveCacheKey).toHaveBeenCalledWith(monday, 15);
    expect(getOrCompute).toHaveBeenCalledWith(`avail:v0:${monday}:15`, expect.any(Function), 300);
    expect(source).toHaveBeenCalledWith(monday, 15, expect.objectContaining({ timezone: "Europe/Madrid" }));
  });

  it("returns the cached value without calling the source on a hit", async () => {
    const { service, source } = make();
    const cached = [slot("2099-01-01", "09")];
    (getOrCompute as jest.Mock).mockResolvedValueOnce({ slots: cached });

    expect(await service.getSlots(nextDow(1), 15)).toEqual(cached);
    expect(source).not.toHaveBeenCalled();
  });

  it.each([
    ["a past date", "2020-01-06"],
    ["a date beyond the booking window", "2099-01-05"],
    ["a day with no working blocks", nextDow(0)],
  ])("%s → [] without touching the cache or the source", async (_name, date) => {
    const { service, source } = make();

    expect(await service.getSlots(date, 15)).toEqual([]);
    expect(source).not.toHaveBeenCalled();
    expect(getOrCompute).not.toHaveBeenCalled();
  });

  it("propagates a source failure (the route answers 500)", async () => {
    const { service, source } = make();
    source.mockRejectedValueOnce(new Error("freebusy down"));

    await expect(service.getSlots(nextDow(1), 15)).rejects.toThrow("freebusy down");
  });
});

describe("AvailabilityService.lookup", () => {
  it("tells a closed date (null) from an open, fully booked one ([])", async () => {
    const { service, source } = make();
    source.mockResolvedValueOnce([]);

    expect(await service.lookup(nextDow(0), 15, config())).toBeNull();
    expect(await service.lookup(nextDow(1), 15, config())).toEqual([]);
  });
});

describe("AvailabilityService.findSlots", () => {
  it("walks the days in order, skipping closed ones, and stops at the limit", async () => {
    const { service, source, schedule } = make();
    const monday = nextDow(1);

    // 2 slots per working day; limit 5 → Mon, Tue, Wed, then stop.
    const slots = await service.findSlots({ fromDate: monday, days: 7, durationMinutes: 15, limit: 5 });

    expect(slots).toHaveLength(5);
    expect(source.mock.calls.map(c => c[0])).toHaveLength(3);
    expect(slots[0]).toEqual(slot(monday, "09"));
    expect(schedule.getConfig).toHaveBeenCalledTimes(1);
  });

  it("skips the weekend without querying it", async () => {
    const { service, source } = make();
    const friday = nextDow(5);

    await service.findSlots({ fromDate: friday, days: 4, durationMinutes: 15, limit: 40 });

    // Fri, Sat, Sun, Mon → only Fri and Mon reach the source.
    expect(source).toHaveBeenCalledTimes(2);
  });

  it("never walks more than 7 days, whatever the caller asks", async () => {
    const { service, source } = make(config({ weeklyHours: EVERY_DAY }));

    await service.findSlots({ fromDate: nextDow(1), days: 30, durationMinutes: 15, limit: 1000 });

    expect(source).toHaveBeenCalledTimes(MAX_FIND_DAYS);
  });

  it("walks across a month boundary", async () => {
    const { service, source } = make(config({ weeklyHours: EVERY_DAY }));

    // The last day of next month: always inside the 52-week window, ≥ 2 days ahead.
    const d = new Date();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 2); d.setUTCDate(0);
    const last = d.toISOString().slice(0, 10);
    await service.findSlots({ fromDate: last, days: 3, durationMinutes: 15, limit: 100 });

    const next = new Date(`${last}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    expect(source.mock.calls.map(c => c[0])).toEqual([
      last,
      next.toISOString().slice(0, 10),
      expect.stringMatching(/^\d{4}-\d{2}-02$/),
    ]);
  });

  it("returns [] for a non-positive limit or days, with no read at all", async () => {
    const { service, source, schedule } = make();

    expect(await service.findSlots({ fromDate: nextDow(1), days: 3, durationMinutes: 15, limit: 0 })).toEqual([]);
    expect(await service.findSlots({ fromDate: nextDow(1), days: 0, durationMinutes: 15, limit: 5 })).toEqual([]);
    expect(schedule.getConfig).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
  });
});
