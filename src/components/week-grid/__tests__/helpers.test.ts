// REFACTOR-R3-P3-01 — unit tests for the extracted week-grid pure helpers.
// These helpers were duplicated (and had diverged) across WeeklyCalendar and
// AvailabilityModal and were untested while duplicated. The getTimeRowHierarchy
// cases pin the 3-tier ("quarter") superset that fixes the modal's former
// 2-tier copy for 15-min grids.
import {
  formatDateKey,
  getTimeRowHierarchy,
  buildTimeRows,
  buildTimeMap,
  isWithinWorkingHours,
  slotStartKey,
} from "../helpers";
import type { ApiSlot } from "@/components/week-grid/types";
import type { WeeklyHours } from "@/domain/types";

const slot = (label: string, localLabel = label): ApiSlot => ({
  start: "2026-07-15T00:00:00.000Z",
  end:   "2026-07-15T00:30:00.000Z",
  label,
  localLabel,
});

describe("formatDateKey", () => {
  it("emits a local YYYY-MM-DD key (not UTC)", () => {
    // Local-time constructor: 2026-03-05 regardless of timezone.
    expect(formatDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });

  it("zero-pads month and day", () => {
    expect(formatDateKey(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("getTimeRowHierarchy", () => {
  it("classifies a 30-min grid as hour/half only", () => {
    expect(getTimeRowHierarchy("09:00")).toBe("hour");
    expect(getTimeRowHierarchy("09:30")).toBe("half");
  });

  it("classifies a 15-min grid across all three tiers (quarter superset)", () => {
    expect(getTimeRowHierarchy("10:00")).toBe("hour");
    expect(getTimeRowHierarchy("10:15")).toBe("quarter");
    expect(getTimeRowHierarchy("10:30")).toBe("half");
    expect(getTimeRowHierarchy("10:45")).toBe("quarter");
  });
});

describe("buildTimeRows", () => {
  it("builds 30-min rows and excludes a final row that would end past endMin", () => {
    // 09:00–11:00 → 09:00, 09:30, 10:00, 10:30 (11:00 start would end 11:30 > 11:00).
    expect(buildTimeRows(30, 540, 660)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("builds 15-min rows for the same window", () => {
    expect(buildTimeRows(15, 540, 600)).toEqual(["09:00", "09:15", "09:30", "09:45"]);
  });

  it("returns no rows when the window cannot fit a single atom", () => {
    expect(buildTimeRows(30, 540, 560)).toEqual([]);
  });
});

describe("buildTimeMap", () => {
  it("keys by the display start when tz matches (uses label)", () => {
    const map = buildTimeMap([slot("09:00–09:30", "18:00–18:30")], false);
    expect([...map.keys()]).toEqual(["09:00"]);
  });

  it("keys by the local start when tz differs (uses localLabel)", () => {
    const map = buildTimeMap([slot("09:00–09:30", "18:00–18:30")], true);
    expect([...map.keys()]).toEqual(["18:00"]);
  });

  it("handles a single-time (15-min) label with no range separator", () => {
    const map = buildTimeMap([slot("09:15")], false);
    expect([...map.keys()]).toEqual(["09:15"]);
  });
});

describe("slotStartKey", () => {
  it("extracts the start from a range label", () => {
    expect(slotStartKey(slot("09:00–09:30"), false)).toBe("09:00");
  });

  it("returns a single-time label unchanged", () => {
    expect(slotStartKey(slot("09:15"), false)).toBe("09:15");
  });

  it("reads localLabel when tz differs", () => {
    expect(slotStartKey(slot("09:00–09:30", "18:00–18:30"), true)).toBe("18:00");
  });
});

describe("isWithinWorkingHours", () => {
  // Monday (dow 1) 09:00–13:00 = minutes 540–780.
  const weekly: WeeklyHours = { 1: [{ startMinute: 540, endMinute: 780 }] };

  it("accepts a 30-min row fully inside the block", () => {
    expect(isWithinWorkingHours(weekly, 1, "09:00", 30)).toBe(true);
    expect(isWithinWorkingHours(weekly, 1, "12:30", 30)).toBe(true); // ends 13:00 (inclusive)
  });

  it("rejects a 30-min row whose end spills past the block", () => {
    // 12:45 start + 30 = 13:15 > 13:00 close.
    expect(isWithinWorkingHours(weekly, 1, "12:45", 30)).toBe(false);
    expect(isWithinWorkingHours(weekly, 1, "13:00", 30)).toBe(false);
  });

  it("rejects a row before the block opens", () => {
    expect(isWithinWorkingHours(weekly, 1, "08:30", 30)).toBe(false);
  });

  it("returns false for a day with no configured blocks", () => {
    expect(isWithinWorkingHours(weekly, 2, "10:00", 30)).toBe(false);
  });
});
