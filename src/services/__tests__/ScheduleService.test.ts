// Unit tests for ScheduleService.
import { ScheduleService } from "../ScheduleService";
import { InMemoryScheduleRepository } from "@/__tests__/fixtures/InMemoryScheduleRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { BOOKING_WINDOW_WEEKS } from "@/lib/booking-config";

function makeService() {
  const repo    = new InMemoryScheduleRepository();
  const audit   = new InMemoryAuditRepository();
  const service = new ScheduleService(repo, audit);
  return { service, repo, audit };
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

  describe("getMinNoticeHours", () => {
    it("returns the configured min advance notice", async () => {
      const { service } = makeService();
      await expect(service.getMinNoticeHours()).resolves.toBe(5);
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
