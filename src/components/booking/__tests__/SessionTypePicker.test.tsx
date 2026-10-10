/**
 * @jest-environment jsdom
 */
// BOOKING-EXIT-01: the wizard's sidebar switches the session type in place — three native
// radios (live prices, «Sin coste» for the free call) reporting the picked type.
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PricesProvider } from "@/components/pricing/PricesProvider";
import SessionTypePicker from "@/components/booking/SessionTypePicker";
import type { DisplayPrices } from "@/lib/pricing-format";
import es from "../../../../messages/es.json";

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

function renderPicker(props: Partial<Parameters<typeof SessionTypePicker>[0]> = {}) {
  const onChange = jest.fn();
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <PricesProvider value={PRICES} packValidityDays={180}>
        <SessionTypePicker value="session1h" onChange={onChange} {...props} />
      </PricesProvider>
    </NextIntlClientProvider>,
  );
  return { onChange };
}

describe("SessionTypePicker", () => {
  it("offers the three single-session types as one labelled radio group", () => {
    renderPicker();
    screen.getByRole("radiogroup", { name: "Tipo de sesión" }); // throws when missing

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    const checked = (name: RegExp) => (screen.getByRole("radio", { name }) as HTMLInputElement).checked;
    expect(checked(/Encuentro inicial/)).toBe(false);
    expect(checked(/Sesión estándar/)).toBe(true);
    expect(checked(/Sesión extendida/)).toBe(false);
  });

  it("shows live prices, and «Sin coste» for the free call", () => {
    renderPicker();
    // getByRole throws when no radio carries that accessible name.
    screen.getByRole("radio", { name: /Encuentro inicial.*Sin coste/ });
    screen.getByRole("radio", { name: /Sesión estándar.*€16/ });
    screen.getByRole("radio", { name: /Sesión extendida.*€30/ });
  });

  it("reports the picked type", () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: /Sesión extendida/ }));
    expect(onChange).toHaveBeenCalledWith("session2h");
  });

  it("locks every option while disabled", () => {
    renderPicker({ disabled: true });
    for (const radio of screen.getAllByRole("radio")) expect((radio as HTMLInputElement).disabled).toBe(true);
  });
});
