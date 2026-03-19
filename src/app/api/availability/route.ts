/**
 * GET /api/availability?date=YYYY-MM-DD&duration=60
 *
 * Returns available time slots for a given date.
 * Duration is in minutes: 15, 60, or 120.
 *
 * No auth required — availability is public information.
 * Rate-limited to prevent calendar scraping.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar";
import { SCHEDULE } from "@/lib/booking-config";
import { chatRatelimit } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  // Rate limit by IP — reuse the chat limiter (60 req/min is plenty)
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await chatRatelimit.limit(`avail:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });
  }

  const date     = req.nextUrl.searchParams.get("date");
  const duration = parseInt(req.nextUrl.searchParams.get("duration") ?? "60", 10);

  // Validate date format
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  // Validate duration
  if (![15, 60, 120].includes(duration)) {
    return NextResponse.json({ error: "Duración inválida" }, { status: 400 });
  }

  // Validate date is not in the past
  const requested = new Date(date);
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  if (requested < today) {
    return NextResponse.json({ slots: [] });
  }

  // Validate date is within the booking window
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  if (requested > maxDate) {
    return NextResponse.json({ slots: [] });
  }

  // Validate it's a working day
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  if (!SCHEDULE.workingDays.includes(dayOfWeek)) {
    return NextResponse.json({ slots: [] });
  }

  try {
    const slots = await getAvailableSlots(date, duration);
    return NextResponse.json({ slots });
  } catch (err) {
    console.error("[availability] Error fetching slots:", err);
    return NextResponse.json({ error: "Error al consultar disponibilidad" }, { status: 500 });
  }
}
