// BOOKING-STEPS-01: the wizard's steps are clickable in order — back to any finished step,
// forward only to the next one once it can be taken, never «Pago» without passing «Revisión».
import { reachableWizardSteps, wizardSteps } from "@/components/booking/wizard-steps";

const base = { canContinue: false, showPayment: true, busy: false };

describe("wizardSteps", () => {
  it("has no session step, and the payment step only for a paid session", () => {
    expect(wizardSteps(true)).toEqual(["schedule", "review", "payment"]);
    expect(wizardSteps(false)).toEqual(["schedule", "review"]);
  });
});

describe("reachableWizardSteps", () => {
  it("offers nothing from the calendar until a slot is focused", () => {
    expect(reachableWizardSteps({ ...base, current: "schedule" })).toEqual([]);
  });

  it("offers review from the calendar once a slot is focused, never payment", () => {
    expect(reachableWizardSteps({ ...base, current: "schedule", canContinue: true })).toEqual(["review"]);
  });

  it("offers the calendar and payment from review", () => {
    expect(reachableWizardSteps({ ...base, current: "review" })).toEqual(["schedule", "payment"]);
  });

  it("offers only the calendar from review when there is no payment step", () => {
    expect(reachableWizardSteps({ ...base, current: "review", showPayment: false })).toEqual(["schedule"]);
  });

  it("offers both finished steps from payment", () => {
    expect(reachableWizardSteps({ ...base, current: "payment" })).toEqual(["schedule", "review"]);
  });

  it("offers nothing while busy", () => {
    for (const current of ["schedule", "review", "payment"] as const) {
      expect(reachableWizardSteps({ ...base, current, canContinue: true, busy: true })).toEqual([]);
    }
  });
});
