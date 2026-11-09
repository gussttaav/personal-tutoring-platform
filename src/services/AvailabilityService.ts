// CHAT-AGENT-P1-01: the availability lookup, shared by GET /api/availability and the chat
// tools (P1-03). Extracted from the route unchanged: same date guards, same Redis cache
// (PERF-10, REFACTOR-P3-03 miss coalescing), same Google freebusy source.
//
// The slot source is injected as a function (`getAvailableSlots` in production), not a
// CalendarClient, so tests need no Google mock.
import type { ScheduleConfig, TimeSlot } from "@/domain/types";
import type { ScheduleService } from "./ScheduleService";
import { getOrCompute, resolveCacheKey, cacheTTLSeconds } from "@/lib/availability-cache";
import { log } from "@/lib/logger";

export type SlotSource = (
  date: string,
  durationMinutes: number,
  config: ScheduleConfig,
) => Promise<TimeSlot[]>;

/** findSlots never walks more days than this, whatever the caller asks. */
export const MAX_FIND_DAYS = 7;

export class AvailabilityService {
  constructor(
    private readonly schedule: Pick<ScheduleService, "getConfig">,
    private readonly source: SlotSource,
  ) {}

  /** Free slots of `durationMinutes` on `date` (YYYY-MM-DD), labels in the tutor's timezone. */
  async getSlots(date: string, durationMinutes: number): Promise<TimeSlot[]> {
    return (await this.lookup(date, durationMinutes, await this.schedule.getConfig())) ?? [];
  }

  /**
   * The free slots from `fromDate` on, day by day, until `limit` slots are found or
   * `days` days (capped at MAX_FIND_DAYS) are walked. Sequential on purpose: most days
   * are cache hits, and stopping early saves Google calls on a miss.
   */
  async findSlots(opts: {
    fromDate: string;
    days: number;
    durationMinutes: number;
    limit: number;
  }): Promise<TimeSlot[]> {
    const days = Math.min(opts.days, MAX_FIND_DAYS);
    if (days <= 0 || opts.limit <= 0) return [];

    const config = await this.schedule.getConfig();
    const found: TimeSlot[] = [];
    const cursor = new Date(`${opts.fromDate}T12:00:00Z`);

    for (let i = 0; i < days && found.length < opts.limit; i++) {
      const date = cursor.toISOString().slice(0, 10);
      found.push(...((await this.lookup(date, opts.durationMinutes, config)) ?? []));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return found.slice(0, opts.limit);
  }

  /**
   * One day's lookup against an already-read config. `null` means the date is closed
   * (past, beyond the booking window, or no working blocks) and nothing was queried;
   * `[]` means it is open but fully booked. GET /api/availability answers the two
   * differently, so the distinction is kept here.
   *
   * The config should be read fresh (`ScheduleService.getConfig()`, not the ISR loader)
   * so that an admin edit takes effect on bookable slots immediately — paired with the
   * Redis cache version bump in /api/admin/schedule.
   */
  async lookup(date: string, durationMinutes: number, config: ScheduleConfig): Promise<TimeSlot[] | null> {
    const requested = new Date(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (requested < today) return null;

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + config.bookingWindowWeeks * 7);
    if (requested > maxDate) return null;

    const dow = new Date(`${date}T12:00:00Z`).getDay();
    if ((config.weeklyHours[dow] ?? []).length === 0) return null;

    // REFACTOR-P3-03: Coalesce concurrent misses so only the first caller hits
    // the Calendar API; the rest wait briefly and re-read the cache.
    const ttl = cacheTTLSeconds(date);
    const key = await resolveCacheKey(date, durationMinutes);
    const result = await getOrCompute<{ slots: TimeSlot[] }>(
      key,
      async () => {
        log("info", "Availability cache miss", { service: "availability", date, duration: durationMinutes });
        const slots = await this.source(date, durationMinutes, config);
        return { slots };
      },
      ttl,
    );
    return result.slots;
  }
}
