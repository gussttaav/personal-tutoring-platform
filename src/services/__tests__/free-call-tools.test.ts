// CHAT-AGENT-P1-03: the chat assistant's free-call tools, with a fake availability
// service (slots generated on the tutor's clock, Europe/Madrid), a fake booking service
// and a fake schedule. What is pinned: the visitor's days and parts of day are read in
// THEIR timezone (across the 2026 DST changes, when Madrid and New York drift by an
// hour), at most 8 slots spread over the days, the free-call cap, and that a proposal
// only comes out of a slot that passes checkSlot AND is still free on the calendar.
// `near_time` keeps the slots closest to a requested time, so a free exact time is
// never thinned out of the answer.
import { ZodError } from "zod";
import { fromZonedTime } from "date-fns-tz";
import {
  createFreeCallTools, thinSlots, nearestSlots, MAX_OFFERED_SLOTS, type FreeCallToolDeps,
} from "../chat-tools/free-call-tools";
import { InvalidSlotError, SlotUnavailableError } from "@/domain/errors";
import type { ChatTool, ToolContext } from "@/infrastructure/anthropic";
import type { TimeSlot } from "@/domain/types";

const TUTOR_TZ = "Europe/Madrid";
// Before both DST changes: Europe leaves summer time on 2026-10-25, the US on 2026-11-01.
const NOW = new Date("2026-10-20T08:00:00Z");

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A 15-minute slot starting at `hhmm` on `date`, on the tutor's clock. */
function tutorSlot(date: string, hhmm: string): TimeSlot {
  const start = fromZonedTime(`${date}T${hhmm}:00`, TUTOR_TZ);
  return {
    start: start.toISOString(),
    end:   new Date(start.getTime() + 15 * 60_000).toISOString(),
    label: hhmm,
  };
}

/** Every 15 minutes from `from` (inclusive) to `to` (exclusive), "HH:MM" on the tutor's clock. */
function times(from: string, to: string): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let m = toMin(from); m < toMin(to); m += 15) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

function make(dayTimes: string[] = ["10:00", "17:00"]) {
  const daySlots = (date: string) => dayTimes.map((t) => tutorSlot(date, t));
  const availability = {
    findSlots: jest.fn(async (o: { fromDate: string; days: number; limit: number }) =>
      Array.from({ length: o.days }, (_, i) => daySlots(addDays(o.fromDate, i))).flat().slice(0, o.limit)),
    getSlots: jest.fn(async (date: string) => daySlots(date)),
  };
  const booking = {
    checkSlot:            jest.fn(async () => null as InvalidSlotError | SlotUnavailableError | null),
    hasActiveFreeSession: jest.fn(async () => false),
  };
  const schedule = { getConfig: jest.fn(async () => ({ timezone: TUTOR_TZ })) };
  const deps = { availability, booking, schedule } as unknown as FreeCallToolDeps;
  const [find, propose] = createFreeCallTools(deps);
  return { find, propose, availability, booking, schedule };
}

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return { userId: null, email: null, timezone: TUTOR_TZ, locale: "es", now: NOW, ...overrides };
}

type FindResult = {
  timezone: string;
  slots: { start_iso: string; local_label: string }[];
  more_available?: boolean;
  next_hint?: string;
};

async function run(tool: ChatTool, input: unknown, c = ctx()) {
  return tool.run(input, c);
}

beforeEach(() => jest.clearAllMocks());

// ─── find_free_call_slots ─────────────────────────────────────────────────────

