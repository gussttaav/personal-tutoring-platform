import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar";
import { SCHEDULE, DAY_SCHEDULES } from "@/lib/booking-config";
import { availabilityRatelimit } from "@/lib/ratelimit"; // PERF-03: dedicated limiter
import { getClientIp } from "@/lib/ip-utils";

export async function GET(req: NextRequest) {
  // PERF-03: Use the dedicated availabilityRatelimit instead of borrowing
  // chatRatelimit with an avail: prefix. Previously both routes shared the
  // same 20-req/min budget under different key prefixes.
  const ip = getClientIp(req);
  const { success } = await availabilityRatelimit.limit(ip);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const date     = req.nextUrl.searchParams.get("date");
  const duration = parseInt(req.nextUrl.searchParams.get("duration") ?? "60", 10);
  const tz       = req.nextUrl.searchParams.get("tz") ?? SCHEDULE.timezone;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (![15, 60, 120].includes(duration))
    return NextResponse.json({ error: "Duración inválida" }, { status: 400 });

  const requested = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (requested < today) return NextResponse.json({ slots: [] });

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  if (requested > maxDate) return NextResponse.json({ slots: [] });

  const dow = new Date(`${date}T12:00:00`).getDay();
  if (DAY_SCHEDULES[dow] === null) return NextResponse.json({ slots: [] });

  try {
    const slots = await getAvailableSlots(date, duration);
    const withLocalTime = slots.map(slot => ({
      ...slot,
      localLabel: tz !== SCHEDULE.timezone
        ? new Date(slot.start).toLocaleTimeString("es-ES", {
            timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
          })
        : slot.label,
    }));
    return NextResponse.json({ slots: withLocalTime, timezone: SCHEDULE.timezone });
  } catch (err) {
    console.error("[availability] Error fetching slots:", err);
    return NextResponse.json({ error: "Error al consultar disponibilidad" }, { status: 500 });
  }
}
