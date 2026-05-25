// ARCH-13: Thin wrapper around QStash so BookingService can depend on an
// interface rather than a concrete module — enables testing with mocks.
//
// REFACTOR-P1-04: Errors are now propagated so the caller can record a fallback
// row. Adds explicit retries inside QStash itself for transient flakiness.
//
// Skips scheduling when running locally (QStash cannot reach loopback addresses).
import { qstash } from "./client";
import type { IScheduler, ScheduleParams } from "./IScheduler";

export class SchedulerClient implements IScheduler {
  async scheduleAt(params: ScheduleParams): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return;

    await qstash.publishJSON({
      url:     params.url,
      body:    params.body,
      delay:   params.delaySeconds,
      retries: 3,
    });
    // No .catch — let it throw. BookingService handles the fallback path.
  }
}
