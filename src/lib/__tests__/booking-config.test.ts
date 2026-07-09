// Pure-helper tests for the booking schedule. The slotsFromBlocks test is the
// regression guard that dropping the legacy "-15 morning buffer" is behaviour-
// preserving: a literal 09:00–13:30 block must produce the same 60-min slot
// starts as before (09:00, 10:00, 11:00, 12:00 — nothing ending past 13:30).
import { slotsFromBlocks, isWithinBlocks, gridHourRange } from "../booking-config";
import type { WeeklyHours } from "@/domain/types";

describe("slotsFromBlocks", () => {
  it("generates 60-min slot starts within a 09:00–13:30 morning block", () => {
    const starts = slotsFromBlocks([{ startMinute: 540, endMinute: 810 }], 60, 60);
    // 540=09:00, 600=10:00, 660=11:00, 720=12:00. 780 (13:00)+60=840 > 810 → excluded.
    expect(starts).toEqual([540, 600, 660, 720]);
    // No slot may end after 13:30 (810).
    for (const s of starts) expect(s + 60).toBeLessThanOrEqual(810);
  });

  it("includes half-hour starts when stepMinutes=30", () => {
    const starts = slotsFromBlocks([{ startMinute: 540, endMinute: 810 }], 60, 30);
    expect(starts).toEqual([540, 570, 600, 630, 660, 690, 720, 750]);
  });

  it("handles multiple (split-shift) blocks", () => {
    const starts = slotsFromBlocks(
      [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
      60,
      60,
    );
    expect(starts).toEqual([540, 600, 660, 720, 930, 990]);
  });

  it("returns nothing when the block is shorter than the duration", () => {
    expect(slotsFromBlocks([{ startMinute: 540, endMinute: 570 }], 60, 60)).toEqual([]);
  });
});

describe("isWithinBlocks", () => {
  const blocks = [{ startMinute: 540, endMinute: 810 }];

  it("is true for a slot fully inside a block", () => {
    expect(isWithinBlocks(blocks, 600, 60)).toBe(true);
  });

  it("is true exactly at the block boundaries", () => {
    expect(isWithinBlocks(blocks, 540, 60)).toBe(true);  // starts at open
    expect(isWithinBlocks(blocks, 750, 60)).toBe(true);  // 750+60=810 ends at close
  });

  it("is false when the slot would spill past the block end", () => {
    expect(isWithinBlocks(blocks, 780, 60)).toBe(false); // 780+60=840 > 810
  });

  it("is false for an empty (non-working) day", () => {
    expect(isWithinBlocks([], 600, 60)).toBe(false);
  });
});

describe("gridHourRange", () => {
  it("derives min/max hours from the seeded weekly hours", () => {
    const weekly: WeeklyHours = {
      0: [{ startMinute: 660, endMinute: 900 }],
      1: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
      2: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
      3: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
      4: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
      5: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
      6: [{ startMinute: 660, endMinute: 900 }],
    };
    // Earliest start 540 (09:00) → 9; latest end 1110 (18:30) → ceil 19.
    expect(gridHourRange(weekly)).toEqual({ minHour: 9, maxHour: 19 });
  });

  it("falls back to 09:00–19:00 when no blocks are configured", () => {
    const weekly: WeeklyHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    expect(gridHourRange(weekly)).toEqual({ minHour: 9, maxHour: 19 });
  });
});
