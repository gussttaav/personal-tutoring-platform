// CHAT-AGENT-P1-03: the chat assistant's two free-call tools. Both are READ-ONLY: they
// look up availability and validate a slot, and the most they do is emit an action for
// the UI. The only booking path stays the user's click → POST /api/book (PLAN Q1).
// No tool input carries an identity; who is asking comes from the route's ToolContext.
//
//   find_free_call_slots — free 15-minute slots over a few days, in the VISITOR's
//     timezone: the visitor's days are mapped onto the tutor's calendar days (a
//     visitor's day can span two of them), filtered by part of day, thinned to a few.
//     With `near_time` the few are the ones closest to that time, so an exact time the
//     user asked for is never thinned out of the answer (found in the live check: the
//     even spread dropped a free 10:00 and the model said there was none).
//   propose_free_call — re-checks one slot (BookingService.checkSlot: grid,
//     min-notice, window, working blocks; then the cached calendar availability)
//     and emits a `proposal` action for the confirmation card.
//
// A rejection the model should explain is a normal result (`ok: false` + a code); only
// a bad input or a failing dependency becomes an `is_error` result (ClaudeClient).
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { ChatAction, ChatTool, ToolContext } from "@/infrastructure/anthropic";
import type { TimeSlot } from "@/domain/types";
import type { AvailabilityService } from "../AvailabilityService";
import { MAX_FIND_DAYS } from "../AvailabilityService";
import type { BookingService } from "../BookingService";
import type { ScheduleService } from "../ScheduleService";
import { SESSION_DURATION_MINUTES } from "@/lib/booking-config";

const FREE_CALL_MINUTES = SESSION_DURATION_MINUTES.free15min;
const DEFAULT_DAYS      = 3;
/** The model and the chips get at most this many slots per search. */
export const MAX_OFFERED_SLOTS = 8;
/** Every start a day can hold on the 15-minute grid: findSlots walks whole days. */
const MAX_SLOTS_PER_DAY = (24 * 60) / FREE_CALL_MINUTES;

export type PartOfDay = "morning" | "afternoon" | "evening";

export interface FreeCallToolDeps {
  availability: Pick<AvailabilityService, "findSlots" | "getSlots">;
  booking:      Pick<BookingService, "checkSlot" | "hasActiveFreeSession">;
  /** The tutor's timezone (the calendar days availability is keyed by). Cached read. */
  schedule:     Pick<ScheduleService, "getConfig">;
}

// ─── Input schemas ────────────────────────────────────────────────────────────
// The JSON schemas go out with `strict: true`, which takes no numeric bounds, so
// the ranges live in the descriptions and are enforced here.

