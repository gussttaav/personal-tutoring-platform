"use client";

/**
 * WizardProgress — booking wizard step indicator (UI only, the order rule is the caller's)
 *
 * Default (2 steps): Schedule → Review
 * With showPaymentStep: adds Payment for paid 1h / 2h sessions (not on a reschedule)
 * - Active:    filled emerald circle + glow ring
 * - Done:      filled emerald circle
 * - Reachable: emerald outline (the next step, once it can be taken)
 * - Locked:    surface-container circle with outline-variant border
 *
 * BOOKING-EXIT-01: no top margin by default any more — the indicator sat under `BookingLayout`'s
 * exit bar, which provided the gap below the navbar the old `mt-4` did. Since BOOKING-STEPS-01
 * the exit is in this row and the row takes that bar's place, right under `main`'s `pt-24`.
 *
 * BOOKING-STEPS-01:
 *   - Icons instead of numbers (each step keeps its glyph in every state), and no «Sesión» step:
 *     the visitor enters the wizard with a type and the sidebar switches it in place.
 *   - The steps in `reachableSteps` are buttons calling `onStepClick`; the wizard computes them
 *     with `reachableWizardSteps` (`./wizard-steps.ts`), so «Pago» is never one click from
 *     «Horario».
 *   - The exit («Salir de la reserva») sits left of the steps in the same row, icon-only on a
 *     phone (`BookingExitButton compact`); `BookingLayout` no longer draws its own exit row over
 *     the wizard's steps.
 *   - The step track is centred on the page from lg (a 1fr | track | 1fr grid, the exit in the
 *     left gutter); below lg it fills the room right of the exit.
 */

import { useTranslations } from "next-intl";
import BookingExitButton from "@/components/booking/BookingExitButton";
import { wizardSteps, type WizardStepId } from "@/components/booking/wizard-steps";

const STEP_ICONS: Record<WizardStepId, string> = {
  schedule: "calendar_month",
  review:   "rate_review",
  payment:  "credit_card",
};

interface WizardProgressProps {
  currentStep: WizardStepId;
  /** Pass true for paid sessions (1h / 2h) to show the Payment step */
  showPaymentStep?: boolean;
  /** Steps the visitor may jump to right now (rendered as buttons). */
  reachableSteps?: ReadonlyArray<WizardStepId>;
  onStepClick?: (step: WizardStepId) => void;
  /** Leaves the booking. Renders the exit button left of the steps. */
  onExit?: () => void;
  /** True while a request or payment is in flight — leaving would hide its outcome. */
  exitDisabled?: boolean;
  /** Spacing utility classes for the outer wrapper; override to tighten the gap.
   *  Default is responsive: less bottom room on mobile, full room from sm up. */
  spacingClassName?: string;
}

export default function WizardProgress({
  currentStep,
  showPaymentStep = false,
  reachableSteps = [],
  onStepClick,
  onExit,
  exitDisabled = false,
  spacingClassName = "mb-5 sm:mb-16",
}: WizardProgressProps) {
  const t = useTranslations("booking.wizardProgress");

  const steps        = wizardSteps(showPaymentStep);
  const currentIndex = steps.indexOf(currentStep);

  return (
    <nav aria-label={t("ariaLabel")} className={spacingClassName}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[1fr_minmax(0,42rem)_1fr] items-start gap-3 sm:gap-6">
        {onExit ? (
          <BookingExitButton
            onClick={onExit}
            disabled={exitDisabled}
            compact
            className="justify-self-start"
          />
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="relative">
          {/* Connecting line — top matches the circle centre at each breakpoint */}
          <div
            aria-hidden="true"
            className="absolute top-[18px] sm:top-5 left-0 w-full h-px"
            style={{ background: "#3c4a42", zIndex: 0 }}
          />

          <ol className="flex items-start justify-between relative m-0 p-0 list-none">
            {steps.map((id, i) => {
              const isActive    = id === currentStep;
              const isDone      = i < currentIndex;
              const isClickable = !isActive && !!onStepClick && reachableSteps.includes(id);
              const isLit       = isActive || isDone;
              const icon        = STEP_ICONS[id];

              const circleStyle: React.CSSProperties = isLit
                ? {
                    background: "#4edea3",
                    color: "#003824",
                    boxShadow: isActive
                      ? "0 0 0 4px rgba(78,222,163,0.18), 0 0 20px rgba(78,222,163,0.4)"
                      : undefined,
                  }
                : isClickable
                  ? { background: "#201f22", color: "#4edea3", border: "1px solid #4edea3" }
                  : { background: "#201f22", color: "#bbcabf", border: "1px solid #3c4a42" };

              const content = (
                <>
                  <span
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                    style={circleStyle}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">
                      {icon}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] sm:text-xs font-label uppercase font-semibold ${
                      isLit || isClickable ? "text-[#4edea3]" : "text-[#bbcabf]"
                    } ${isClickable ? "group-hover:text-[#6ee8b4]" : ""}`}
                    style={{ letterSpacing: "0.1em" }}
                  >
                    {t(id)}
                  </span>
                </>
              );

              return (
                <li key={id} className="relative flex flex-col items-center" style={{ zIndex: 1 }}>
                  {isClickable ? (
                    <button
                      type="button"
                      onClick={() => onStepClick?.(id)}
                      className="group flex flex-col items-center gap-2 sm:gap-3 rounded-lg bg-transparent border-0 p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4edea3]"
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      className="flex flex-col items-center gap-2 sm:gap-3"
                      aria-current={isActive ? "step" : undefined}
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}
