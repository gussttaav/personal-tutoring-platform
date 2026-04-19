// ARCH-13: Google Calendar client — implements ICalendarClient.
// ARCH-16: Absorbed full logic from lib/calendar.ts (was a thin wrapper).
import { google } from "googleapis";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { kv } from "@/infrastructure/redis/client";
import crypto from "crypto";
import { SCHEDULE, DAY_SCHEDULES, dayStartHour } from "@/lib/booking-config";
import {
  generateZoomSessionCredentials,
  getSessionDurationWithGrace,
} from "@/infrastructure/zoom/jwt";
import type { ZoomSessionRecord } from "@/infrastructure/zoom/jwt";
import type {
  ICalendarClient,
  CreateEventParams,
  CreateEventResult,
  TimeSlot,
} from "./ICalendarClient";

export { SCHEDULE };

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const TZ          = SCHEDULE.timezone; // "Europe/Madrid"

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

function formatTime(date: Date): string {
  return format(toZonedTime(date, TZ), "HH:mm", { timeZone: TZ });
}

function madridToUtc(dateStr: string, hours: number, minutes: number): Date {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, TZ);
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
): string {
  if (durationMinutes === 15) {
    return formatTime(slotStart);
  }
  return `${formatTime(slotStart)}–${formatTime(slotEnd)}`;
}

// ─── Public standalone helpers (used by non-class callers) ────────────────────

export async function getAvailableSlots(
  dateStr: string,
  durationMinutes: number,
): Promise<TimeSlot[]> {
  const dow      = new Date(`${dateStr}T12:00:00Z`).getDay();
  const daySched = DAY_SCHEDULES[dow];
  if (!daySched) return [];

  const startHour           = dayStartHour(dow);
  const MORNING_END_MINUTES = daySched.morningEnd * 60 - 15;
  const windows: { startMin: number; endMin: number }[] = [
    { startMin: startHour * 60, endMin: MORNING_END_MINUTES },
  ];
  if (daySched.afternoonStart !== null && daySched.afternoonEnd !== null) {
    windows.push({
      startMin: daySched.afternoonStart * 60,
      endMin:   daySched.afternoonEnd * 60,
    });
  }

  const timeMin = madridToUtc(dateStr, 0, 0).toISOString();
  const timeMax = madridToUtc(dateStr, 23, 59).toISOString();

  const calendar    = getCalendar();
  const freebusyRes = await calendar.freebusy.query({
    requestBody: { timeMin, timeMax, timeZone: TZ, items: [{ id: CALENDAR_ID }] },
  });

  const busyBlocks  = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  const slots: TimeSlot[] = [];
  const minBookingTime = new Date(Date.now() + SCHEDULE.minNoticeHours * 3_600_000);

  const stepMinutes = durationMinutes;

  for (const window of windows) {
    let cursorMin = window.startMin;

    while (cursorMin + durationMinutes <= window.endMin) {
      const slotStart = madridToUtc(
        dateStr,
        Math.floor(cursorMin / 60),
        cursorMin % 60,
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
          label: formatSlotLabel(slotStart, slotEnd, durationMinutes),
        });
      }

      cursorMin += stepMinutes;
    }
  }

  return slots;
}

// ─── Class implementation ─────────────────────────────────────────────────────

export class CalendarClient implements ICalendarClient {
  async getAvailableSlots(
    dateStr: string,
    durationMinutes: number,
  ): Promise<TimeSlot[]> {
    return getAvailableSlots(dateStr, durationMinutes);
  }

  async createEvent(params: CreateEventParams): Promise<CreateEventResult> {
    const calendar = getCalendar();

    const event = await calendar.events.insert({
      calendarId:  CALENDAR_ID,
      sendUpdates: "none",
      requestBody: {
        summary:     params.summary,
        description: params.description,
        start: { dateTime: params.startIso, timeZone: TZ },
        end:   { dateTime: params.endIso,   timeZone: TZ },
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

    const durationWithGrace = getSessionDurationWithGrace(params.sessionType);
    const zoomRecord: ZoomSessionRecord = {
      sessionId,
      sessionName:     zoomSessionName,
      sessionPasscode,
      startIso:        params.startIso,
      durationMinutes,
      sessionType:     params.sessionType,
      studentEmail:    params.studentEmail,
    };
    await kv.set(`zoom:session:${eventId}`, zoomRecord, {
      ex: durationWithGrace * 60 + 86_400,
    });

    return { eventId, zoomSessionName, zoomPasscode: sessionPasscode };
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
