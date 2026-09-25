/**
 * PRICING-STUDENT-01 — the equivalence guard.
 *
 * Public prices reach the UI through getDisplayPrices() (server, from PriceRecord
 * rows, globally ISR-cached). A student's private prices reach it through
 * publicPricingToDisplay(getPublicPricing()) (client, from the API DTO). Two code
 * paths, one rendered shape.
 *
 * The pack savings derivation exists separately in each of them — a pre-existing
 * duplication that this feature makes load-bearing. If they drift, a student on a
 * private price gets a different *layout* (a missing strikethrough, a stray "save
 * €0"), not just different numbers, which is a confusing bug to trace back here.
 *
 * So: for the same underlying prices, assert the two produce a deep-equal result.
 */

import { PricingService } from "@/services/PricingService";
import { InMemoryPricingRepository } from "@/__tests__/fixtures/InMemoryPricingRepository";
import { InMemoryAuditRepository } from "@/__tests__/fixtures/InMemoryAuditRepository";
import { publicPricingToDisplay, formatPrice } from "@/lib/pricing-format";

// Lazily built so the hoisted jest.mock factory below never touches a TDZ binding.
let _repo: InMemoryPricingRepository | null = null;
let _svc:  PricingService | null = null;
function svc(): PricingService {
  if (!_svc) {
    _repo = new InMemoryPricingRepository();
    _svc  = new PricingService(_repo, new InMemoryAuditRepository());
  }
  return _svc;
}
function repo(): InMemoryPricingRepository {
  svc();
  return _repo!;
}

// pricing-display is server-only and cached; neutralize both so the real
// derivation can run under Jest.
jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: jest.fn(),
}));
jest.mock("@/services", () => ({
  pricingService: {
    getAll:              () => svc().getAll(),
    getPackValidityDays: () => svc().getPackValidityDays(),
  },
}));

// Imported after the mocks are declared (jest hoists them above this anyway).
import { getDisplayPrices } from "@/lib/pricing-display";

/** Both paths over the same rows, for one locale. */
async function bothPaths(locale: string) {
  const viaServer = await getDisplayPrices(locale);
  const viaClient = publicPricingToDisplay(await svc().getPublicPricing(), locale);
  return { viaServer, viaClient };
}

describe("publicPricingToDisplay ↔ getDisplayPrices equivalence", () => {
  it("agrees on the seeded prices (packs beat singles)", async () => {
    const { viaServer, viaClient } = await bothPaths("es");
    expect(viaClient).toEqual(viaServer);
    // Guard the guard: a trivially-empty comparison would also pass toEqual.
    expect(viaServer.pack10.originalPrice).toBe("€160");
    expect(viaServer.pack10.savingsPct).toBe(13);
  });

  it("agrees on the null-savings case (pack does not beat singles)", async () => {
    // 1h = 1600 → 5 singles = 8000; pack5 above that has no discount to show.
    await repo().update("pack5", 9000, "admin@test.com");

    const { viaServer, viaClient } = await bothPaths("es");
    expect(viaClient).toEqual(viaServer);
    // All three must be null together on BOTH paths, not "€0"/0.
    for (const side of [viaServer, viaClient]) {
      expect(side.pack5.originalPrice).toBeNull();
      expect(side.pack5.savingsAmount).toBeNull();
      expect(side.pack5.savingsPct).toBeNull();
      // The per-hour rate is still shown — it isn't a savings field.
      expect(side.pack5.hourlyRate).toBe("€18");
    }
  });

  it("agrees on non-integer euro amounts (the decimal branch)", async () => {
    await repo().update("session1h", 1650, "admin@test.com");
    await repo().update("pack5",     7525, "admin@test.com");

    const { viaServer, viaClient } = await bothPaths("es");
    expect(viaClient).toEqual(viaServer);
    expect(viaServer.session1h.price).toBe("€16,50");
    expect(viaServer.pack5.price).toBe("€75,25");
  });

  it("agrees for the non-pack keys' null fields", async () => {
    const { viaServer, viaClient } = await bothPaths("es");
    for (const side of [viaServer, viaClient]) {
      for (const key of ["session1h", "session2h"] as const) {
        expect(side[key].hourlyRate).toBeNull();
        expect(side[key].originalPrice).toBeNull();
        expect(side[key].savingsAmount).toBeNull();
        expect(side[key].savingsPct).toBeNull();
      }
    }
  });

  it("agrees in English too (decimal separator differs from Spanish)", async () => {
    await repo().update("session2h", 3050, "admin@test.com");

    const { viaServer, viaClient } = await bothPaths("en");
    expect(viaClient).toEqual(viaServer);
    expect(viaServer.session2h.price).toBe("€30.50");
  });

  it("covers all four product keys on both paths", async () => {
    const { viaServer, viaClient } = await bothPaths("es");
    const keys = ["session1h", "session2h", "pack5", "pack10"];
    expect(Object.keys(viaServer).sort()).toEqual([...keys].sort());
    expect(Object.keys(viaClient).sort()).toEqual([...keys].sort());
  });
});

describe("formatPrice", () => {
  it("drops decimals for whole euros and keeps two otherwise", () => {
    expect(formatPrice(1600, "eur", "es")).toBe("€16");
    expect(formatPrice(1650, "eur", "es")).toBe("€16,50");
    expect(formatPrice(1650, "eur", "en")).toBe("€16.50");
  });

  it("prefixes the uppercased code for non-euro currencies", () => {
    expect(formatPrice(1600, "usd", "es")).toBe("USD 16");
  });
});
