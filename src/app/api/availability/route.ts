import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/infrastructure/google";
import { SCHEDULE, DAY_SCHEDULES } from "@/lib/booking-config";
import { availabilityRatelimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip-utils";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { success } = await availabilityRatelimit.limit(ip);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const date     = req.nextUrl.searchParams.get("date");
  const duration = parseInt(req.nextUrl.searchParams.get("duration") ?? "60", 10);
  const tz       = req.nextUrl.searchParams.get("tz") ?? SCHEDULE.timezone;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (![15, 30, 60, 120].includes(duration))
    return NextResponse.json({ error: "Duración inválida" }, { status: 400 });

  const requested = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (requested < today) return NextResponse.json({ slots: [] });

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  if (requested > maxDate) return NextResponse.json({ slots: [] });

  const dow = new Date(`${date}T12:00:00Z`).getDay();
  if (DAY_SCHEDULES[dow] === null) return NextResponse.json({ slots: [] });

  try {
    const slots = await getAvailableSlots(date, duration);

    const withLocalTime = slots.map(slot => {
      // If the user is in the same timezone as the server, localLabel === label.
      if (tz === SCHEDULE.timezone) {
        return { ...slot, localLabel: slot.label };
      }

      // Convert start time to the user's local timezone.
      const startLocal = new Date(slot.start).toLocaleTimeString("es-ES", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
      });

      // 15-min slots show only the start time; 1h/2h slots show a start–end range.
      // This mirrors the label format produced by formatSlotLabel() in calendar.ts.
      if (duration === 15) {
        return { ...slot, localLabel: startLocal };
      }

      const endLocal = new Date(slot.end).toLocaleTimeString("es-ES", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
      });
      return { ...slot, localLabel: `${startLocal}–${endLocal}` };
    });

    return NextResponse.json({ slots: withLocalTime, timezone: SCHEDULE.timezone });
  } catch (err) {
    log("error", "Error fetching slots", { service: "availability", date, error: String(err) });
    return NextResponse.json({ error: "Error al consultar disponibilidad" }, { status: 500 });
  }
}
