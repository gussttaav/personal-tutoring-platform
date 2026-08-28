// Server-only cached reader for the admin-editable booking schedule.
//
// Mirrors pricing-display.ts: the customer-facing pages and the availability
// route read the schedule through this ISR cache so they don't hit the DB on
// every request. An admin edit calls `revalidateTag(SCHEDULE_CACHE_TAG)` so the
// new schedule shows up immediately (and `bumpScheduleVersion()` clears the
// Redis availability cache). BookingService / the charge path read
// scheduleService directly — never this cache — so they are always fresh.
//
// The time-based `revalidate` is only a long safety net for out-of-band DB
// changes (e.g. a direct SQL edit) — admin saves stay instant via the tag.
// Keeping it long avoids needless ISR-cache rewrites on every page hit.
import "server-only";
import { unstable_cache } from "next/cache";
import { scheduleService } from "@/services";
import { log } from "@/lib/logger";
import type { ScheduleConfig } from "@/domain/types";

export const SCHEDULE_CACHE_TAG = "schedule-config";

const REVALIDATE_SECONDS = 3600;

export const getScheduleConfig: () => Promise<ScheduleConfig> = unstable_cache(
  // BUILD-03b: TEMPORARY instrumentation — see pricing-display.ts.
  async () => {
    const t0 = Date.now();
    log("info", "BUILD-DIAG schedule read start", {
      service: "build-diag", at: new Date().toISOString(),
    });
    try {
      const cfg = await scheduleService.getConfig();
      log("info", "BUILD-DIAG schedule read OK", {
        service: "build-diag", ms: Date.now() - t0,
      });
      return cfg;
    } catch (err) {
      log("error", "BUILD-DIAG schedule read FAILED", {
        service: "build-diag", ms: Date.now() - t0,
        error: (err as Error).message, detail: JSON.stringify(err),
      });
      throw err;
    }
  },
  ["schedule-config"],
  { revalidate: REVALIDATE_SECONDS, tags: [SCHEDULE_CACHE_TAG] },
);
