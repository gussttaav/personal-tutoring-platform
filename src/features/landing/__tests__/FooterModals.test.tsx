/**
 * @jest-environment jsdom
 */
// REFACTOR-R4-P2-03: the footer renders on every page, the commerce providers only on the
// booking pages. With them mounted the policy modal reads its two numbers from the context
// (no request); without them it fetches `/api/policy` once, on the first open of a modal
// that quotes them, and shows a skeleton until the answer arrives.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../messages/es.json";
import type { ScheduleConfig } from "@/domain/types";
import type { DisplayPrices } from "@/lib/pricing-format";
import { PricesProvider } from "@/components/pricing/PricesProvider";
import { ScheduleProvider } from "@/components/booking/ScheduleProvider";
import FooterModals from "@/features/landing/FooterModals";

// next-intl's navigation Link needs the Next router; a plain anchor is enough here.
jest.mock("@/i18n/navigation", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    Link: ({ href, ...rest }: { href: string } & Record<string, unknown>) =>
      createElement("a", { href, ...rest }),
  };
});

const SCHEDULE: ScheduleConfig = {
  weeklyHours:          {} as ScheduleConfig["weeklyHours"],
  timezone:             "Europe/Madrid",
  minNoticeHours:       5,
  cancelMinNoticeHours: 6,
  bookingWindowWeeks:   4,
};

const mockFetch = jest.fn();

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

function renderFooter({ withProviders }: { withProviders: boolean }) {
  const modals = <FooterModals />;
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      {withProviders ? (
        <PricesProvider value={{} as DisplayPrices} packValidityDays={150}>
          <ScheduleProvider value={SCHEDULE}>{modals}</ScheduleProvider>
        </PricesProvider>
      ) : (
        modals
      )}
    </NextIntlClientProvider>,
  );
}

const open  = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const close = () => fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
const skeleton = () => document.querySelector('[aria-busy="true"]');

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

describe("REFACTOR-R4-P2-03: FooterModals with CommerceProviders mounted", () => {
  it("renders the policy numbers from the context and never fetches", () => {
    renderFooter({ withProviders: true });

    open("Política de cancelación");
    expect(screen.getByText("6 horas de antelación")).toBeTruthy();
    expect(screen.getByText("150 días")).toBeTruthy();
    expect(skeleton()).toBeNull();

    close();
    fireEvent.click(screen.getByRole("link", { name: "Términos de servicio" }));
    expect(screen.getByText("150 días")).toBeTruthy();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("REFACTOR-R4-P2-03: FooterModals without CommerceProviders", () => {
  it("renders without a provider error and fetches nothing until a modal opens", () => {
    renderFooter({ withProviders: false });
    expect(screen.getByRole("button", { name: "Política de cancelación" })).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches /api/policy once on open, shows a skeleton, then the numbers", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ packValidityDays: 90, cancelHours: 12 }));
    renderFooter({ withProviders: false });

    open("Política de cancelación");
    expect(skeleton()).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/policy");

    expect(await screen.findByText("12 horas de antelación")).toBeTruthy();
    expect(screen.getByText("90 días")).toBeTruthy();
    expect(skeleton()).toBeNull();

    // Reopening (and the terms modal, which quotes the same numbers) reuses the answer.
    close();
    fireEvent.click(screen.getByRole("link", { name: "Términos de servicio" }));
    expect(screen.getByText("90 días")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not fetch for the privacy modal, which quotes no numbers", () => {
    renderFooter({ withProviders: false });
    fireEvent.click(screen.getByRole("link", { name: "Política de privacidad" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("keeps the skeleton on a failed fetch and retries on the next open", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, false))
      .mockResolvedValueOnce(jsonResponse({ packValidityDays: 90, cancelHours: 12 }));
    renderFooter({ withProviders: false });

    open("Política de cancelación");
    await act(async () => {}); // let the rejected request settle
    expect(skeleton()).not.toBeNull();
    expect(screen.queryByText(/horas de antelación/)).toBeNull();

    close();
    open("Política de cancelación");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("12 horas de antelación")).toBeTruthy();
  });
});