const FindInput = z.object({
  from_date:   z.iso.date(),
  days:        z.number().int().optional(),
  part_of_day: z.enum(["morning", "afternoon", "evening"]).optional(),
  near_time:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

const ProposeInput = z.object({
  start_iso: z.string(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD plus `n` calendar days (calendar arithmetic, no timezone involved). */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Morning < 12:00, afternoon 12:00–18:00, evening ≥ 18:00, in the visitor's clock. */
export function partOfDay(start: Date, timezone: string): PartOfDay {
  const hour = Number(formatInTimeZone(start, timezone, "H"));
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/** "mar 4 nov · 10:00" (es) / "Tue 4 Nov · 10:00" (en), in the visitor's timezone. */
export function localLabel(start: Date, ctx: Pick<ToolContext, "locale" | "timezone">): string {
  const parts = new Intl.DateTimeFormat(ctx.locale === "en" ? "en-GB" : "es-ES", {
    timeZone: ctx.timezone,
    weekday:  "short",
    day:      "numeric",
    month:    "short",
    hour:     "2-digit",
    minute:   "2-digit",
    hourCycle: "h23",
  }).formatToParts(start);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? "").replace(/\.$/, "");
  return `${part("weekday")} ${part("day")} ${part("month")} · ${part("hour")}:${part("minute")}`;
}

/**
 * At most `max` slots, spread over the days: each day gets a share in turn (round
 * robin), and a day's share is picked evenly from its first to its last slot.
 * `slots` must be in chronological order; the result keeps it.
 */
export function thinSlots(slots: TimeSlot[], timezone: string, max = MAX_OFFERED_SLOTS): TimeSlot[] {
  if (slots.length <= max) return slots;

  const byDay: TimeSlot[][] = [];
  let lastDay = "";
  for (const s of slots) {
    const day = formatInTimeZone(new Date(s.start), timezone, "yyyy-MM-dd");
    if (day !== lastDay) { byDay.push([]); lastDay = day; }
    byDay[byDay.length - 1].push(s);
  }

  const quota = byDay.map(() => 0);
  for (let given = 0; given < max; ) {
    for (let d = 0; d < byDay.length && given < max; d++) {
      if (quota[d] < byDay[d].length) { quota[d]++; given++; }
    }
  }

  return byDay.flatMap((day, d) => {
    const k = quota[d];
    if (k === 0) return [];
    if (k === 1) return [day[0]];
    return Array.from({ length: k }, (_, i) => day[Math.round((i * (day.length - 1)) / (k - 1))]);
  });
}

/** Minutes since midnight of `start` on the visitor's clock. */
function localMinutes(start: Date, timezone: string): number {
  const [h, m] = formatInTimeZone(start, timezone, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}

/**
 * The `max` slots whose local time is closest to `hhmm` (on any of the days; ties go
 * to the earlier slot), back in chronological order.
 */
export function nearestSlots(slots: TimeSlot[], timezone: string, hhmm: string, max = MAX_OFFERED_SLOTS): TimeSlot[] {
  const target = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  return slots
    .map((s, i) => ({ s, i, d: Math.abs(localMinutes(new Date(s.start), timezone) - target) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

/** An ISO-8601 instant with an explicit offset (or Z); anything else is not a slot. */
function parseInstant(iso: string): Date | null {
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim())) return null;
  const d = new Date(iso.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export function createFreeCallTools(deps: FreeCallToolDeps): ChatTool[] {
  const { availability, booking, schedule } = deps;

  const findFreeCallSlots: ChatTool = {
    name: "find_free_call_slots",
    description:
      "Looks up Gustavo's free slots for the FREE 15-minute intro call only (never for paid " +
      "sessions or packs). Dates and times are in the user's timezone. Returns at most 8 slots " +
      "spread over the days (or, with near_time, the closest to that time), each with `start_iso` (pass it unchanged to propose_free_call) and " +
      "`local_label` (how to say it). `already_booked: true` means the signed-in user already " +
      "holds their one free call. Read-only: it books nothing.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: {
          type: "string",
          format: "date",
          description: "First day to search, YYYY-MM-DD, in the user's timezone. A past date searches from today.",
        },
        days: {
          type: "integer",
          description: "How many days to search from from_date, 1 to 7. Default 3.",
        },
        part_of_day: {
          type: "string",
          enum: ["morning", "afternoon", "evening"],
          description: "Only slots starting in this part of the user's day: morning before 12:00, afternoon 12:00-18:00, evening from 18:00.",
        },
        near_time: {
          type: "string",
          description: "HH:MM (24 h, the user's clock). When the user asks for a specific time, pass it: the slots returned are the ones closest to it, that time included if it is free.",
        },
      },
      required: ["from_date"],
      additionalProperties: false,
    },

    async run(input, ctx) {
      const args = FindInput.parse(input);

      if (ctx.email && await booking.hasActiveFreeSession(ctx.email)) {
        return { result: { already_booked: true } };
      }

      const tz       = ctx.timezone;
      const today    = formatInTimeZone(ctx.now, tz, "yyyy-MM-dd");
      const fromDate = args.from_date < today ? today : args.from_date;
      const days     = Math.min(Math.max(args.days ?? DEFAULT_DAYS, 1), MAX_FIND_DAYS);

      // The visitor's days as an instant window (local midnights, so DST-safe), then
      // the tutor's calendar days that cover it.
      const windowStart = fromZonedTime(`${fromDate}T00:00:00`, tz);
      const windowEnd   = fromZonedTime(`${addDays(fromDate, days)}T00:00:00`, tz);
      const { timezone: tutorTz } = await schedule.getConfig();
      const firstTutorDay = formatInTimeZone(windowStart, tutorTz, "yyyy-MM-dd");
      const lastTutorDay  = formatInTimeZone(new Date(windowEnd.getTime() - 1), tutorTz, "yyyy-MM-dd");
      const tutorDays     = Math.min(daysBetween(firstTutorDay, lastTutorDay) + 1, MAX_FIND_DAYS);

      const found = await availability.findSlots({
        fromDate:        firstTutorDay,
        days:            tutorDays,
        durationMinutes: FREE_CALL_MINUTES,
        limit:           tutorDays * MAX_SLOTS_PER_DAY,
      });

      const matching = found.filter((s) => {
        const start = new Date(s.start);
        return start >= windowStart && start < windowEnd
          && (!args.part_of_day || partOfDay(start, tz) === args.part_of_day);
      });

      if (matching.length === 0) {
        return {
          result: {
            timezone: tz,
            slots: [],
            next_hint: "No free slots in that range. Offer other days or another part of the day; never suggest a time that was not returned.",
          },
        };
      }

      const offered = args.near_time ? nearestSlots(matching, tz, args.near_time) : thinSlots(matching, tz);
      const action: ChatAction = {
        type: "slots",
        durationMinutes: 15,
        slots: offered.map((s) => ({ startIso: s.start, endIso: s.end })),
      };
      return {
        result: {
          timezone: tz,
          slots: offered.map((s) => ({ start_iso: s.start, local_label: localLabel(new Date(s.start), ctx) })),
          more_available: matching.length > offered.length,
        },
        action,
      };
    },
  };

  const proposeFreeCall: ChatTool = {
    name: "propose_free_call",
    description:
      "Re-checks one free 15-minute intro call slot and, if it is still free, shows the user a " +
      "card to confirm it themselves (signing in with Google first if needed). It does NOT book: " +
      "never say the call is booked. Use a `start_iso` returned by find_free_call_slots. " +
      "`ok: false` comes with a `reason`: SLOT_UNAVAILABLE, INVALID_SLOT or FREE_SESSION_ALREADY_USED.",
    inputSchema: {
      type: "object",
      properties: {
        start_iso: {
          type: "string",
          format: "date-time",
          description: "Start of the slot, ISO-8601 with an offset, exactly as find_free_call_slots returned it.",
        },
      },
      required: ["start_iso"],
      additionalProperties: false,
    },

    async run(input, ctx) {
      const args   = ProposeInput.parse(input);
      const reject = (reason: "SLOT_UNAVAILABLE" | "INVALID_SLOT" | "FREE_SESSION_ALREADY_USED") =>
        ({ result: { ok: false, reason } });

      const start = parseInstant(args.start_iso);
      if (!start) return reject("INVALID_SLOT");
      const startIso = start.toISOString();
      const endIso   = new Date(start.getTime() + FREE_CALL_MINUTES * 60_000).toISOString();

      // In-process first (no network): grid, min-notice, window, working blocks.
      const slotError = await booking.checkSlot({ startIso, endIso, sessionType: "free15min" });
      if (slotError) return reject(slotError.code === "INVALID_SLOT" ? "INVALID_SLOT" : "SLOT_UNAVAILABLE");

      if (ctx.email && await booking.hasActiveFreeSession(ctx.email)) {
        return reject("FREE_SESSION_ALREADY_USED");
      }

      // Then the calendar: the slot must still be among the day's free slots (cached freebusy).
      const { timezone: tutorTz } = await schedule.getConfig();
      const free = await availability.getSlots(formatInTimeZone(start, tutorTz, "yyyy-MM-dd"), FREE_CALL_MINUTES);
      if (!free.some((s) => new Date(s.start).getTime() === start.getTime())) {
        return reject("SLOT_UNAVAILABLE");
      }

      return {
        result: { ok: true, local_label: localLabel(start, ctx) },
        action: { type: "proposal", sessionType: "free15min", startIso, endIso },
      };
    },
  };

  return [findFreeCallSlots, proposeFreeCall];
}
