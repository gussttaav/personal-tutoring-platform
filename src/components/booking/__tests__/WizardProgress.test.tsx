/**
 * @jest-environment jsdom
 */
// BOOKING-STEPS-01: the step indicator shows icons (no numbers, no «Sesión» step), renders the
// steps the wizard offers as buttons, and carries the booking's exit left of the steps.
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import WizardProgress from "@/components/booking/WizardProgress";
import es from "../../../../messages/es.json";

function renderProgress(props: Partial<Parameters<typeof WizardProgress>[0]> = {}) {
  const onStepClick = jest.fn();
  const onExit      = jest.fn();
  const view = render(
    <NextIntlClientProvider locale="es" messages={es}>
      <WizardProgress
        currentStep="review"
        showPaymentStep
        reachableSteps={["schedule", "payment"]}
        onStepClick={onStepClick}
        onExit={onExit}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onStepClick, onExit, ...view };
}

describe("WizardProgress", () => {
  it("shows the three steps with icons, no session step and no numbers", () => {
    const { container } = renderProgress();
    screen.getByRole("navigation", { name: "Pasos de la reserva" });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Sesión")).toBeNull();
    const glyphs = Array.from(container.querySelectorAll("li .material-symbols-outlined")).map((el) => el.textContent);
    expect(glyphs).toEqual(["calendar_month", "rate_review", "credit_card"]);
    expect(container.querySelector("ol")?.textContent).not.toMatch(/\d/);
  });

  it("hides the payment step without showPaymentStep", () => {
    renderProgress({ showPaymentStep: false, reachableSteps: ["schedule"] });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Pago")).toBeNull();
  });

  it("renders only the reachable steps as buttons and reports the clicked step", () => {
    const { onStepClick } = renderProgress();
    fireEvent.click(screen.getByRole("button", { name: /Horario/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pago/ }));
    expect(onStepClick.mock.calls).toEqual([["schedule"], ["payment"]]);
    expect(screen.queryByRole("button", { name: /Revisión/ })).toBeNull();
  });

  it("keeps a step that is not reachable inert", () => {
    renderProgress({ currentStep: "schedule", reachableSteps: [] });
    expect(screen.queryByRole("button", { name: /Revisión/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pago/ })).toBeNull();
  });

  it("marks the active step as the current one", () => {
    renderProgress();
    const current = screen.getByText("Revisión").closest("[aria-current]");
    expect(current?.getAttribute("aria-current")).toBe("step");
  });

  it("carries the exit, which can be disabled", () => {
    const { onExit, rerender } = renderProgress();
    fireEvent.click(screen.getByRole("button", { name: "Salir de la reserva" }));
    expect(onExit).toHaveBeenCalledTimes(1);

    rerender(
      <NextIntlClientProvider locale="es" messages={es}>
        <WizardProgress currentStep="review" onExit={onExit} exitDisabled />
      </NextIntlClientProvider>,
    );
    expect((screen.getByRole("button", { name: "Salir de la reserva" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
