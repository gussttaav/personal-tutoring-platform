/**
 * @jest-environment jsdom
 */
// REFACTOR-R4-P2-03: the commerce providers left the root layout, so a page that doesn't
// mount CommerceProviders has no prices/schedule context. The throwing hooks must keep
// throwing there (a missed consumer is a bug, not a silent default), the `*Optional`
// hooks must answer null (the footer's policy modal renders on every page), and
// CommerceProviders must feed every hook from the three loaders.
import { render, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ScheduleConfig } from "@/domain/types";
import type { DisplayPrices } from "@/lib/pricing-format";

const mockGetDisplayPrices    = jest.fn();
const mockGetPackValidityDays = jest.fn();
const mockGetScheduleConfig   = jest.fn();
jest.mock("@/lib/pricing-display", () => ({
  getDisplayPrices:    (...args: unknown[]) => mockGetDisplayPrices(...args),
  getPackValidityDays: () => mockGetPackValidityDays(),
}));
jest.mock("@/lib/schedule-config", () => ({
  getScheduleConfig: () => mockGetScheduleConfig(),
}));
// UserPricingSync reads the session; anonymous here, so it never fetches /api/pricing.
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

import { CommerceProviders } from "@/components/commerce/CommerceProviders";
import {
  PricesProvider,
  usePackValidityDays,
  usePackValidityDaysOptional,
  usePrices,
  usePricesOverlay,
  usePricesSyncing,
  useProductPrice,
  useSessionPriceLabel,
} from "@/components/pricing/PricesProvider";
import {
  ScheduleProvider,
  useScheduleConfig,
  useScheduleConfigOptional,
} from "@/components/booking/ScheduleProvider";

const PRICE = {
  price: "€16", priceCents: 1600, currency: "eur",
  originalPrice: null, hourlyRate: null, savingsAmount: null, savingsPct: null,
};
const PRICES = {
  session1h: PRICE,
  session2h: { ...PRICE, price: "€30", priceCents: 3000 },
  pack5:     { ...PRICE, price: "€75", priceCents: 7500 },
  pack10:    { ...PRICE, price: "€140", priceCents: 14000 },
} as DisplayPrices;

const SCHEDULE: ScheduleConfig = {
  weeklyHours:          {} as ScheduleConfig["weeklyHours"],
  timezone:             "Europe/Madrid",
  minNoticeHours:       5,
  cancelMinNoticeHours: 6,
  bookingWindowWeeks:   4,
};

// renderHook prints React's error boundary noise for an expected throw.
function silenceConsoleError() {
  return jest.spyOn(console, "error").mockImplementation(() => {});
}

describe("REFACTOR-R4-P2-03: commerce hooks outside their providers", () => {
  // useProductPrice / useSessionPriceLabel delegate to usePrices, so they throw its message.
  it.each<[string, () => unknown, string]>([
    ["usePrices",            () => usePrices(),                         "usePrices"],
    ["useProductPrice",      () => useProductPrice("pack5"),            "usePrices"],
    ["useSessionPriceLabel", () => useSessionPriceLabel("session1h"),   "usePrices"],
    ["usePackValidityDays",  () => usePackValidityDays(),               "usePackValidityDays"],
    ["usePricesOverlay",     () => usePricesOverlay(),                  "usePricesOverlay"],
    ["useScheduleConfig",    () => useScheduleConfig(),                 "useScheduleConfig"],
  ])("%s still throws", (_name, hook, thrower) => {
    const spy = silenceConsoleError();
    expect(() => renderHook(hook)).toThrow(`${thrower} must be used within a`);
    spy.mockRestore();
  });

  it("usePackValidityDaysOptional returns null", () => {
    expect(renderHook(() => usePackValidityDaysOptional()).result.current).toBeNull();
  });

  it("useScheduleConfigOptional returns null", () => {
    expect(renderHook(() => useScheduleConfigOptional()).result.current).toBeNull();
  });

  it("usePricesSyncing defaults to false (never a skeleton forever)", () => {
    expect(renderHook(() => usePricesSyncing()).result.current).toBe(false);
  });
});

describe("REFACTOR-R4-P2-03: the *Optional hooks inside their providers", () => {
  it("return the provided values", () => {
    const { result } = renderHook(
      () => ({ days: usePackValidityDaysOptional(), schedule: useScheduleConfigOptional() }),
      {
        wrapper: ({ children }) => (
          <PricesProvider value={PRICES} packValidityDays={150}>
            <ScheduleProvider value={SCHEDULE}>{children}</ScheduleProvider>
          </PricesProvider>
        ),
      },
    );
    expect(result.current.days).toBe(150);
    expect(result.current.schedule).toBe(SCHEDULE);
  });
});

describe("REFACTOR-R4-P2-03: CommerceProviders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayPrices.mockResolvedValue(PRICES);
    mockGetPackValidityDays.mockResolvedValue(150);
    mockGetScheduleConfig.mockResolvedValue(SCHEDULE);
  });

  it("feeds every commerce hook from the three loaders, prices in the page's locale", async () => {
    const seen = jest.fn();
    function Probe() {
      seen({
        prices:   usePrices(),
        days:     usePackValidityDays(),
        schedule: useScheduleConfig(),
        syncing:  usePricesSyncing(),
      });
      return null;
    }

    // An async server component: await it for the element tree it renders.
    const tree = await CommerceProviders({ locale: "en", children: <Probe /> });
    expect(mockGetDisplayPrices).toHaveBeenCalledWith("en");

    render(<NextIntlClientProvider locale="en" messages={{}}>{tree}</NextIntlClientProvider>);

    expect(seen).toHaveBeenLastCalledWith({
      prices:   PRICES,
      days:     150,
      schedule: SCHEDULE,
      // UserPricingSync is inside: an anonymous viewer is never "syncing".
      syncing:  false,
    });
  });
});
