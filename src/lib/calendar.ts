/**
 * lib/calendar.ts
 *
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
 *
 * ARCH-02: Removed local Redis.fromEnv() call. Uses the shared `kv` singleton
 * from lib/redis.ts so only one Redis client exists per process.
 *
 * Fixes already applied in this file:
 *   - createCancellationToken: TTL set to session end + 1h buffer (CRIT-02a)
 *   - consumeCancellationToken: hard kv.del() instead of mark-as-used (CRIT-02b)
 *   - verifyCancellationToken: hex format validation before crypto (SEC-02)
 */

import { google } from "googleapis";
import { kv } from "@/lib/redis";
import crypto from "crypto";
import { SCHEDULE, DAY_SCHEDULES, dayStartHour } from "@/lib/booking-config";

export { SCHEDULE }; // re-export so existing imports of SCHEDULE from calendar.ts still work

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    timeZone: SCHEDULE.timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns available time slots for a given date and session duration.
 * Queries Google Calendar freebusy, then subtracts busy blocks from
 * the working hours window.
 */
export async function getAvailableSlots(
  dateStr: string,
  durationMinutes: number
): Promise<TimeSlot[]> {
  const dow      = new Date(`${dateStr}T12:00:00`).getDay(); // 0=Sun…6=Sat
  const daySched = DAY_SCHEDULES[dow];
  if (!daySched) return [];

  const startHour = dayStartHour(dow);

  const MORNING_END_MINUTES = daySched.morningEnd * 60 - 15; // 13:45 = 825 min from midnight
  const windows: { startMin: number; endMin: number }[] = [
    { startMin: startHour * 60, endMin: MORNING_END_MINUTES },
  ];
  if (daySched.afternoonStart !== null && daySched.afternoonEnd !== null) {
    windows.push({
      startMin: daySched.afternoonStart * 60,
      endMin:   daySched.afternoonEnd * 60,
    });
  }

  const timeMin = new Date(`${dateStr}T00:00:00+01:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59+01:00`).toISOString();

  const calendar    = getCalendar();
  const freebusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: SCHEDULE.timezone,
      items:    [{ id: CALENDAR_ID }],
    },
  });

  const busyBlocks    = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  const slots: TimeSlot[] = [];
  const now            = new Date();
  const minBookingTime = new Date(now.getTime() + SCHEDULE.minNoticeHours * 60 * 60 * 1000);

  // Iterate over each time window and generate slots
  for (const window of windows) {
    // Start cursor at window start (in UTC, using Madrid offset)
    let cursorMin = window.startMin;

    while (cursorMin + durationMinutes <= window.endMin) {
      const slotStart = new Date(`${dateStr}T${String(Math.floor(cursorMin / 60)).padStart(2, "0")}:${String(cursorMin % 60).padStart(2, "0")}:00+01:00`);
      const slotEnd   = new Date(slotStart.getTime() + durationMinutes * 60_000);

      const overlapsBusy = busyBlocks.some((block) => {
        const bStart = new Date(block.start!);
        const bEnd   = new Date(block.end!);
        return slotStart < bEnd && slotEnd > bStart;
      });

      const tooSoon = slotStart < minBookingTime;

      if (!overlapsBusy && !tooSoon) {
        slots.push({
          start: slotStart.toISOString(),
          end:   slotEnd.toISOString(),
          label: formatTime(slotStart),
        });
      }

      cursorMin += durationMinutes;
    }
  }

  return slots;
}

export async function createCalendarEvent(params: {
  summary:     string;
  description: string;
  startIso:    string;
  endIso:      string;
}): Promise<{ eventId: string; meetLink: string }> {
  const meetLink = process.env.GOOGLE_MEET_URL ?? "";
  const calendar = getCalendar();

  const event = await calendar.events.insert({
    calendarId:  CALENDAR_ID,
    sendUpdates: "none",
    requestBody: {
      summary:     params.summary,
      description: meetLink
        ? `${params.description}\n\nGoogle Meet: ${meetLink}`
        : params.description,
      location: meetLink || undefined,
      start: { dateTime: params.startIso, timeZone: SCHEDULE.timezone },
      end:   { dateTime: params.endIso,   timeZone: SCHEDULE.timezone },
      reminders: {
        useDefault: false,
        overrides:  [
          { method: "email", minutes: 60 * 24 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });

  return { eventId: event.data.id!, meetLink };
}

/**
 * Deletes a Google Calendar event by ID.
 * Used when a student cancels a booking.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  await calendar.events.delete({
    calendarId:  CALENDAR_ID,
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
 * TTL = session end + 1h buffer so keys are automatically evicted (CRIT-02a).
 */
export async function createCancellationToken(
  record: Omit<BookingRecord, "used">
): Promise<string> {
  const payload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const token   = signToken(payload);

  const sessionEndMs = new Date(record.endsAt).getTime();
  const ttlSeconds   = Math.max(3600, Math.floor((sessionEndMs + 3_600_000 - Date.now()) / 1000));

  await kv.set(`cancel:${token}`, { ...record, used: false }, { ex: ttlSeconds });

  return token;
}

/**
 * Verifies a cancellation token and returns the booking record if valid.
 * Returns null if the token is invalid, already expired, or the 2-hour window has closed.
 * Validates token format before crypto operations to prevent buffer-length mismatch (SEC-02).
 */
export async function verifyCancellationToken(
  token: string
): Promise<{ record: BookingRecord; withinWindow: boolean } | null> {
  // Validate format first — must be exactly 64 lowercase hex chars (SHA-256 output)
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (!record || record.used) return null;

  // Verify the HMAC signature using constant-time comparison
  const expectedPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const expectedToken   = signToken(expectedPayload);

  const valid = crypto.timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(expectedToken, "hex")
  );
  if (!valid) return null;

  const startsAt       = new Date(record.startsAt);
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * 60 * 60_000);
  const withinWindow   = new Date() < twoHoursBefore;

  return { record, withinWindow };
}

/**
 * Deletes the cancellation token from KV so it cannot be reused (CRIT-02b).
 */
export async function consumeCancellationToken(token: string): Promise<void> {
  await kv.del(`cancel:${token}`);
}