describe("find_free_call_slots", () => {
  it("is declared with a strict-compatible schema (no numeric bounds, closed object)", () => {
    const { find } = make();
    expect(find.name).toBe("find_free_call_slots");
    expect(find.inputSchema).toMatchObject({ additionalProperties: false, required: ["from_date"] });
    expect(JSON.stringify(find.inputSchema)).not.toMatch(/minimum|maximum/);
  });

  it("returns the slots with labels in the visitor's timezone and a `slots` action", async () => {
    const { find, availability } = make();

    const { result, action } = await run(find, { from_date: "2026-10-28", days: 1 });

    expect(availability.findSlots).toHaveBeenCalledWith({
      fromDate: "2026-10-28", days: 1, durationMinutes: 15, limit: 96,
    });
    const r = result as FindResult;
    expect(r.timezone).toBe(TUTOR_TZ);
    expect(r.slots).toEqual([
      { start_iso: "2026-10-28T09:00:00.000Z", local_label: "mié 28 oct · 10:00" },
      { start_iso: "2026-10-28T16:00:00.000Z", local_label: "mié 28 oct · 17:00" },
    ]);
    expect(r.more_available).toBe(false);
    expect(action).toEqual({
      type: "slots",
      durationMinutes: 15,
      slots: [
        { startIso: "2026-10-28T09:00:00.000Z", endIso: "2026-10-28T09:15:00.000Z" },
        { startIso: "2026-10-28T16:00:00.000Z", endIso: "2026-10-28T16:15:00.000Z" },
      ],
    });
  });

  it("labels in English for an English visitor", async () => {
    const { find } = make(["10:00"]);
    const { result } = await run(find, { from_date: "2026-10-28", days: 1 }, ctx({ locale: "en" }));
    expect((result as FindResult).slots[0].local_label).toBe("Wed 28 Oct · 10:00");
  });

  it("a signed-in visitor who already holds the free call gets `already_booked`, no slots", async () => {
    const { find, availability, booking } = make();
    booking.hasActiveFreeSession.mockResolvedValue(true);

    const out = await run(find, { from_date: "2026-10-28" }, ctx({ email: "a@b.c", userId: "u1" }));

    expect(out).toEqual({ result: { already_booked: true } });
    expect(booking.hasActiveFreeSession).toHaveBeenCalledWith("a@b.c");
    expect(availability.findSlots).not.toHaveBeenCalled();
  });

  it("an anonymous visitor skips the free-call check (/api/book enforces it after sign-in)", async () => {
    const { find, booking } = make();
    await run(find, { from_date: "2026-10-28" });
    expect(booking.hasActiveFreeSession).not.toHaveBeenCalled();
  });

  it("clamps a past from_date to today and defaults to 3 days", async () => {
    const { find, availability } = make();
    await run(find, { from_date: "2026-10-01" });
    expect(availability.findSlots).toHaveBeenCalledWith(expect.objectContaining({ fromDate: "2026-10-20", days: 3 }));
  });

  it.each([[0, 1], [-4, 1], [5, 5], [30, 7]])("clamps days=%p to %p", async (days, expected) => {
    const { find, availability } = make();
    await run(find, { from_date: "2026-10-28", days });
    expect(availability.findSlots).toHaveBeenCalledWith(expect.objectContaining({ days: expected }));
  });

  it("rejects an input that is not a date (the loop turns it into INVALID_INPUT)", async () => {
    const { find } = make();
    await expect(run(find, { from_date: "mañana" })).rejects.toBeInstanceOf(ZodError);
  });

  it("an empty range answers `slots: []` with a hint and no action", async () => {
    const { find } = make([]);
    const { result, action } = await run(find, { from_date: "2026-10-28" });
    expect(result).toEqual({ timezone: TUTOR_TZ, slots: [], next_hint: expect.any(String) });
    expect(action).toBeUndefined();
  });

  describe("a visitor in another timezone", () => {
    const NY = ctx({ timezone: "America/New_York" });

    it("reads the tutor's days that cover the visitor's day, and only keeps the visitor's day", async () => {
      // 01:00 in Madrid is the previous evening in New York.
      const { find, availability } = make(["01:00"]);

      const { result } = await run(find, { from_date: "2026-10-28", days: 1 }, NY);

      expect(availability.findSlots).toHaveBeenCalledWith(expect.objectContaining({ fromDate: "2026-10-28", days: 2 }));
      // Madrid 10-28 01:00 is NY 10-27 (dropped); Madrid 10-29 01:00 is NY 10-28 20:00 (kept).
      expect((result as FindResult).slots).toEqual([
        { start_iso: "2026-10-29T00:00:00.000Z", local_label: "mié 28 oct · 20:00" },
      ]);
    });

    it("never asks for more tutor days than findSlots walks", async () => {
      const { find, availability } = make();
      await run(find, { from_date: "2026-10-28", days: 7 }, NY);
      expect(availability.findSlots).toHaveBeenCalledWith(expect.objectContaining({ days: 7 }));
    });

    // Between 2026-10-25 and 2026-11-01 Madrid is UTC+1 and New York still UTC-4
    // (5 h apart); from 2026-11-01 New York is UTC-5 (6 h apart).
    it("filters part_of_day on the visitor's clock while only Europe has left summer time", async () => {
      const { find } = make(["16:45", "17:00", "18:00"]);

      const { result } = await run(find, { from_date: "2026-10-28", days: 1, part_of_day: "afternoon" }, NY);

      expect((result as FindResult).slots.map((s) => s.local_label)).toEqual([
        "mié 28 oct · 12:00", // Madrid 17:00
        "mié 28 oct · 13:00", // Madrid 18:00 (16:45 is 11:45 in NY: morning)
      ]);
    });

    it("filters part_of_day on the visitor's clock once both have left summer time", async () => {
      const { find } = make(["16:45", "17:00", "18:00"]);

      const afternoon = await run(find, { from_date: "2026-11-04", days: 1, part_of_day: "afternoon" }, NY);
      const morning   = await run(find, { from_date: "2026-11-04", days: 1, part_of_day: "morning" }, NY);

      expect((afternoon.result as FindResult).slots.map((s) => s.local_label)).toEqual(["mié 4 nov · 12:00"]);
      expect((morning.result as FindResult).slots.map((s) => s.local_label)).toEqual([
        "mié 4 nov · 10:45", "mié 4 nov · 11:00",
      ]);
    });

    it("evening starts at 18:00 on the visitor's clock", async () => {
      // Madrid 23:45 is NY 17:45 (afternoon); Madrid 00:00 the next day is NY 18:00 (evening).
      const { find } = make(["00:00", "23:45"]);

      const evening   = await run(find, { from_date: "2026-11-04", days: 1, part_of_day: "evening" }, NY);
      const afternoon = await run(find, { from_date: "2026-11-04", days: 1, part_of_day: "afternoon" }, NY);

      expect((evening.result as FindResult).slots.map((s) => s.local_label)).toEqual(["mié 4 nov · 18:00"]);
      expect((afternoon.result as FindResult).slots.map((s) => s.local_label)).toEqual(["mié 4 nov · 17:45"]);
    });
  });

  it("thins a busy range to 8 slots spread over the days, chronological", async () => {
    const { find } = make(times("09:00", "12:00")); // 12 slots a day

    const { result, action } = await run(find, { from_date: "2026-10-28", days: 3 });

    const r = result as FindResult;
    expect(r.slots).toHaveLength(MAX_OFFERED_SLOTS);
    expect(r.more_available).toBe(true);
    const perDay = (day: string) => r.slots.filter((s) => s.local_label.includes(day)).map((s) => s.local_label.slice(-5));
    expect(perDay("28 oct")).toEqual(["09:00", "10:30", "11:45"]);
    expect(perDay("29 oct")).toEqual(["09:00", "10:30", "11:45"]);
    expect(perDay("30 oct")).toEqual(["09:00", "11:45"]);
    const starts = r.slots.map((s) => s.start_iso);
    expect([...starts].sort()).toEqual(starts);
    expect(action?.type === "slots" && action.slots.map((s) => s.startIso)).toEqual(starts);
  });
});

