import type { IScheduleRepository, ScheduleSettings } from "@/domain/repositories/IScheduleRepository";
import type { WeeklyHours } from "@/domain/types";
import { supabase } from "./client";

interface WorkingHoursRow {
  day_of_week:  number;
  start_minute: number;
  end_minute:   number;
}

interface BookingSettingsRow {
  timezone:         string;
  min_notice_hours: number;
  updated_at:       string;
  updated_by:       string | null;
}

/** Empty WeeklyHours with every day-of-week key present. */
function emptyWeekly(): WeeklyHours {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export class SupabaseScheduleRepository implements IScheduleRepository {
  async getWeeklyHours(): Promise<WeeklyHours> {
    const { data, error } = await supabase
      .from("working_hours")
      .select("day_of_week, start_minute, end_minute")
      .order("day_of_week", { ascending: true })
      .order("start_minute", { ascending: true });
    if (error) throw error;

    const weekly = emptyWeekly();
    for (const row of (data ?? []) as WorkingHoursRow[]) {
      (weekly[row.day_of_week] ??= []).push({
        startMinute: row.start_minute,
        endMinute:   row.end_minute,
      });
    }
    return weekly;
  }

  async getSettings(): Promise<ScheduleSettings> {
    const { data, error } = await supabase
      .from("booking_settings")
      .select("timezone, min_notice_hours, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No booking_settings row configured (expected id=1)");

    const row = data as BookingSettingsRow;
    return {
      timezone:       row.timezone,
      minNoticeHours: row.min_notice_hours,
      updatedAt:      row.updated_at,
      updatedBy:      row.updated_by,
    };
  }

  async replaceWeeklyHours(weekly: WeeklyHours): Promise<void> {
    // Replace-all: clear every row, then insert the new blocks. This is a
    // single-admin tool, so the brief window is acceptable; the availability
    // cache version is bumped only after this resolves (see availability-cache.ts).
    const { error: delError } = await supabase
      .from("working_hours")
      .delete()
      .gte("id", 0);
    if (delError) throw delError;

    const rows: { day_of_week: number; start_minute: number; end_minute: number }[] = [];
    for (const dowStr of Object.keys(weekly)) {
      const dow = Number(dowStr);
      for (const block of weekly[dow] ?? []) {
        rows.push({ day_of_week: dow, start_minute: block.startMinute, end_minute: block.endMinute });
      }
    }

    if (rows.length > 0) {
      const { error: insError } = await supabase.from("working_hours").insert(rows);
      if (insError) throw insError;
    }
  }

  async updateSettings(settings: { timezone: string; minNoticeHours: number; updatedBy: string }): Promise<void> {
    const { error } = await supabase
      .from("booking_settings")
      .update({
        timezone:         settings.timezone,
        min_notice_hours: settings.minNoticeHours,
        updated_at:       new Date().toISOString(),
        updated_by:       settings.updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
  }
}
