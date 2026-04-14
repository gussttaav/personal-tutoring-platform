/**
 * lib/calendar.ts
 *
 * Google Calendar API integration.
 *
 * Applied fixes (cumulative):
 *   Week 1 — CRIT-02: token TTL + hard DELETE on consume + HMAC format check
 *   Week 2 — ARCH-02: shared kv singleton
 *   Week 3 — PERF-01: DST-correct slot generation via date-fns-tz
 *   Backlog — SLOT LOCK: acquireSlotLock / releaseSlotLock
 *
 * SLOT LOCKING DESIGN:
 *
 * The race condition: user A selects slot at 10:00, user B selects the same
 * slot at 10:00 a few seconds later. Both proceed through Stripe checkout.
 * Both webhooks fire and attempt to create calendar events for the same slot.
 *
 * Fix: before creating a calendar event (in the webhook or /api/book), call
 * acquireSlotLock(startIso, durationMinutes). If it returns false, the slot
 * is already being processed by another request — abort and refund.
 *
 * Implementation:
 *   - Key:   slot:lock:{startIso}
 *   - Value: 1 (arbitrary non-empty value)
 *   - NX:    true (set only if Not eXists — atomic compare-and-set)
 *   - TTL:   durationMinutes + 5 minute buffer, so locks never get stuck
 *
 * The NX flag makes the operation atomic at the Redis level — no Lua script
 * needed. If the caller crashed mid-booking, the TTL ensures the slot
 * becomes available again automatically.
 *
 * Usage in webhook:
 *   const locked = await acquireSlotLock(startIso, durationMinutes);
 *   if (!locked) { refund and return; }
 *   try {
 *     await createCalendarEvent(...);
 *   } finally {
 *     await releaseSlotLock(startIso);
 *   }
 *
 * Note: for this application (single tutor, ~1 booking per hour on average),
 * the slot lock is a safety net rather than a critical path requirement.
 * Enable it if you see duplicate bookings in the Upstash logs.
 *
 */

import { google } from "googleapis";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { kv } from "@/lib/redis";
import crypto from "crypto";
import { SCHEDULE, DAY_SCHEDULES, dayStartHour } from "@/lib/booking-config";
import { generateZoomSessionCredentials, getSessionDurationWithGrace } from "@/lib/zoom";
import type { ZoomSessionRecord } from "@/lib/zoom";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: string;
  end:   string;
  label: string;
}

export interface BookingRecord {
  eventId:     string;
  email:       string;
  name:        string;
  sessionType: string;
  startsAt:    string;
  endsAt:      string;
  used:        boolean;
  packSize?:   number;   // only for sessionType "pack"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return format(toZonedTime(date, TZ), "HH:mm", { timeZone: TZ });
}

function madridToUtc(dateStr: string, hours: number, minutes: number): Date {
  const hh  = String(hours).padStart(2, "0");
  const mm  = String(minutes).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, TZ);
}

/**
 * Returns a display label for a slot.
 *
 * - 15-min slots: "09:30"         (start time only — existing behaviour)
 * - 1h / 2h slots: "09:30–10:30" (start–end range — new behaviour)
 *
 * Using a range for longer slots is necessary because rolling slots share
 * the same start-minute pattern, so "09:30" alone would be ambiguous
 * if we ever showed slots from multiple durations on the same screen.
 * More importantly it gives users an immediate sense of the commitment.
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

// ─── Slot locking ─────────────────────────────────────────────────────────────

function slotLockKey(startIso: string): string {
  // Normalise to avoid collisions from equivalent ISO representations
  return `slot:lock:${new Date(startIso).toISOString()}`;
}

/**
 * Attempts to acquire an exclusive lock for a time slot.
 *
 * @param startIso        ISO 8601 start time of the slot
 * @param durationMinutes Duration of the slot (used to set the TTL)
 * @returns true if the lock was acquired, false if the slot is already locked
 */
export async function acquireSlotLock(
  startIso: string,
  durationMinutes: number
): Promise<boolean> {
  const ttlSeconds = durationMinutes * 60 + 5 * 60; // slot duration + 5 min buffer
  const result = await kv.set(slotLockKey(startIso), 1, { nx: true, ex: ttlSeconds });
  // Upstash returns "OK" on success, null when NX prevents the write
  return result === "OK";
}