describe("near_time", () => {
  it("keeps a free requested time that the even spread would drop", async () => {
    const { find } = make(times("09:00", "12:00"));

    const spread = await run(find, { from_date: "2026-10-28", days: 1 });
    const near   = await run(find, { from_date: "2026-10-28", days: 1, near_time: "10:00" });

    const labels = (r: unknown) => (r as FindResult).slots.map((s) => s.local_label.slice(-5));
    expect(labels(spread.result)).not.toContain("10:00");
    expect(labels(near.result)).toEqual(
      // 09:00 and 11:00 are both an hour away: the tie goes to the earlier one.
      ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45"],
    );
    expect((near.result as FindResult).more_available).toBe(true);
  });

  it("reads the time on the visitor's clock", async () => {
    const { find } = make(["15:00", "16:00", "17:00"]); // Madrid; NY 10:00, 11:00, 12:00 on 2026-10-28
    const { result } = await run(
      find, { from_date: "2026-10-28", days: 1, near_time: "11:00" }, ctx({ timezone: "America/New_York" }),
    );
    expect((result as FindResult).slots[1].local_label).toBe("mié 28 oct · 11:00");
  });

  it("rejects a time that is not HH:MM", async () => {
    const { find } = make();
    await expect(run(find, { from_date: "2026-10-28", near_time: "10am" })).rejects.toBeInstanceOf(ZodError);
  });

  it("nearestSlots: the closest across days, ties to the earlier slot, chronological", () => {
    const slots = [
      ...["09:00", "10:00", "12:00"].map((t) => tutorSlot("2026-10-28", t)),
      ...["10:00", "11:00"].map((t) => tutorSlot("2026-10-29", t)),
    ];
    expect(nearestSlots(slots, TUTOR_TZ, "10:00", 3).map((s) => s.start)).toEqual([
      tutorSlot("2026-10-28", "09:00").start, // 60 min away, earlier than 10-29 11:00
      tutorSlot("2026-10-28", "10:00").start,
      tutorSlot("2026-10-29", "10:00").start,
    ]);
  });
});

