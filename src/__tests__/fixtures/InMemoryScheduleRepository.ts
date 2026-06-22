// In-memory implementation of IScheduleRepository for tests.
// Seeded to match supabase/migrations/0013_booking_schedule.sql.
import type { IScheduleRepository, ScheduleSettings } from "@/domain/repositories/IScheduleRepository";
import type { TimeBlock, WeeklyHours } from "@/domain/types";

function seedWeekly(): WeeklyHours {
  return {
    0: [{ startMinute: 660, endMinute: 900 }],
    1: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
    2: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    3: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1050 }],
    4: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    5: [{ startMinute: 540, endMinute: 810 }, { startMinute: 930, endMinute: 1110 }],
    6: [{ startMinute: 660, endMinute: 900 }],
  };
}

export class InMemoryScheduleRepository implements IScheduleRepository {
  private weekly: WeeklyHours = seedWeekly();
  private settings: ScheduleSettings = {
    timezone:       "Europe/Madrid",
    minNoticeHours: 5,
    updatedAt:      new Date().toISOString(),
    updatedBy:      null,
  };

  async getWeeklyHours(): Promise<WeeklyHours> {
    // Return a deep copy so callers can't mutate internal state.
    const out = {} as WeeklyHours;
    for (const dow of Object.keys(this.weekly)) {
      out[Number(dow)] = (this.weekly[Number(dow)] ?? []).map((b) => ({ ...b }));
    }
    return out;
  }

  async getSettings(): Promise<ScheduleSettings> {
    return { ...this.settings };
  }

  async replaceWeeklyHours(weekly: WeeklyHours): Promise<void> {
    const next = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } as WeeklyHours;
    for (const dow of Object.keys(weekly)) {
      next[Number(dow)] = (weekly[Number(dow)] ?? []).map((b: TimeBlock) => ({ ...b }));
    }
    this.weekly = next;
  }

  async updateSettings(settings: { timezone: string; minNoticeHours: number; updatedBy: string }): Promise<void> {
    this.settings = {
      timezone:       settings.timezone,
      minNoticeHours: settings.minNoticeHours,
      updatedAt:      new Date().toISOString(),
      updatedBy:      settings.updatedBy,
    };
  }
}
