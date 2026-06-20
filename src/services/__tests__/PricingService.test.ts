// Unit tests for PricingService.
import { PricingService } from "../PricingService";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";

function makeService() {
  const pricingRepo = new InMemoryPricingRepository();
  const audit       = new InMemoryAuditRepository();
  const service     = new PricingService(pricingRepo, audit);
  return { service, pricingRepo, audit };
}

describe("PricingService", () => {
  describe("getAmount", () => {
    it("returns the seeded amount and currency for each product", async () => {
      const { service } = makeService();
      await expect(service.getAmount("session1h")).resolves.toEqual({ amount: 1600, currency: "eur" });
      await expect(service.getAmount("pack10")).resolves.toEqual({ amount: 14000, currency: "eur" });
    });

    it("throws when the product is not configured", async () => {
      const { service, pricingRepo } = makeService();
      jest.spyOn(pricingRepo, "get").mockResolvedValueOnce(null);
      await expect(service.getAmount("pack5")).rejects.toThrow("No price configured for product pack5");
    });
  });

  describe("getAll", () => {
    it("returns all four product rows", async () => {
      const { service } = makeService();
      const all = await service.getAll();
      expect(all.map(r => r.productKey).sort()).toEqual(["pack10", "pack5", "session1h", "session2h"]);
    });
  });

  describe("updatePrice", () => {
    it("persists the new amount and reflects it in getAmount", async () => {
      const { service } = makeService();
      await service.updatePrice({
        key: "pack5", amountCents: 7000,
        by: "admin@test.com", reason: "summer promo",
      });
      await expect(service.getAmount("pack5")).resolves.toEqual({ amount: 7000, currency: "eur" });
    });

    it("writes an audit entry attributed to the admin email", async () => {
      const { service, audit } = makeService();
      await service.updatePrice({
        key: "session2h", amountCents: 3500,
        by: "admin@test.com", reason: "rate increase",
      });

      const entries = audit.getAll("admin@test.com");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action:      "admin_update_price",
        productKey:  "session2h",
        amountCents: 3500,
        reason:      "rate increase",
      });
    });
  });
});