describe("thinSlots", () => {
  it("returns the slots unchanged when there are 8 or fewer", () => {
    const few = times("09:00", "11:00").map((t) => tutorSlot("2026-10-28", t));
    expect(thinSlots(few, TUTOR_TZ)).toBe(few);
  });

  it("gives one day all 8 when it is the only day", () => {
    const one = times("09:00", "19:00").map((t) => tutorSlot("2026-10-28", t)); // 40 slots
    const thinned = thinSlots(one, TUTOR_TZ);
    expect(thinned).toHaveLength(8);
    expect(thinned[0]).toBe(one[0]);
    expect(thinned[7]).toBe(one[39]);
    expect(new Set(thinned).size).toBe(8);
  });

  it("a short day hands its unused share to the others", () => {
    const slots = [
      tutorSlot("2026-10-28", "09:00"),
      ...times("09:00", "12:00").map((t) => tutorSlot("2026-10-29", t)),
    ];
    const thinned = thinSlots(slots, TUTOR_TZ);
    expect(thinned).toHaveLength(8);
    expect(thinned.filter((s) => s.start.startsWith("2026-10-28"))).toHaveLength(1);
  });
});

// ─── propose_free_call ────────────────────────────────────────────────────────

describe("propose_free_call", () => {
  const START = "2026-10-28T16:00:00.000Z"; // Madrid 17:00, a slot of the fake

  it("a free, valid slot becomes a `proposal` action", async () => {
    const { propose, booking, availability } = make();

    const out = await run(propose, { start_iso: START });

    expect(booking.checkSlot).toHaveBeenCalledWith({
      startIso: START, endIso: "2026-10-28T16:15:00.000Z", sessionType: "free15min",
    });
    expect(availability.getSlots).toHaveBeenCalledWith("2026-10-28", 15);
    expect(out).toEqual({
      result: { ok: true, local_label: "mié 28 oct · 17:00" },
      action: { type: "proposal", sessionType: "free15min", startIso: START, endIso: "2026-10-28T16:15:00.000Z" },
    });
  });

  it("accepts the same instant written with another offset, and normalises it", async () => {
    const { propose } = make();
    const out = await run(propose, { start_iso: "2026-10-28T12:00:00-04:00" }, ctx({ timezone: "America/New_York" }));
    expect(out.action).toEqual(expect.objectContaining({ startIso: START }));
    expect(out.result).toEqual({ ok: true, local_label: "mié 28 oct · 12:00" });
  });

  it.each([
    ["no offset", "2026-10-28T17:00:00"],
    ["not a date", "el jueves a las 5"],
  ])("rejects a start with %s as INVALID_SLOT without checking anything", async (_, start_iso) => {
    const { propose, booking } = make();
    expect(await run(propose, { start_iso })).toEqual({ result: { ok: false, reason: "INVALID_SLOT" } });
    expect(booking.checkSlot).not.toHaveBeenCalled();
  });

  it.each([
    ["off the grid or the wrong length", new InvalidSlotError(), "INVALID_SLOT"],
    ["outside hours, within min-notice or beyond the window", new SlotUnavailableError(), "SLOT_UNAVAILABLE"],
  ])("a slot checkSlot refuses (%s) is %s and never reaches the calendar", async (_, err, reason) => {
    const { propose, booking, availability } = make();
    booking.checkSlot.mockResolvedValue(err);

    expect(await run(propose, { start_iso: START })).toEqual({ result: { ok: false, reason } });
    expect(availability.getSlots).not.toHaveBeenCalled();
  });

  it("a signed-in visitor who already holds the free call gets FREE_SESSION_ALREADY_USED", async () => {
    const { propose, booking } = make();
    booking.hasActiveFreeSession.mockResolvedValue(true);

    const out = await run(propose, { start_iso: START }, ctx({ email: "a@b.c", userId: "u1" }));

    expect(out).toEqual({ result: { ok: false, reason: "FREE_SESSION_ALREADY_USED" } });
    expect(out.action).toBeUndefined();
  });

  it("a slot taken on the calendar is SLOT_UNAVAILABLE", async () => {
    const { propose } = make(["10:00"]); // 17:00 is busy
    expect(await run(propose, { start_iso: START })).toEqual({ result: { ok: false, reason: "SLOT_UNAVAILABLE" } });
  });

  it("looks the slot up on the TUTOR's calendar day, not the visitor's", async () => {
    // NY 2026-11-04 18:30 = 23:30Z = Madrid 2026-11-05 00:30.
    const { propose, availability } = make(["00:30"]);

    const out = await run(propose, { start_iso: "2026-11-04T18:30:00-05:00" }, ctx({ timezone: "America/New_York" }));

    expect(availability.getSlots).toHaveBeenCalledWith("2026-11-05", 15);
    expect(out.result).toEqual({ ok: true, local_label: "mié 4 nov · 18:30" });
  });
});

