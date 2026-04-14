/**
 * GET /api/my-bookings
 *
 * Returns the authenticated student's upcoming (and recent) booked sessions,
 * fetched from the bookings:{email} Redis sorted set that is populated by
 * createCancellationToken() whenever a new booking is made.
 *
 * Members in the sorted set are cancel tokens; scores are start timestamps (ms).
 * Tokens whose cancel:{token} key has expired (session ended) or been consumed
 * (cancelled/rescheduled) are silently filtered out and cleaned up best-effort.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { kv } from "@/lib/redis";
import type { BookingRecord } from "@/lib/calendar";

export interface UserBooking {
  token:       string;
  sessionType: "free15min" | "session1h" | "session2h" | "pack";
  startsAt:    string;
  endsAt:      string;
  packSize?:   number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const email  = session.user.email.toLowerCase().trim();
  const setKey = `bookings:${email}`;

  // Fetch all tokens ordered by start time (ascending score)
  const tokens = await kv.zrange<string[]>(setKey, 0, -1);
  if (!tokens?.length) {
    return NextResponse.json({ bookings: [] });
  }

  // Resolve each token in parallel
  const records = await Promise.all(
    tokens.map(async (token) => {
      const rec = await kv.get<BookingRecord>(`cancel:${token}`);
      // Filter expired and already-consumed tokens
      return rec && !rec.used ? { token, rec } : null;
    })
  );

  // Best-effort: remove stale members from the sorted set
  const staleTokens = records
    .map((r, i) => (r === null ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  if (staleTokens.length > 0) {
    kv.zrem(setKey, ...staleTokens).catch(() => {});
  }

  const bookings: UserBooking[] = records
    .filter((r): r is { token: string; rec: BookingRecord } => r !== null)
    .map(({ token, rec }) => ({
      token,
      sessionType: rec.sessionType as UserBooking["sessionType"],
      startsAt:    rec.startsAt,
      endsAt:      rec.endsAt,
      ...(rec.packSize !== undefined ? { packSize: rec.packSize } : {}),
    }));

  return NextResponse.json({ bookings });
}
