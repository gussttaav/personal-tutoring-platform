import type { WeeklyHours } from "../types";

export interface ScheduleSettings {
  timezone:             string;
  minNoticeHours:       number;
  cancelMinNoticeHours: number;
  updatedAt:            string;
  updatedBy:            string | null;
}

export interface IScheduleRepository {
  /** Returns the per-day working blocks ({0:[],…,6:[]}), each day's blocks sorted by start. */
  getWeeklyHours(): Promise<WeeklyHours>;
  /** Returns the singleton booking settings (timezone, min advance notice). */
  getSettings(): Promise<ScheduleSettings>;
  /** Replace-all write: deletes every working_hours row, then inserts the provided blocks. */
  replaceWeeklyHours(weekly: WeeklyHours): Promise<void>;
  /** Updates the singleton booking settings. */
  updateSettings(settings: { timezone: string; minNoticeHours: number; cancelMinNoticeHours: number; updatedBy: string }): Promise<void>;
}
