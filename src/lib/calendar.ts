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
 * SECURITY FIXES:
 *
 *   CRIT-02a — Token TTL:
 *     createCancellationToken() now sets a Redis TTL so cancel:* keys are
 *     automatically cleaned up. TTL = time until session end + 1-hour buffer.
 *     Previously keys were stored forever, creating an unbounded memory leak
 *     and leaving a wider window for token-based attacks.
 *
 *   CRIT-02b — DELETE on consume:
 *     consumeCancellationToken() now DELetes the key instead of marking it
 *     { used: true }. A deleted key cannot be re-read or tampered with.
 *     The old "mark as used" pattern required a second KV round-trip and
 *     left sensitive booking data in Redis indefinitely.
 *
 *   SEC-02 — Token format validation before crypto:
 *     verifyCancellationToken() validates that the token is exactly 64
 *     lowercase hex characters before calling Buffer.from(token, "hex").
 *     An invalid token would previously cause timingSafeEqual to throw
 *     (mismatched buffer lengths), which was silently caught — creating a
 *     potential timing-oracle if the catch branch had measurable latency.
 */

import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { SCHEDULE, DAY_SCHEDULES, dayStartHour } from "@/lib/booking-config";

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
  dateStr: string,
  durationMinutes: number
): Promise<TimeSlot[]> {
  // Determine Madrid day-of-week for this date
  const dow = new Date(`${dateStr}T12:00:00`).getDay(); // 0=Sun…6=Sat
  const daySched = DAY_SCHEDULES[dow];
  if (!daySched) return [];

  const startHour = dayStartHour(dow);

  // Build the valid time windows for this day
  // Morning: startHour → daySched.morningEnd (exclusive)
  // Afternoon: daySched.afternoonStart → daySched.afternoonEnd (if present)
  // The 13:45 cutoff is handled by the slot end not exceeding morningEnd*60 minutes
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

  // Freebusy query for the full day
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

  const slots: TimeSlot[] = [];
  const now = new Date();
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
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
}): Promise<{ eventId: string; meetLink: string }> {
  // Use the static permanent Meet room configured in GOOGLE_MEET_URL env var.
  // Service accounts cannot generate Meet links on personal Gmail calendars
  // regardless of the API used — a fixed room is the correct approach for a
  // solo tutor (one stable link, always available, you control access).
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
        overrides: [
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
 *
 * FIX (CRIT-02a): The KV entry now carries a TTL so it is automatically
 * evicted after the session ends (plus a 1-hour buffer). This prevents
 * unbounded growth of cancel:* keys in Redis.
 *
 * TTL calculation:
 *   - We want the token to remain valid until 2 h before the session starts
 *     (the cancellation window), then expire shortly after the session ends.
 *   - We use session end + 1 hour as the TTL anchor so the key is still
 *     readable if there's clock skew or a slow cancellation request arrives
 *     just as the session is finishing.
 *   - Minimum TTL is 1 hour to handle immediate bookings.
 */
export async function createCancellationToken(
  record: Omit<BookingRecord, "used">
): Promise<string> {
  const payload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const token   = signToken(payload);

  // Compute TTL: seconds from now until (session end + 1 h buffer)
  const sessionEndMs  = new Date(record.endsAt).getTime();
  const bufferMs      = 60 * 60 * 1000; // 1 hour
  const ttlMs         = sessionEndMs + bufferMs - Date.now();
  const ttlSeconds    = Math.max(3600, Math.floor(ttlMs / 1000)); // minimum 1 hour

  await kv.set(`cancel:${token}`, { ...record, used: false }, { ex: ttlSeconds });

  return token;
}

/**
 * Verifies a cancellation token and returns the booking record if valid.
 * Returns null if the token is invalid, already used, expired, or the
 * 2-hour cancellation window has closed.
 *
 * FIX (SEC-02): Token format is validated before any crypto operations.
 * A token that is not exactly 64 lowercase hex characters is rejected
 * immediately, preventing Buffer.from() from producing a wrong-length
 * buffer that would cause timingSafeEqual to throw.
 */
export async function verifyCancellationToken(
  token: string
): Promise<{ record: BookingRecord; withinWindow: boolean } | null> {
  // Validate format first — must be exactly 64 lowercase hex chars (SHA-256 output)
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (!record) return null;
  if (record.used) return null;

  // Verify the HMAC signature using constant-time comparison
  const expectedPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const expectedToken   = signToken(expectedPayload);

  // Both buffers are guaranteed to be exactly 32 bytes (64 hex chars validated above)
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
 * Deletes the cancellation token from KV so it cannot be reused.
 *
 * FIX (CRIT-02b): Changed from marking { used: true } to a hard DELETE.
 * - A deleted key cannot be re-read, replayed, or tampered with.
 * - The old approach kept booking data in Redis forever and required an
 *   extra GET + SET round-trip, increasing both latency and storage cost.
 * - The TTL on creation (see createCancellationToken) already handles
 *   clean-up for tokens that are never consumed (e.g. user never cancels).
 */
export async function consumeCancellationToken(token: string): Promise<void> {
  await kv.del(`cancel:${token}`);
}
