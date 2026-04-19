// ARCH-16: Booking token helpers extracted from lib/calendar.ts.
//
// SEC-05: Split join token from cancel token.
// cancel:{cancelToken} → BookingRecord  (grants cancel/reschedule)
// join:{joinToken}     → JoinTokenRecord (grants session entry only)
import type { BookingRecord } from "@/domain/types";
import { kv } from "./client";
import crypto from "crypto";

const CANCEL_SECRET = process.env.CANCEL_SECRET!;

function signToken(payload: string): string {
  return crypto.createHmac("sha256", CANCEL_SECRET).update(payload).digest("hex");
}

export type JoinTokenRecord = {
  eventId:     string;
  email:       string;
  name:        string;
  sessionType: string;
  startsAt:    string;
};

export async function createBookingTokens(
  record: Omit<BookingRecord, "used">,
): Promise<{ cancelToken: string; joinToken: string }> {
  const cancelPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const joinPayload   = `join:${cancelPayload}`;

  const cancelToken = signToken(cancelPayload);
  const joinToken   = signToken(joinPayload);

  const ttlSecs = Math.max(3600, Math.floor(
    (new Date(record.endsAt).getTime() + 3_600_000 - Date.now()) / 1000,
  ));

  await kv.set(`cancel:${cancelToken}`, { ...record, used: false }, { ex: ttlSecs });
  await kv.zadd(`bookings:${record.email.toLowerCase().trim()}`, {
    score:  new Date(record.startsAt).getTime(),
    member: cancelToken,
  });
  await kv.set(
    `join:${joinToken}`,
    {
      eventId:     record.eventId,
      email:       record.email.toLowerCase().trim(),
      name:        record.name,
      sessionType: record.sessionType,
      startsAt:    record.startsAt,
    } satisfies JoinTokenRecord,
    { ex: ttlSecs },
  );

  return { cancelToken, joinToken };
}

/** @deprecated Use createBookingTokens. Kept for backward compat during migration. */
export async function createCancellationToken(
  record: Omit<BookingRecord, "used">,
): Promise<string> {
  const { cancelToken } = await createBookingTokens(record);
  return cancelToken;
}

export async function verifyCancellationToken(
  token: string,
): Promise<{ record: BookingRecord; withinWindow: boolean } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const record = await kv.get<BookingRecord>(`cancel:${token}`);
  if (!record || record.used) return null;

  const expectedToken = signToken(`${record.eventId}:${record.email}:${record.startsAt}`);
  const valid = crypto.timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(expectedToken, "hex"),
  );
  if (!valid) return null;

  const startsAt       = new Date(record.startsAt);
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * 3_600_000);
  return { record, withinWindow: new Date() < twoHoursBefore };
}

export async function resolveJoinToken(
  joinToken: string,
): Promise<JoinTokenRecord | null> {
  if (!/^[0-9a-f]{64}$/.test(joinToken)) return null;
  return kv.get<JoinTokenRecord>(`join:${joinToken}`);
}

export async function consumeCancellationToken(
  token: string,
  email?: string,
): Promise<boolean> {
  const deleted = await kv.del(`cancel:${token}`);
  if (email) {
    kv.zrem(`bookings:${email.toLowerCase().trim()}`, token).catch(() => {});
  }
  return deleted > 0;
}
