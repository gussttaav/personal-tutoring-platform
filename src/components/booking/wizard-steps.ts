/**
 * wizard-steps — the single-session wizard's steps and the order they can be visited in.
 *
 * BOOKING-STEPS-01: `WizardProgress`'s steps are clickable. Pure so the order rule is testable
 * apart from the wizard:
 *
 *   - any finished step can be gone back to;
 *   - forward is the NEXT step only, once it can be taken: «Revisión» once a slot is focused
 *     (what «Continuar» does), «Pago» only from «Revisión» (what «Confirmar y pagar» does).
 *     «Pago» is never reachable from «Horario»: the slot must be reviewed first;
 *   - nothing is reachable while the wizard is busy (verifying a slot, a booking or checkout
 *     request in flight, a payment being confirmed).
 *
 * There is no «Sesión» step: the visitor enters the wizard with a type, and the sidebar's
 * `SessionTypePicker` changes it in place (BOOKING-EXIT-01).
 */

export type WizardStepId = "schedule" | "review" | "payment";

/** The steps shown, in order. «Pago» only for a paid session that is not a reschedule. */
export function wizardSteps(showPayment: boolean): WizardStepId[] {
  return showPayment ? ["schedule", "review", "payment"] : ["schedule", "review"];
}

export function reachableWizardSteps({
  current,
  canContinue,
  showPayment,
  busy,
}: {
  current:     WizardStepId;
  /** A slot is focused in the calendar — «Continuar» is on offer. */
  canContinue: boolean;
  showPayment: boolean;
  busy:        boolean;
}): WizardStepId[] {
  if (busy) return [];
  switch (current) {
    case "schedule": return canContinue ? ["review"] : [];
    case "review":   return showPayment ? ["schedule", "payment"] : ["schedule"];
    case "payment":  return ["schedule", "review"];
  }
}
