// CHAT-AGENT-P3-02 — filterSlotsByBusy: a slot chip survives when it overlaps no busy interval
// of the visitor's calendar. Touching edges don't overlap.
import { filterSlotsByBusy } from "@/lib/slot-overlap";

/** A 15-minute free-call slot starting at `hhmm` on Tuesday 10 Nov 2026 (UTC). */
const slot = (hhmm: string) => {
  const start = new Date(`2026-11-10T${hhmm}:00.000Z`);
  return { startIso: start.toISOString(), endIso: new Date(start.getTime() + 15 * 60_000).toISOString() };
};
const times = (slots: { startIso: string }[]) => slots.map((s) => s.startIso.slice(11, 16));

const ROW = ["09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15"].map(slot);

describe("filterSlotsByBusy", () => {
  it("hides the four slots inside a 10:00–11:00 meeting and keeps the rest", () => {
    const busy = [{ start: "2026-11-10T10:00:00Z", end: "2026-11-10T11:00:00Z" }];
    expect(times(filterSlotsByBusy(ROW, busy))).toEqual(["09:30", "09:45", "11:00", "11:15"]);
  });

  it("keeps a slot that ends exactly when the meeting starts, or starts when it ends", () => {
    const busy = [{ start: "2026-11-10T10:00:00Z", end: "2026-11-10T10:15:00Z" }];
    expect(times(filterSlotsByBusy([slot("09:45"), slot("10:15")], busy))).toEqual(["09:45", "10:15"]);
  });

  it("hides a slot that a meeting only partly covers", () => {
    const busy = [{ start: "2026-11-10T10:05:00Z", end: "2026-11-10T10:20:00Z" }];
    expect(times(filterSlotsByBusy(ROW, busy))).not.toContain("10:00");
    expect(times(filterSlotsByBusy(ROW, busy))).not.toContain("10:15");
    expect(times(filterSlotsByBusy(ROW, busy))).toContain("10:30");
  });

  it("hides a slot inside a busy block longer than it", () => {
    const busy = [{ start: "2026-11-10T09:00:00Z", end: "2026-11-10T12:00:00Z" }];
    expect(filterSlotsByBusy(ROW, busy)).toEqual([]);
  });

  it("an all-day busy event (midnight to midnight, with an offset) hides that whole day only", () => {
    const busy = [{ start: "2026-11-10T00:00:00+01:00", end: "2026-11-11T00:00:00+01:00" }];
    const nextDay = { startIso: "2026-11-11T09:00:00.000Z", endIso: "2026-11-11T09:15:00.000Z" };
    expect(filterSlotsByBusy([...ROW, nextDay], busy)).toEqual([nextDay]);
  });

  it("handles overlapping and unsorted busy blocks", () => {
    const busy = [
      { start: "2026-11-10T11:00:00Z", end: "2026-11-10T11:10:00Z" },
      { start: "2026-11-10T09:40:00Z", end: "2026-11-10T10:10:00Z" },
      { start: "2026-11-10T10:00:00Z", end: "2026-11-10T10:20:00Z" },
    ];
    expect(times(filterSlotsByBusy(ROW, busy))).toEqual(["10:30", "10:45", "11:15"]); // 09:30–09:45 overlaps the 09:40 block
  });

  it("keeps every slot when the calendar is free, and returns nothing for no slots", () => {
    expect(filterSlotsByBusy(ROW, [])).toEqual(ROW);
    expect(filterSlotsByBusy([], [{ start: "2026-11-10T10:00:00Z", end: "2026-11-10T11:00:00Z" }])).toEqual([]);
  });

  it("ignores a busy interval that doesn't parse or is empty, instead of hiding everything", () => {
    const busy = [
      { start: "not a date", end: "2026-11-10T11:00:00Z" },
      { start: "2026-11-10T10:00:00Z", end: "2026-11-10T10:00:00Z" },
    ];
    expect(filterSlotsByBusy(ROW, busy)).toEqual(ROW);
  });

  it("compares instants, not strings (offset vs Z)", () => {
    const busy = [{ start: "2026-11-10T11:00:00+01:00", end: "2026-11-10T11:15:00+01:00" }]; // 10:00Z
    expect(times(filterSlotsByBusy(ROW, busy))).not.toContain("10:00");
    expect(times(filterSlotsByBusy(ROW, busy))).toContain("11:00");
  });
});