// ─── No side effects ──────────────────────────────────────────────────────────

describe("the toolset", () => {
  it("only ever reads: no dependency method beyond the five lookups is touched", async () => {
    const touched = new Set<string>();
    const spy = <T extends object>(target: T): T =>
      new Proxy(target, { get: (t, k) => { touched.add(String(k)); return Reflect.get(t, k); } });
    const { availability, booking, schedule } = make();
    const [find, propose] = createFreeCallTools({
      availability: spy(availability), booking: spy(booking), schedule: spy(schedule),
    } as unknown as FreeCallToolDeps);
    const signedIn = ctx({ email: "a@b.c", userId: "u1" });

    await find.run({ from_date: "2026-10-28", part_of_day: "morning" }, signedIn);
    await propose.run({ start_iso: "2026-10-28T16:00:00Z" }, signedIn);

    expect([...touched].sort()).toEqual(
      ["checkSlot", "findSlots", "getConfig", "getSlots", "hasActiveFreeSession"],
    );
  });

  it("no tool takes an identity in its input", () => {
    for (const tool of createFreeCallTools({} as FreeCallToolDeps)) {
      const properties = Object.keys((tool.inputSchema as { properties: object }).properties);
      expect(properties.join(",")).not.toMatch(/email|user|name|id\b/i);
    }
  });
});
