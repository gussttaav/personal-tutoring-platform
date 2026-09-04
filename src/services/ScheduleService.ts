// Application service for the admin-editable booking schedule.
//
// The `working_hours` + `booking_settings` tables are the single source of truth
// for working hours, minimum advance notice, and timezone. CalendarClient (slot
// generation), BookingService (min-notice guard), the availability route, and the
// customer-facing calendar all read their schedule from here.
//
// REFACTOR-R3-P3-02 — Version-keyed config cache
//
// getConfig() used to hit Supabase twice on every call, and it is called fresh on
// every availability request (by design — /api/availability bypasses the 60s ISR
// cache so admin edits apply to bookable slots immediately). One week view in the
// availability modal = 7 parallel day-fetches = 14 round-trips for identical
// config. It now reads through an IConfigCache keyed by the global version.
//
// Invariants for future readers:
//   - The version bump is the real invalidator; the 300s TTL is only a backstop
//     that bounds orphan memory. Do not shorten the TTL to "improve freshness" —
//     freshness comes from updateConfig bumping the version.
//   - The cache is a port, injected. This service imports zero infrastructure
//     modules; keep it that way (importing kv here would fire Redis.fromEnv() at
//     test import time).
//   - Every cache call is best-effort: a Redis outage degrades to direct repo
//     reads, never a 500. Cache failures must not fail a read or a write.
import type { IScheduleRepository } from "@/domain/repositories/IScheduleRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import type { IConfigCache } from "@/domain/repositories/IConfigCache";
import type { ScheduleConfig, WeeklyHours } from "@/domain/types";
import { BOOKING_WINDOW_WEEKS } from "@/lib/booking-config";
import { log } from "@/lib/logger";

const CONFIG_CACHE_TTL_SECONDS = 300;

export class ScheduleService {
  constructor(
    private readonly repo:  IScheduleRepository,
    private readonly audit: IAuditRepository,
    private readonly cache: IConfigCache,
  ) {}

  /** Returns the full schedule config (working hours + settings + static window). */
  async getConfig(): Promise<ScheduleConfig> {
    const key = await this.cachedConfigKey();

    if (key) {
      try {
        const cached = await this.cache.get<ScheduleConfig>(key);
        if (cached) return cached;
      } catch (err) {
        log("warn", "Config cache read failed; falling back to the repository", {
          service: "ScheduleService", key, err: String(err),
        });
      }
    }

    const config = await this.readConfigFromRepo();

    if (key) {
      try {
        await this.cache.set(key, config, CONFIG_CACHE_TTL_SECONDS);
      } catch (err) {
        // A failed write only costs us the next hit — the read already succeeded.
        log("warn", "Config cache write failed", {
          service: "ScheduleService", key, err: String(err),
        });
      }
    }

    return config;
  }

  /** Resolves the version-namespaced cache key, or null if the version is unreachable. */
  private async cachedConfigKey(): Promise<string | null> {
    try {
      return `schedule:config:v${await this.cache.currentVersion()}`;
    } catch (err) {
      // Without a version we can't key safely — skip the cache entirely rather
      // than risk reading or writing under a stale namespace.
      log("warn", "Config cache version unavailable; bypassing the cache", {
        service: "ScheduleService", err: String(err),
      });
      return null;
    }
  }

  private async readConfigFromRepo(): Promise<ScheduleConfig> {
    const [weeklyHours, settings] = await Promise.all([
      this.repo.getWeeklyHours(),
      this.repo.getSettings(),
    ]);
    return {
      weeklyHours,
      timezone:             settings.timezone,
      minNoticeHours:       settings.minNoticeHours,
      cancelMinNoticeHours: settings.cancelMinNoticeHours,
      bookingWindowWeeks:   BOOKING_WINDOW_WEEKS,
    };
  }

  /** Admin update: replaces working hours, updates settings, writes an audit entry. */
  async updateConfig(params: {
    weeklyHours:          WeeklyHours;
    timezone:             string;
    minNoticeHours:       number;
    cancelMinNoticeHours: number;
    by:                   string;
    reason:               string;
  }): Promise<void> {
    const { weeklyHours, timezone, minNoticeHours, cancelMinNoticeHours, by, reason } = params;

    await this.repo.replaceWeeklyHours(weeklyHours);
    await this.repo.updateSettings({ timezone, minNoticeHours, cancelMinNoticeHours, updatedBy: by });

    // Bump only after the writes land, so a concurrent read can't cache the old
    // config under the new version. Best-effort: if the bump fails the config is
    // still persisted, and the TTL bounds the staleness.
    try {
      await this.cache.bumpVersion();
    } catch (err) {
      log("warn", "Config cache version bump failed; stale config until the TTL expires", {
        service: "ScheduleService", err: String(err),
      });
    }

    // The schedule isn't a per-student entity; attribute the audit entry to the
    // admin's own email (the IAuditRepository is keyed by email).
    await this.audit.append(by, {
      action:         "admin_update_schedule",
      timezone,
      minNoticeHours,
      cancelMinNoticeHours,
      reason,
    });

    log("info", "Schedule updated", { service: "ScheduleService", timezone, minNoticeHours, cancelMinNoticeHours, by });
  }
}
