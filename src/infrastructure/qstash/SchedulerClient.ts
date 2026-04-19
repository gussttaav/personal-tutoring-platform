// ARCH-13: Thin wrapper around QStash so BookingService can depend on an
// interface rather than a concrete module — enables testing with mocks.
// Skips scheduling when running locally (QStash cannot reach loopback addresses).
import { qstash } from "./client";
import { log } from "@/lib/logger";
import type { IScheduler, ScheduleParams } from "./IScheduler";

export class SchedulerClient implements IScheduler {
  async scheduleAt(params: ScheduleParams): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return;

    await qstash.publishJSON({
      url:   params.url,
      body:  params.body,
      delay: params.delaySeconds,
    }).catch((err: unknown) => {
      log("error", "QStash schedule failed", { url: params.url, error: String(err) });
    });
  }
}
