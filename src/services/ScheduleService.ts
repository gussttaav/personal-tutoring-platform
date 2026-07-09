// Application service for the admin-editable booking schedule.
//
// The `working_hours` + `booking_settings` tables are the single source of truth
// for working hours, minimum advance notice, and timezone. CalendarClient (slot
// generation), BookingService (min-notice guard), the availability route, and the
// customer-facing calendar all read their schedule from here.
import type { IScheduleRepository } from "@/domain/repositories/IScheduleRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { ScheduleConfig, WeeklyHours } from "@/domain/types";
import { BOOKING_WINDOW_WEEKS } from "@/lib/booking-config";
import { log } from "@/lib/logger";

export class ScheduleService {
  constructor(
    private readonly repo:  IScheduleRepository,
    private readonly audit: IAuditRepository,
  ) {}

  /** Returns the full schedule config (working hours + settings + static window). */
  async getConfig(): Promise<ScheduleConfig> {
    const [weeklyHours, settings] = await Promise.all([
      this.repo.getWeeklyHours(),
      this.repo.getSettings(),
    ]);
    return {
      weeklyHours,
      timezone:           settings.timezone,
      minNoticeHours:     settings.minNoticeHours,
      bookingWindowWeeks: BOOKING_WINDOW_WEEKS,
    };
  }

  /** Convenience for callers that only need the min-notice guard (BookingService). */
  async getMinNoticeHours(): Promise<number> {
    return (await this.repo.getSettings()).minNoticeHours;
  }

  /** Admin update: replaces working hours, updates settings, writes an audit entry. */
  async updateConfig(params: {
    weeklyHours:    WeeklyHours;
    timezone:       string;
    minNoticeHours: number;
    by:             string;
    reason:         string;
  }): Promise<void> {
    const { weeklyHours, timezone, minNoticeHours, by, reason } = params;

    await this.repo.replaceWeeklyHours(weeklyHours);
    await this.repo.updateSettings({ timezone, minNoticeHours, updatedBy: by });

    // The schedule isn't a per-student entity; attribute the audit entry to the
    // admin's own email (the IAuditRepository is keyed by email).
    await this.audit.append(by, {
      action:         "admin_update_schedule",
      timezone,
      minNoticeHours,
      reason,
    });

    log("info", "Schedule updated", { service: "ScheduleService", timezone, minNoticeHours, by });
  }
}
