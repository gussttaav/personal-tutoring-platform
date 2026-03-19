/**
 * Google Calendar API integration.
 *
 * Responsibilities:
 *   - Query freebusy to find available slots
 *   - Create calendar events with Google Meet links
 *   - Delete events on cancellation
 *   - Generate and verify signed cancellation tokens (stored in KV)
 *
 * Prerequisites (env vars):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_CALENDAR_ID   ← your personal calendar ID (usually your Gmail address)
 *   CANCEL_SECRET        ← openssl rand -hex 32
 */

import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { SCHEDULE } from "@/lib/booking-config";

export { SCHEDULE }; // re-export so existing imports of SCHEDULE from calendar.ts still work

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const kv = Redis.fromEnv();

// ─── Google auth ──────────────────────────────────────────────────────────────

function getCalendar() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  /** ISO 8601 start datetime */
  start: string;
  /** ISO 8601 end datetime */
  end: string;
  /** Human-readable label e.g. "10:00" */
  label: string;
}

export interface BookingRecord {
  eventId: string;
  email: string;
  name: string;
  sessionType: string;
  startsAt: string;
  endsAt: string;
  used: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMadridDate(date: Date): Date {
  // Returns a Date object adjusted for Europe/Madrid offset
  const str = date.toLocaleString("en-CA", {
    timeZone: SCHEDULE.timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return new Date(str.replace(",", ""));
}

function madridMidnight(dateStr: string): Date {
  // Returns a UTC Date representing midnight in Madrid for the given YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00+01:00`);
}

function isInBreak(hour: number): boolean {
  return SCHEDULE.breaks.some((b) => hour >= b.start && hour < b.end);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    timeZone: SCHEDULE.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns available time slots for a given date and session duration.
 * Queries Google Calendar freebusy, then subtracts busy blocks from
 * the working hours window.
 */
export async function getAvailableSlots(
  dateStr: string,   // YYYY-MM-DD
  durationMinutes: number
): Promise<TimeSlot[]> {
  const dayStart = new Date(`${dateStr}T${String(SCHEDULE.startHour).padStart(2, "0")}:00:00`);
  const dayEnd   = new Date(`${dateStr}T${String(SCHEDULE.endHour).padStart(2, "0")}:00:00`);

  // Use Europe/Madrid offset for the query window
  const timeMin = new Date(`${dateStr}T00:00:00+01:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59+01:00`).toISOString();

  const calendar = getCalendar();
  const freebusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: SCHEDULE.timezone,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busyBlocks = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy ?? [];

  // Build candidate slots at 1h intervals across the working day
  const slots: TimeSlot[] = [];
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + SCHEDULE.minNoticeHours * 60 * 60 * 1000);

  let cursor = new Date(dayStart);

  while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd   = new Date(cursor.getTime() + durationMinutes * 60_000);

    const madridHour = parseInt(
      slotStart.toLocaleTimeString("es-ES", {
        timeZone: SCHEDULE.timezone,
        hour: "2-digit",
        hour12: false,
      }),
      10
    );

    const overlapsBreak = SCHEDULE.breaks.some(
      (b) => madridHour >= b.start && madridHour < b.end
    );

    const overlapsBreakEnd = SCHEDULE.breaks.some((b) => {
      const endHour = parseInt(
        slotEnd.toLocaleTimeString("es-ES", {
          timeZone: SCHEDULE.timezone,
          hour: "2-digit",
          hour12: false,
        }),
        10
      );
      return madridHour < b.end && endHour > b.start;
    });

    const overlapsBusy = busyBlocks.some((block) => {
      const bStart = new Date(block.start!);
      const bEnd   = new Date(block.end!);
      return slotStart < bEnd && slotEnd > bStart;
    });

    const tooSoon = slotStart < minBookingTime;

    if (!overlapsBreak && !overlapsBreakEnd && !overlapsBusy && !tooSoon) {
      slots.push({
        start: slotStart.toISOString(),
        end:   slotEnd.toISOString(),
        label: formatTime(slotStart),
      });
    }

    // Advance by 1 hour
    cursor = new Date(cursor.getTime() + 60 * 60_000);
  }

  return slots;
}

/**
 * Creates a Google Calendar event with a Google Meet link.
 * Returns the created event ID and Meet link.
 */
export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<{ eventId: string; meetLink: string }> {
  const calendar = getCalendar();

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,  // required to auto-generate Meet link
    sendUpdates: "none",       // we send our own email via Resend
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startIso, timeZone: SCHEDULE.timezone },
      end:   { dateTime: params.endIso,   timeZone: SCHEDULE.timezone },
      attendees: [
        { email: params.attendeeEmail, displayName: params.attendeeName },
      ],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email",  minutes: 60 * 24 },  // 24h before
          { method: "popup",  minutes: 30 },
        ],
      },
    },
  });

  const eventId  = event.data.id!;
  const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri ?? "";

  return { eventId, meetLink };
}

/**
 * Deletes a Google Calendar event by ID.
 * Used when a student cancels a booking.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
    sendUpdates: "none",
  });
}

// ─── Cancellation tokens ──────────────────────────────────────────────────────

const CANCEL_SECRET = process.env.CANCEL_SECRET!;

function signToken(payload: string): string {
  return crypto
    .createHmac("sha256", CANCEL_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Generates a signed cancellation token and stores the booking record in KV.
 * Returns the token to be embedded in the cancellation email link.
 */
export async function createCancellationToken(record: Omit<BookingRecord, "used">): Promise<string> {
  const payload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const token   = signToken(payload);

  await kv.set(`cancel:${token}`, { ...record, used: false });

  return token;
}

/**
 * Verifies a cancellation token and returns the booking record if valid.
 * Returns null if the token is invalid, already used, or the 2-hour window has passed.
 */
export async function verifyCancellationToken(
  token: string
): Promise<{ record: BookingRecord; withinWindow: boolean } | null> {
  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (!record) return null;
  if (record.used) return null;

  // Verify the HMAC signature
  const expectedPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const expectedToken   = signToken(expectedPayload);
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex")
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  const startsAt      = new Date(record.startsAt);
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * 60 * 60_000);
  const withinWindow   = new Date() < twoHoursBefore;

  return { record, withinWindow };
}

/**
 * Marks a cancellation token as used so it cannot be reused.
 */
export async function consumeCancellationToken(token: string): Promise<void> {
  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (record) {
    await kv.set(`cancel:${token}`, { ...record, used: true });
  }
}
