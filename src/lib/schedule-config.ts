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
//
// PERF-11: like pricing-display.ts, this window is inherited by every route under
// `[locale]/layout.tsx` (Next applies the lowest revalidate touched during a render
// to the whole route). See that file for the full reasoning — in short, a short
// window here re-renders the ~88 Shiki/KaTeX course lessons on Vercel Active CPU.
import "server-only";
import { unstable_cache } from "next/cache";
import { scheduleService } from "@/services";
import { singleFlight, withRetry } from "@/lib/single-flight";
import type { ScheduleConfig } from "@/domain/types";

export const SCHEDULE_CACHE_TAG = "schedule-config";

const REVALIDATE_SECONDS = 2_592_000; // 30 days — see PERF-11 above

// BUILD-04: see pricing-display.ts — dedupe the prerender burst, then retry.
const readSchedule = singleFlight("schedule-config", () =>
  withRetry(() => scheduleService.getConfig(), "schedule-config"));

export const getScheduleConfig: () => Promise<ScheduleConfig> = unstable_cache(
  readSchedule,
  ["schedule-config"],
  { revalidate: REVALIDATE_SECONDS, tags: [SCHEDULE_CACHE_TAG] },
);
