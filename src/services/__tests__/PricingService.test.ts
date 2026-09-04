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

  describe("getPublicPricing", () => {
    it("maps the two single sessions with amount + currency", async () => {
      const { service } = makeService();
      const { sessions, currency } = await service.getPublicPricing();
      expect(currency).toBe("eur");
      expect(sessions).toEqual([
        { productKey: "session1h", amountCents: 1600, currency: "eur" },
        { productKey: "session2h", amountCents: 3000, currency: "eur" },
      ]);
    });

    it("includes the seeded pack validity (days)", async () => {
      const { service } = makeService();
      const { packValidityDays } = await service.getPublicPricing();
      expect(packValidityDays).toBe(180);
    });

    it("derives pack per-class rate, original (1h × hours) and savings", async () => {
      const { service } = makeService();
      const { packs } = await service.getPublicPricing();

      // pack5: 7500, hours 5 → perClass 1500; original 1600×5=8000 > 7500 → save 500 (6%)
      expect(packs[0]).toEqual({
        productKey: "pack5", amountCents: 7500, currency: "eur", hours: 5,
        perClassCents: 1500, originalAmountCents: 8000, savingsCents: 500, savingsPct: 6,
      });
      // pack10: 14000, hours 10 → perClass 1400; original 16000 > 14000 → save 2000 (13%)
      expect(packs[1]).toEqual({
        productKey: "pack10", amountCents: 14000, currency: "eur", hours: 10,
        perClassCents: 1400, originalAmountCents: 16000, savingsCents: 2000, savingsPct: 13,
      });
    });

    it("nulls the original/savings when a pack does not beat single sessions", async () => {
      const { service, pricingRepo } = makeService();
      // Raise pack5 above 1h×5 (8000) so there's no discount.
      await pricingRepo.update("pack5", 9000, "admin@test.com");
      const { packs } = await service.getPublicPricing();
      const pack5 = packs.find(p => p.productKey === "pack5")!;
      expect(pack5.originalAmountCents).toBeNull();
      expect(pack5.savingsCents).toBeNull();
      expect(pack5.savingsPct).toBeNull();
    });

    it("throws when a required product is missing", async () => {
      const { service, pricingRepo } = makeService();
      jest.spyOn(pricingRepo, "list").mockResolvedValueOnce([]);
      await expect(service.getPublicPricing()).rejects.toThrow("No price configured for product session1h");
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

  describe("updatePackValidityDays", () => {
    it("persists the new value and reflects it in getPackValidityDays + getPublicPricing", async () => {
      const { service } = makeService();
      await service.updatePackValidityDays({ days: 90, by: "admin@test.com", reason: "shorter promo" });

      await expect(service.getPackValidityDays()).resolves.toBe(90);
      const { packValidityDays } = await service.getPublicPricing();
      expect(packValidityDays).toBe(90);
    });

    it("writes an audit entry attributed to the admin email", async () => {
      const { service, audit } = makeService();
      await service.updatePackValidityDays({ days: 365, by: "admin@test.com", reason: "annual packs" });

      const entries = audit.getAll("admin@test.com");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action:           "admin_update_pack_validity",
        packValidityDays: 365,
        reason:           "annual packs",
      });
    });
  });
});
