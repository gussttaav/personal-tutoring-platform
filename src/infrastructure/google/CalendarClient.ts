// ARCH-13: Google Calendar client — implements ICalendarClient.
// ARCH-16: Absorbed full logic from lib/calendar.ts (was a thin wrapper).
// DB-05b: Removed direct kv.set() — Zoom session now stored via ISessionRepository in BookingService.
import { google } from "googleapis";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import crypto from "crypto";
import { slotsFromBlocks } from "@/lib/booking-config";
import { generateZoomSessionCredentials } from "@/infrastructure/zoom/jwt";
import type { ScheduleConfig } from "@/domain/types";
import type {
  ICalendarClient,
  CreateEventParams,
  CreateEventResult,
  TimeSlot,
} from "./ICalendarClient";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

// ─── Google auth ──────────────────────────────────────────────────────────────

function getCalendar() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date, tz: string): string {
  return format(toZonedTime(date, tz), "HH:mm", { timeZone: tz });
}

function zonedToUtc(dateStr: string, hours: number, minutes: number, tz: string): Date {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, tz);
}

/**
 * Returns a display label for a slot.
 *
 * - 15-min slots: "09:30"         (start time only — existing behaviour)
 * - 1h / 2h slots: "09:30–10:30" (start–end range — new behaviour)
 */
function formatSlotLabel(
  slotStart: Date,
  slotEnd: Date,
  durationMinutes: number,
  tz: string,
): string {
  if (durationMinutes === 15) {
    return formatTime(slotStart, tz);
  }
  return `${formatTime(slotStart, tz)}–${formatTime(slotEnd, tz)}`;
}

// ─── Public standalone helpers (used by non-class callers) ────────────────────

export async function getAvailableSlots(
  dateStr: string,
  durationMinutes: number,
  config: ScheduleConfig,
  stepMinutes = durationMinutes,
): Promise<TimeSlot[]> {
  const tz       = config.timezone;
  const dow      = new Date(`${dateStr}T12:00:00Z`).getDay();
  const blocks   = config.weeklyHours[dow] ?? [];
  if (blocks.length === 0) return [];

  const startMinutes = slotsFromBlocks(blocks, durationMinutes, stepMinutes);
  if (startMinutes.length === 0) return [];

  const timeMin = zonedToUtc(dateStr, 0, 0, tz).toISOString();
  const timeMax = zonedToUtc(dateStr, 23, 59, tz).toISOString();

  const calendar    = getCalendar();
  const freebusyRes = await calendar.freebusy.query({
    requestBody: { timeMin, timeMax, timeZone: tz, items: [{ id: CALENDAR_ID }] },
  });

  const busyBlocks  = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  const slots: TimeSlot[] = [];
  const minBookingTime = new Date(Date.now() + config.minNoticeHours * 3_600_000);

  for (const cursorMin of startMinutes) {
    const slotStart = zonedToUtc(
      dateStr,
      Math.floor(cursorMin / 60),
      cursorMin % 60,
      tz,
    );
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

    const overlapsBusy = busyBlocks.some((block) => {
      const bStart = new Date(block.start!);
      const bEnd   = new Date(block.end!);
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (!overlapsBusy && slotStart >= minBookingTime) {
      slots.push({
        start: slotStart.toISOString(),
        end:   slotEnd.toISOString(),
        label: formatSlotLabel(slotStart, slotEnd, durationMinutes, tz),
      });
    }
  }

  return slots;
}

// ─── Class implementation ─────────────────────────────────────────────────────

export class CalendarClient implements ICalendarClient {
  async getAvailableSlots(
    dateStr: string,
    durationMinutes: number,
    config: ScheduleConfig,
    stepMinutes?: number,
  ): Promise<TimeSlot[]> {
    return getAvailableSlots(dateStr, durationMinutes, config, stepMinutes);
  }

  async createEvent(params: CreateEventParams): Promise<CreateEventResult> {
    const calendar = getCalendar();

    const event = await calendar.events.insert({
      calendarId:  CALENDAR_ID,
      sendUpdates: "none",
      requestBody: {
        summary:     params.summary,
        description: params.description,
        start: { dateTime: params.startIso, timeZone: params.timezone },
        end:   { dateTime: params.endIso,   timeZone: params.timezone },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email",  minutes: 1440 },
            { method: "popup",  minutes: 30   },
          ],
        },
      },
    });

    const eventId         = event.data.id!;
    const durationMinutes = Math.round(
      (new Date(params.endIso).getTime() - new Date(params.startIso).getTime()) / 60_000,
    );
    const safeIso     = params.startIso.replace(/[:.]/g, "-");
    const sessionName = `session-${safeIso}-${crypto.randomUUID().slice(0, 8)}`;

    const { sessionId, sessionName: zoomSessionName, sessionPasscode } =
      generateZoomSessionCredentials({ sessionName });

    return {
      eventId,
      zoomSessionName,
      zoomPasscode:    sessionPasscode,
      zoomSessionId:   sessionId,
      durationMinutes,
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    const calendar = getCalendar();
    await calendar.events.delete({
      calendarId:  CALENDAR_ID,
      eventId,
      sendUpdates: "none",
    });
  }
}
