/**
 * @jest-environment jsdom
 */
// BOOKING-LOCALE-01: after a pack payment the modal leaves for /pago-exitoso through the
// locale-aware router (`@/i18n/navigation`), so an English visitor lands on /en/pago-exitoso
// with the payment_intent_id query intact. The real next-intl router runs here; only Next's
// own router underneath it is stubbed, to record the href it finally receives.
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PricesProvider } from "@/components/pricing/PricesProvider";
import type { DisplayPrices } from "@/lib/pricing-format";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

const mockPush    = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter:   () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
  usePathname: () => "/mentoria",
}));

let mockEntryOnTop = true;
jest.mock("@/hooks/useBookingHistory", () => ({
  isBookingEntryOnTop: () => mockEntryOnTop,
}));

// Stripe stays out of it: the stub reports a confirmed payment on click.
jest.mock("@/components/PaymentForm", () => ({
  __esModule: true,
  default: ({ onSuccess }: { onSuccess: (paymentIntentId: string) => void }) => (
    <button onClick={() => onSuccess("pi_123")}>pay</button>
  ),
}));

import PackModal from "@/components/PackModal";

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

function payAs(locale: "es" | "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? es : en}>
      <PricesProvider value={PRICES} packValidityDays={180}>
        <PackModal
          packSize={5}
          userEmail="ana@example.com"
          userName="Ana"
          onClose={jest.fn()}
          initialClientSecret="pi_123_secret_abc"
        />
      </PricesProvider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "pay" }));
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockEntryOnTop = true;
});

describe("PackModal — leaving for the payment confirmation", () => {
  it("keeps an English visitor under /en, query string included", () => {
    payAs("en");
    expect(mockReplace).toHaveBeenCalledWith("/en/pago-exitoso?payment_intent_id=pi_123");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves the default (Spanish) locale unprefixed", () => {
    payAs("es");
    expect(mockReplace).toHaveBeenCalledWith("/pago-exitoso?payment_intent_id=pi_123");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("pushes instead of replacing when the booking entry is not on top", () => {
    mockEntryOnTop = false;
    payAs("en");
    expect(mockPush).toHaveBeenCalledWith("/en/pago-exitoso?payment_intent_id=pi_123");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