/**
 * Releases a previously acquired slot lock.
 * Safe to call even if the lock was never acquired or has already expired.
 */
export async function releaseSlotLock(startIso: string): Promise<void> {
  await kv.del(slotLockKey(startIso));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAvailableSlots(
  dateStr: string,
  durationMinutes: number
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

  const busyBlocks     = freebusyRes.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  const slots: TimeSlot[] = [];
  const minBookingTime = new Date(Date.now() + SCHEDULE.minNoticeHours * 3_600_000);

  // Each slot advances by its own duration: 15→15 min, 60→60 min, 120→120 min.
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

export async function createCalendarEvent(params: {
  summary:      string;
  description:  string;
  startIso:     string;
  endIso:       string;
  sessionType?: string;
}): Promise<{ eventId: string; zoomSessionName: string; zoomPasscode: string }> {
  const calendar = getCalendar();

  const event = await calendar.events.insert({
    calendarId:  CALENDAR_ID,
    sendUpdates: "none",
    requestBody: {
      summary:     params.summary,
      description: params.description,
      start: { dateTime: params.startIso, timeZone: TZ },
      end:   { dateTime: params.endIso,   timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
    },
  });

  const eventId        = event.data.id!;
  const durationMinutes = Math.round(
    (new Date(params.endIso).getTime() - new Date(params.startIso).getTime()) / 60_000
  );
  // Sanitise: remove characters that can cause issues in Zoom session names
  const safeIso     = params.startIso.replace(/[:.]/g, "-");
  const sessionName = `session-${safeIso}-${crypto.randomUUID().slice(0, 8)}`;
  const sessionType    = params.sessionType ?? "unknown";

  const { sessionId, sessionName: zoomSessionName, sessionPasscode } =
    generateZoomSessionCredentials({ sessionName });

  const durationWithGrace = getSessionDurationWithGrace(sessionType);
  const zoomRecord: ZoomSessionRecord = {
    sessionId,
    sessionName:     zoomSessionName,
    sessionPasscode,
    startIso:        params.startIso,
    durationMinutes,
    sessionType,
  };
  await kv.set(`zoom:session:${eventId}`, zoomRecord, {
    ex: durationWithGrace * 60 + 86_400,
  });

  return { eventId, zoomSessionName, zoomPasscode: sessionPasscode };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId, sendUpdates: "none" });
}

// ─── Cancellation tokens ──────────────────────────────────────────────────────

const CANCEL_SECRET = process.env.CANCEL_SECRET!;

function signToken(payload: string): string {
  return crypto.createHmac("sha256", CANCEL_SECRET).update(payload).digest("hex");
}

export async function createCancellationToken(
  record: Omit<BookingRecord, "used">
): Promise<string> {
  const payload  = `${record.eventId}:${record.email}:${record.startsAt}`;
  const token    = signToken(payload);
  const ttlSecs  = Math.max(3600, Math.floor((new Date(record.endsAt).getTime() + 3_600_000 - Date.now()) / 1000));

  await kv.set(`cancel:${token}`, { ...record, used: false }, { ex: ttlSecs });
  // Index token in the student's bookings sorted set (score = start timestamp ms)
  await kv.zadd(`bookings:${record.email.toLowerCase().trim()}`, {
    score:  new Date(record.startsAt).getTime(),
    member: token,
  });
  return token;
}

export async function verifyCancellationToken(
  token: string
): Promise<{ record: BookingRecord; withinWindow: boolean } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (!record || record.used) return null;

  const expectedToken = signToken(`${record.eventId}:${record.email}:${record.startsAt}`);
  const valid = crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expectedToken, "hex"));
  if (!valid) return null;

  const startsAt       = new Date(record.startsAt);
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * 3_600_000);
  return { record, withinWindow: new Date() < twoHoursBefore };
}

export async function consumeCancellationToken(token: string, email?: string): Promise<boolean> {
  const deleted = await kv.del(`cancel:${token}`);
  if (email) {
    kv.zrem(`bookings:${email.toLowerCase().trim()}`, token).catch(() => {});
  }
  return deleted > 0;
}
