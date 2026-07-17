// Unit tests for ScheduleService.
// REFACTOR-R3-P3-02 — adds coverage for the version-keyed config cache.
import { ScheduleService } from "../ScheduleService";
import { InMemoryScheduleRepository } from "@/__tests__/fixtures/InMemoryScheduleRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { InMemoryConfigCache } from "@/__tests__/fixtures/InMemoryConfigCache";
import { BOOKING_WINDOW_WEEKS } from "@/lib/booking-config";

function makeService() {
  const repo    = new InMemoryScheduleRepository();
  const audit   = new InMemoryAuditRepository();
  const cache   = new InMemoryConfigCache();
  const service = new ScheduleService(repo, audit, cache);
  // The in-memory repo has no call counters of its own.
  const getWeeklyHours = jest.spyOn(repo, "getWeeklyHours");
  const getSettings    = jest.spyOn(repo, "getSettings");
  return { service, repo, audit, cache, getWeeklyHours, getSettings };
}

describe("ScheduleService", () => {
  describe("getConfig", () => {
    it("returns the seeded weekly hours, settings and static window", async () => {
      const { service } = makeService();
      const config = await service.getConfig();

      expect(config.timezone).toBe("Europe/Madrid");
      expect(config.minNoticeHours).toBe(5);
      expect(config.bookingWindowWeeks).toBe(BOOKING_WINDOW_WEEKS);
      // Monday has the morning + afternoon split shift.
      expect(config.weeklyHours[1]).toEqual([
        { startMinute: 540, endMinute: 810 },
        { startMinute: 930, endMinute: 1050 },
      ]);
      // Saturday is a single block.
      expect(config.weeklyHours[6]).toEqual([{ startMinute: 660, endMinute: 900 }]);
    });
  });

  describe("getConfig caching", () => {
    it("on a miss, reads the repo once and caches under the versioned key with a TTL backstop", async () => {
      const { service, cache, getWeeklyHours, getSettings } = makeService();
      await service.getConfig();

      expect(getWeeklyHours).toHaveBeenCalledTimes(1);
      expect(getSettings).toHaveBeenCalledTimes(1);
      expect(cache.keys()).toEqual(["schedule:config:v0"]);
      expect(cache.ttls.get("schedule:config:v0")).toBe(300);
    });

    it("on a hit, returns the cached config without touching the repo", async () => {
      const { service, cache, getWeeklyHours, getSettings } = makeService();
      const first = await service.getConfig();

      getWeeklyHours.mockClear();
      getSettings.mockClear();
      cache.calls.set = 0;

      const second = await service.getConfig();

      expect(second).toEqual(first);
      expect(getWeeklyHours).not.toHaveBeenCalled();
      expect(getSettings).not.toHaveBeenCalled();
      expect(cache.calls.set).toBe(0);
    });

    it("refetches after a version bump (the admin-edit signal)", async () => {
      const { service, cache, getWeeklyHours } = makeService();
      await service.getConfig();
      getWeeklyHours.mockClear();

      // Simulates what the admin schedule route does on an edit.
      await cache.bumpVersion();
      await service.getConfig();

      expect(getWeeklyHours).toHaveBeenCalledTimes(1);
      expect(cache.keys()).toContain("schedule:config:v1");
    });

    it("falls back to the repo when the cache throws, without throwing", async () => {
      const { service, cache } = makeService();
      cache.failWith = new Error("redis down");

      const config = await service.getConfig();

      expect(config.timezone).toBe("Europe/Madrid");
      expect(config.minNoticeHours).toBe(5);
    });
  });

  describe("updateConfig", () => {
    it("persists new weekly hours and settings (round-trip via getConfig)", async () => {
      const { service } = makeService();
      await service.updateConfig({
        weeklyHours: {
          1: [{ startMinute: 600, endMinute: 720 }],
          0: [], 2: [], 3: [], 4: [], 5: [], 6: [],
        },
        timezone:       "Europe/London",
        minNoticeHours: 12,
        by:             "admin@test.com",
        reason:         "new summer schedule",
      });

      const config = await service.getConfig();
      expect(config.timezone).toBe("Europe/London");
      expect(config.minNoticeHours).toBe(12);
      expect(config.weeklyHours[1]).toEqual([{ startMinute: 600, endMinute: 720 }]);
      expect(config.weeklyHours[2]).toEqual([]);
    });

    it("writes an audit entry attributed to the admin email", async () => {
      const { service, audit } = makeService();
      await service.updateConfig({
        weeklyHours: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
        timezone:       "Europe/Madrid",
        minNoticeHours: 8,
        by:             "admin@test.com",
        reason:         "closing for holidays",
      });

      const entries = audit.getAll("admin@test.com");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action:         "admin_update_schedule",
        timezone:       "Europe/Madrid",
        minNoticeHours: 8,
        reason:         "closing for holidays",
      });
    });
  });
});
